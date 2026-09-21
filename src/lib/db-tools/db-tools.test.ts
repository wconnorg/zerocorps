import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../test/test-database.ts";
import { decryptBackup, encryptBackup } from "../backup/format.ts";
import { dumpDatabase, readDumpSummary, restoreDatabase, type Query } from "../backup/dump.ts";
import { countRows } from "./counts.ts";
import { parseJournal, pendingMigrations } from "./migrations.ts";
import { checkAppRole } from "./role-check.ts";
import { PGlite } from "@electric-sql/pglite";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "../../db/schema.ts";

/**
 * The owner's database commands, proven on a Postgres inside this process. None of
 * this ever touches the real database.
 */

const queryOf =
  (client: TestDatabase["client"]): Query =>
  async (text, params) =>
    (await client.query<Record<string, unknown>>(text, params)).rows;

/** Runs one statement in a transaction that is always rolled back, as the script does. */
const attemptOn = (client: TestDatabase["client"]) => async (statement: string) => {
  await client.exec("BEGIN");
  try {
    await client.exec(statement);
    return { allowed: true };
  } catch (error) {
    return { allowed: false, code: (error as { code?: string }).code };
  } finally {
    await client.exec("ROLLBACK");
  }
};

let source: TestDatabase;

beforeAll(async () => {
  source = await createTestDatabase();
  await source.client.exec(`
    INSERT INTO users (id, email, email_verified, display_name, terms_version, terms_accepted_at, created_at)
    VALUES
      ('11111111-1111-4111-8111-111111111111', 'first@example.com', true, E'Zo\\u00eb "Q" O''Neil\\nline two\\ttab', 'v1',
       '2026-09-20 08:15:30.123456+00', '2026-01-02 03:04:05.678+05:30'),
      ('22222222-2222-4222-8222-222222222222', 'second@example.com', false, '', NULL, NULL, now());
    INSERT INTO accounts (user_id, provider_id, account_id, password)
    VALUES ('11111111-1111-4111-8111-111111111111', 'credential', '11111111-1111-4111-8111-111111111111', 'salt:hash');
    INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent)
    VALUES ('11111111-1111-4111-8111-111111111111', 'token-one', now() + interval '30 days', '203.0.113.0/24', 'Chrome on Windows');
    INSERT INTO rate_limits (key, count, last_request) VALUES ('203.0.113.7|/sign-in/email', 3, 9007199254740993);
    INSERT INTO pending_signups (email, password_hash, code_hash, reference, expires_at, terms_version)
    VALUES ('waiting@example.com', 'salt:hash', 'keyed-hash', 'K7Q2', now() + interval '15 minutes', 'v1'),
           ('first@example.com', NULL, 'keyed-hash-2', 'M3XP', now() + interval '15 minutes', 'v1');
    INSERT INTO known_devices (user_id, device_hash, user_agent)
    VALUES ('11111111-1111-4111-8111-111111111111', 'device-hash', 'Chrome on Windows');
    INSERT INTO auth_events (type, user_id, identifier_hash, ip_prefix, app_env)
    VALUES ('signin_succeeded', '11111111-1111-4111-8111-111111111111', NULL, '203.0.113.0/24', 'local'),
           ('signin_failed', NULL, 'identifier-hash', NULL, 'production');
    INSERT INTO abuse_counters (key, count, window_started_at, expires_at)
    VALUES ('limit-key', 2, now(), now() + interval '1 hour');
  `);
}, 180_000);

afterAll(async () => {
  await source?.close();
});

const fingerprintOf = async (client: TestDatabase["client"]) => {
  const tables = [
    "users",
    "accounts",
    "sessions",
    "verifications",
    "rate_limits",
    "pending_signups",
    "known_devices",
    "auth_events",
    "abuse_counters",
  ];
  const result: Record<string, string> = {};
  for (const table of tables) {
    const { rows } = await client.query<{ sum: string }>(
      `SELECT coalesce(md5(string_agg(to_jsonb(t)::text, '|' ORDER BY to_jsonb(t)::text)), 'empty') AS sum FROM ${table} t`,
    );
    result[table] = rows[0]?.sum ?? "";
  }
  return result;
};

describe("backup: dump, encrypt, decrypt, restore", () => {
  it("restores every row exactly, through the encrypted file, into a fresh database", async () => {
    const { text, summary } = await dumpDatabase(
      queryOf(source.client),
      "2026-09-20T09:00:00.000Z",
    );
    expect(summary.tables.map((table) => [table.qualified, table.rows])).toEqual([
      ["public.abuse_counters", 1],
      ["public.accounts", 1],
      ["public.auth_events", 2],
      ["public.known_devices", 1],
      ["public.pending_signups", 2],
      ["public.rate_limits", 1],
      ["public.sessions", 1],
      ["public.users", 2],
      ["public.verifications", 0],
    ]);
    expect(summary.migrations).toHaveLength(3);

    const file = encryptBackup(Buffer.from(text, "utf8"), "a long test passphrase", {
      createdAt: summary.createdAt,
      target: "0123456789abcdef",
    });
    const restoredText = decryptBackup(file, "a long test passphrase").plaintext.toString("utf8");
    expect(readDumpSummary(restoredText)).toEqual(summary);

    const target = await createTestDatabase();
    try {
      await restoreDatabase(queryOf(target.client), restoredText);
      expect(await fingerprintOf(target.client)).toEqual(await fingerprintOf(source.client));

      // The awkward values, spelled out: nothing rounded, shifted or re-encoded. The
      // instants are read back in UTC so the test does not depend on this machine's zone.
      const { rows } = await target.client.query<Record<string, unknown>>(
        `SELECT u.display_name,
                (u.created_at AT TIME ZONE 'UTC')::text AS created_at,
                (u.terms_accepted_at AT TIME ZONE 'UTC')::text AS accepted,
                (SELECT last_request::text FROM rate_limits) AS big
         FROM users u WHERE email = 'first@example.com'`,
      );
      expect(rows[0]).toEqual({
        display_name: 'Zoë "Q" O\'Neil\nline two\ttab',
        // Written as 03:04:05.678+05:30, which is 21:34:05.678 UTC the day before.
        created_at: "2026-01-01 21:34:05.678",
        // Microseconds survive.
        accepted: "2026-09-20 08:15:30.123456",
        // 2^53 + 1: a number JavaScript cannot hold exactly. It is never parsed in JavaScript.
        big: "9007199254740993",
      });
    } finally {
      await target.close();
    }
  }, 180_000);

  it("never overwrites: it refuses a database that already has rows, and writes nothing", async () => {
    const { text } = await dumpDatabase(queryOf(source.client), "2026-09-20T09:00:00.000Z");
    const target = await createTestDatabase();
    try {
      await target.client.exec("INSERT INTO users (email) VALUES ('already@example.com')");
      await expect(restoreDatabase(queryOf(target.client), text)).rejects.toThrow(
        /already has rows/,
      );
      const { rows } = await target.client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM accounts",
      );
      expect(rows[0]?.n).toBe(0);
    } finally {
      await target.close();
    }
  }, 180_000);

  it("refuses a target that is missing migrations, and a dump that is cut short", async () => {
    const { text } = await dumpDatabase(queryOf(source.client), "2026-09-20T09:00:00.000Z");
    const bare = new PGlite();
    try {
      await expect(restoreDatabase(queryOf(bare), text)).rejects.toThrow(
        /run the migrations on it first/,
      );
    } finally {
      await bare.close();
    }
    const target = await createTestDatabase();
    try {
      const cut = text.split("\n").slice(0, 3).join("\n") + "\n";
      await expect(restoreDatabase(queryOf(target.client), cut)).rejects.toThrow(/incomplete/);
      await expect(restoreDatabase(queryOf(target.client), "not a dump\n")).rejects.toThrow(
        /does not look like/,
      );
    } finally {
      await target.close();
    }
  }, 180_000);
});

describe("pending migrations", () => {
  const journal = parseJournal(readFileSync("drizzle/meta/_journal.json", "utf8"));

  it("lists every migration for an empty database and none once they are applied", async () => {
    const bare = new PGlite();
    try {
      expect((await pendingMigrations(queryOf(bare), journal)).map((entry) => entry.tag)).toEqual(
        journal.map((entry) => entry.tag),
      );
    } finally {
      await bare.close();
    }
    expect(await pendingMigrations(queryOf(source.client), journal)).toEqual([]);
  }, 60_000);

  it("lists only what is newer than the newest applied migration", async () => {
    const future = [...journal, { idx: 99, when: Date.now() + 60_000, tag: "0099_future" }];
    expect(
      (await pendingMigrations(queryOf(source.client), future)).map((entry) => entry.tag),
    ).toEqual(["0099_future"]);
  });

  it("starts with the hand-written role migration, so the policies after it have a role to name", () => {
    expect(journal[0]?.tag).toBe("0000_app_role");
  });
});

describe("db:check-role", () => {
  it("passes every check when connected as zerocorps_app", async () => {
    await source.asAppRole(async () => {
      const lines = await checkAppRole({
        query: queryOf(source.client),
        attemptAndRollBack: attemptOn(source.client),
      });
      expect(lines.filter((line) => line.status === "fail")).toEqual([]);
      expect(lines.filter((line) => line.status === "review")).toEqual([]);
      expect(lines.filter((line) => line.status === "pass").length).toBeGreaterThanOrEqual(12);
      expect(lines.map((line) => line.label)).toContain(
        "A real CREATE TABLE attempt is refused (rolled back either way)",
      );
    });
    const { rows } = await source.client.query(
      "SELECT to_regclass('public.zz_role_probe') AS probe",
    );
    expect(rows[0]).toEqual({ probe: null });
  }, 60_000);

  it("fails at once, with an instruction, when DATABASE_URL still uses the owner role", async () => {
    const lines = await checkAppRole({
      query: queryOf(source.client),
      attemptAndRollBack: attemptOn(source.client),
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ status: "fail", label: "Connected as zerocorps_app" });
    expect(lines[0]?.detail).toMatch(/Change its username to zerocorps_app/);
  });

  it("catches a role that was given too much", async () => {
    await source.client.exec(`
      GRANT CREATE ON SCHEMA public TO zerocorps_app;
      GRANT TRUNCATE ON public.users TO zerocorps_app;
      ALTER TABLE public.verifications DISABLE ROW LEVEL SECURITY;
      CREATE TABLE public.zz_no_policy (id integer);
    `);
    try {
      await source.asAppRole(async () => {
        const lines = await checkAppRole({
          query: queryOf(source.client),
          attemptAndRollBack: attemptOn(source.client),
        });
        const failed = lines.filter((line) => line.status === "fail").map((line) => line.label);
        expect(failed).toEqual([
          "Cannot CREATE anything in any schema",
          "A real CREATE TABLE attempt is refused (rolled back either way)",
          "Cannot TRUNCATE, add triggers to, or add foreign keys to any table",
          "Row-level security is on for every table",
          "Every table is opened to it by an explicit policy (10 tables)",
        ]);
      });
      const { rows } = await source.client.query(
        "SELECT to_regclass('public.zz_role_probe') AS probe",
      );
      expect(rows[0]).toEqual({ probe: null });
    } finally {
      await source.client.exec(`
        REVOKE CREATE ON SCHEMA public FROM zerocorps_app;
        REVOKE TRUNCATE ON public.users FROM zerocorps_app;
        ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
        DROP TABLE public.zz_no_policy;
      `);
    }
  }, 60_000);
});

describe("db:counts", () => {
  it("counts every table of the schema as zerocorps_app, and returns names and numbers only", async () => {
    const counts = await source.asAppRole(() => countRows(queryOf(source.client)));

    const schemaTables = Object.values(schema)
      .flatMap((value) => (is(value, PgTable) ? [getTableName(value)] : []))
      .sort();
    expect(counts.map((entry) => entry.table)).toEqual(schemaTables);

    expect(Object.fromEntries(counts.map((entry) => [entry.table, entry.rows]))).toEqual({
      abuse_counters: 1,
      accounts: 1,
      auth_events: 2,
      known_devices: 1,
      pending_signups: 2,
      rate_limits: 1,
      sessions: 1,
      users: 2,
      verifications: 0,
    });
    for (const entry of counts) expect(Object.keys(entry).sort()).toEqual(["rows", "table"]);
    expect(JSON.stringify(counts)).not.toMatch(/example\.com|1111|token-one/);
  }, 60_000);

  it("reports a table the role may not read, without attempting it", async () => {
    // New tables are granted to the app role by default, so the right is taken away again.
    await source.client.exec(`
      CREATE TABLE public.zz_private (id integer);
      REVOKE ALL ON public.zz_private FROM zerocorps_app;
    `);
    try {
      const counts = await source.asAppRole(() => countRows(queryOf(source.client)));
      expect(counts.find((entry) => entry.table === "zz_private")).toEqual({
        table: "zz_private",
        rows: null,
      });
      expect(counts.find((entry) => entry.table === "users")?.rows).toBe(2);
    } finally {
      await source.client.exec("DROP TABLE public.zz_private");
    }
  }, 60_000);

  it("refuses to count anything when a table name is not a plain identifier", async () => {
    await source.client.exec('CREATE TABLE public."zz; DROP TABLE users; --" (id integer)');
    try {
      await expect(countRows(queryOf(source.client))).rejects.toThrow(/unexpected name/);
      const { rows } = await source.client.query("SELECT count(*)::int AS n FROM users");
      expect(rows[0]).toEqual({ n: 2 });
    } finally {
      await source.client.exec('DROP TABLE public."zz; DROP TABLE users; --"');
    }
  }, 60_000);
});
