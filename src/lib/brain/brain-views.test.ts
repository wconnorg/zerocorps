import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../test/test-database.ts";
import type { Query } from "../backup/dump.ts";
import {
  assertBrainRole,
  BrainReadError,
  readBrain,
  readPictures,
  type BrainData,
} from "./read.ts";

/**
 * The brain export's allowlist, enforced in the database (drizzle/0008_brain_export.sql,
 * 0009 and 0010): four views, read by a role that can read those views and nothing else.
 * Proven on a Postgres inside this process, built from the real migrations, as that very
 * role.
 */

const FIRST = "11111111-1111-4111-8111-111111111111";
const SECOND = "22222222-2222-4222-8222-222222222222";
const THIRD = "33333333-3333-4333-8333-333333333333";
/** A picture as the table allows it: a WebP header is enough for the views. */
const PICTURE_HEX = "524946460c000000574542505650382000000000";
const FIRST_VERSION = "AbCdEfGhIjKlMnOpQrSt_-";

let database: TestDatabase;
let empty: BrainData;

const queryOf =
  (client: Pick<TestDatabase["client"], "query">): Query =>
  async (text, params) =>
    (await client.query<Record<string, unknown>>(text, params)).rows;
const rows = (text: string, params?: unknown[]) => queryOf(database.client)(text, params);
const asBrain = <T>(work: () => Promise<T>) => database.asRole("brain_reader", work);

/** The Postgres error code a statement fails with, or null if it succeeds. */
async function failure(text: string): Promise<string | null> {
  try {
    await database.client.query(text);
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}

beforeAll(async () => {
  database = await createTestDatabase();
  empty = await asBrain(() => readBrain(queryOf(database.client)));
  await database.client.exec(`
    INSERT INTO users (id, email, email_verified, username, display_name, created_at) VALUES
      ('${THIRD}', 'third@example.com', true, NULL, '', '2026-09-25 23:30:00+00'),
      ('${FIRST}', 'first@example.com', true, 'first_one', 'Zoë <b>"Q"</b>', '2026-09-21 08:00:00+00'),
      -- 02:00 at +05:00 is still the 22nd in UTC.
      ('${SECOND}', 'second@example.com', true, 'second_one', '', '2026-09-23 02:00:00+05');
    INSERT INTO accounts (user_id, provider_id, account_id, password)
      VALUES ('${FIRST}', 'credential', '${FIRST}', 'salt:hash');
    INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent)
      VALUES ('${FIRST}', 'token-one', now() + interval '1 day', '203.0.113.0/24', 'Chrome on Windows');
    INSERT INTO discord_links (user_id, discord_id, discord_username)
      VALUES ('${FIRST}', '123456789012345678', 'first.discord');
    INSERT INTO lesson_progress (user_id, lesson_id, completed_at) VALUES
      -- 23:30 at -05:00 is 04:30 on the 29th in UTC.
      ('${FIRST}', 'orders-and-fills', '2026-09-28 23:30:00-05'),
      ('${FIRST}', 'what-a-market-is', '2026-09-27 10:00:00+00'),
      ('${SECOND}', 'orders-and-fills', '2026-09-29 12:00:00+00');
    INSERT INTO rank_history (user_id, rank, achieved_at)
      VALUES ('${FIRST}', 'bronze', '2026-09-29 04:31:00+00');
    -- A picture with its version beside the account, as the site saves them together.
    INSERT INTO avatars (user_id, image, content_type)
      VALUES ('${FIRST}', decode('${PICTURE_HEX}', 'hex'), 'image/webp'),
             ('${THIRD}', decode('${PICTURE_HEX}', 'hex'), 'image/webp');
    UPDATE users SET avatar_url = '${FIRST_VERSION}' WHERE id = '${FIRST}';
    -- A version with no picture behind it, and a picture whose version is not one.
    UPDATE users SET avatar_url = 'ZyXwVuTsRqPoNmLkJiHgFe' WHERE id = '${SECOND}';
    UPDATE users SET avatar_url = '../escape' WHERE id = '${THIRD}';
  `);
}, 180_000);

afterAll(async () => {
  await database?.close();
});

describe("brain_reader", () => {
  it("exists, cannot log in until the owner sets it up, and holds nothing special", async () => {
    expect(
      await rows(
        `SELECT rolcanlogin, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
           FROM pg_roles WHERE rolname = 'brain_reader'`,
      ),
    ).toEqual([
      {
        rolcanlogin: false,
        rolsuper: false,
        rolinherit: false,
        rolcreaterole: false,
        rolcreatedb: false,
        rolreplication: false,
        rolbypassrls: false,
      },
    ]);
    expect(
      await rows(
        `SELECT count(*)::int AS n FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member
          WHERE r.rolname = 'brain_reader'`,
      ),
    ).toEqual([{ n: 0 }]);
    const [settings] = await rows(
      `SELECT s.setconfig FROM pg_db_role_setting s JOIN pg_roles r ON r.oid = s.setrole
        WHERE r.rolname = 'brain_reader'`,
    );
    expect(settings?.setconfig).toEqual(
      expect.arrayContaining(["default_transaction_read_only=on", "statement_timeout=30s"]),
    );
  });

  it("reads four views that hold exactly the allowlist, and nothing more", async () => {
    expect(
      await rows(
        `SELECT table_name, table_type FROM information_schema.tables
          WHERE table_schema = 'brain' ORDER BY table_name`,
      ),
    ).toEqual([
      { table_name: "lessons_completed", table_type: "VIEW" },
      { table_name: "member_pictures", table_type: "VIEW" },
      { table_name: "members", table_type: "VIEW" },
      { table_name: "rank_steps", table_type: "VIEW" },
    ]);
    const columns = await rows(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'brain' ORDER BY table_name, ordinal_position`,
    );
    const byView = (view: string) =>
      columns.filter((column) => column.table_name === view).map((column) => column.column_name);
    // Adding a column to any view must be a deliberate change to this list.
    expect(byView("members")).toEqual([
      "member_number",
      "user_id",
      "username",
      "display_name",
      "joined_on",
      "discord_username",
      "email",
      "picture_version",
    ]);
    expect(byView("lessons_completed")).toEqual(["user_id", "lesson_id", "completed_on"]);
    expect(byView("rank_steps")).toEqual(["user_id", "step", "achieved_on"]);
    expect(byView("member_pictures")).toEqual(["user_id", "image"]);
  });

  it("can read no table of the app, write nothing and create nothing", async () => {
    const tables = (
      await rows("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1")
    ).map((row) => String(row.tablename));
    expect(tables).toContain("users");
    await asBrain(async () => {
      expect(await failure("SELECT count(*) FROM brain.members")).toBeNull();
      for (const table of tables) {
        expect(await failure(`SELECT 1 FROM public.${table} LIMIT 1`), table).toBe("42501");
      }
      expect(
        await failure(
          `INSERT INTO brain.lessons_completed (user_id, lesson_id) VALUES ('${THIRD}', 'orders-and-fills')`,
        ),
      ).toBe("42501");
      // Not even writable in principle: its window function and join make it read-only.
      expect(await failure("UPDATE brain.members SET username = 'taken_over'")).toBe("55000");
      expect(await failure("DELETE FROM brain.rank_steps")).toBe("42501");
      // The pictures' view could be written through in principle; the role may not.
      expect(await failure("UPDATE brain.member_pictures SET image = '\\x00'")).toBe("42501");
      expect(await failure("DELETE FROM brain.member_pictures")).toBe("42501");
      expect(await failure("CREATE TABLE brain.zz_probe (id integer)")).toBe("42501");
      expect(await failure("CREATE TABLE public.zz_probe (id integer)")).toBe("42501");
    });
  });

  it("is the only role given the views: the app's own role and everyone else get nothing", async () => {
    await database.asAppRole(async () => {
      expect(await failure("SELECT 1 FROM brain.members")).toBe("42501");
    });
    expect(
      await rows(
        `SELECT DISTINCT grantee FROM information_schema.role_table_grants
          WHERE table_schema = 'brain' AND grantee <> current_user ORDER BY 1`,
      ),
    ).toEqual([{ grantee: "brain_reader" }]);
  });
});

describe("readBrain, as brain_reader", () => {
  it("answers empty lists for an empty database", () => {
    expect(empty).toEqual({ members: [], completions: [], steps: [] });
  });

  it("numbers accounts by when they were made and dates everything by UTC day", async () => {
    const brain = await asBrain(() => readBrain(queryOf(database.client), { academy: true }));
    expect(brain.members).toEqual([
      {
        memberNumber: 1,
        userId: FIRST,
        username: "first_one",
        displayName: 'Zoë <b>"Q"</b>',
        joinedOn: "2026-09-21",
        discordUsername: "first.discord",
        email: "first@example.com",
        pictureVersion: FIRST_VERSION,
      },
      {
        memberNumber: 2,
        userId: SECOND,
        username: "second_one",
        displayName: null,
        joinedOn: "2026-09-22",
        discordUsername: null,
        email: "second@example.com",
        // A version with no picture behind it is no picture.
        pictureVersion: null,
      },
      {
        memberNumber: 3,
        userId: THIRD,
        username: null,
        displayName: null,
        joinedOn: "2026-09-25",
        discordUsername: null,
        email: "third@example.com",
        // A version that is not in the site's own format never names a file.
        pictureVersion: null,
      },
    ]);
    expect(brain.completions).toHaveLength(3);
    expect(brain.completions).toEqual(
      expect.arrayContaining([
        { userId: FIRST, lessonId: "what-a-market-is", completedOn: "2026-09-27" },
        { userId: FIRST, lessonId: "orders-and-fills", completedOn: "2026-09-29" },
        { userId: SECOND, lessonId: "orders-and-fills", completedOn: "2026-09-29" },
      ]),
    );
    expect(brain.steps).toEqual([{ userId: FIRST, step: "bronze", achievedOn: "2026-09-29" }]);
    // The address came (owner, 2026-10-01); nothing about signing in did.
    expect(JSON.stringify(brain)).not.toMatch(/token-one|salt:hash|203\.0\.113|Chrome/);
  });

  it("reads no lessons and no ranks for the members' list, the default", async () => {
    const brain = await asBrain(() => readBrain(queryOf(database.client)));
    expect(brain.members).toHaveLength(3);
    expect(brain.completions).toEqual([]);
    expect(brain.steps).toEqual([]);
  });

  it("reads the pictures asked for, and only those", async () => {
    const pictures = await asBrain(() => readPictures(queryOf(database.client), [FIRST, SECOND]));
    expect([...pictures.keys()]).toEqual([FIRST]);
    expect(pictures.get(FIRST)?.toString("hex")).toBe(PICTURE_HEX);
    // Nothing asked for: nothing read.
    expect(
      await asBrain(() =>
        readPictures(async () => {
          throw new Error("no statement should run");
        }, []),
      ),
    ).toEqual(new Map());
  });

  it("moves later accounts up when an earlier one is deleted", async () => {
    await database.client.transaction(async (transaction) => {
      await transaction.query(`DELETE FROM users WHERE id = '${FIRST}'`);
      await transaction.exec("SET LOCAL ROLE brain_reader");
      const brain = await readBrain(queryOf(transaction), { academy: true });
      expect(brain.members.map((member) => [member.memberNumber, member.userId])).toEqual([
        [1, SECOND],
        [2, THIRD],
      ]);
      // The deleted account's progress and picture went with it.
      expect(brain.completions.every((completion) => completion.userId !== FIRST)).toBe(true);
      expect([...(await readPictures(queryOf(transaction), [FIRST])).keys()]).toEqual([]);
      await transaction.rollback();
    });
    expect(await rows(`SELECT count(*)::int AS n FROM users`)).toEqual([{ n: 3 }]);
  });

  it("says a migration is waiting when the views are older than the command", async () => {
    await database.client.transaction(async (transaction) => {
      // The view as 0008 made it, before 0009 added the email.
      await transaction.exec(`
        DROP VIEW brain.members;
        CREATE VIEW brain.members AS
          SELECT 1 AS member_number, u.id AS user_id, u.username, u.display_name,
                 u.created_at::date AS joined_on, NULL::text AS discord_username
            FROM public.users u;
        GRANT SELECT ON brain.members TO brain_reader;
        SET LOCAL ROLE brain_reader;
      `);
      await expect(readBrain(queryOf(transaction))).rejects.toThrow(
        /migration is waiting\. Apply it once the release that needs it is live.*npm run db:migrate/,
      );
      await transaction.rollback();
    });
    await expect(asBrain(() => readBrain(queryOf(database.client)))).resolves.toMatchObject({
      members: expect.any(Array),
    });
  });

  it("binds the pictures' list as text, which postgres.js sends as it is", async () => {
    // postgres.js would JSON.stringify a parameter the server reports as jsonb a second
    // time; PGlite does not, so only the statement itself can show it.
    const seen: { text: string; params?: unknown[] }[] = [];
    await readPictures(
      async (text, params) => {
        seen.push({ text, params });
        return [];
      },
      [FIRST],
    );
    expect(seen[0]?.text).toContain("$1::text::jsonb");
    expect(seen[0]?.params).toEqual([JSON.stringify([FIRST])]);
  });
});

describe("assertBrainRole", () => {
  it("passes as brain_reader, and says the pictures can be read", async () => {
    await expect(asBrain(() => assertBrainRole(queryOf(database.client)))).resolves.toEqual({
      pictures: true,
    });
  });

  it("builds the members' list without pictures until 0010 is applied", async () => {
    await database.client.transaction(async (transaction) => {
      // The database as 0009 left it: no pictures' view, no picture_version.
      await transaction.exec(`
        DROP VIEW brain.member_pictures;
        DROP VIEW brain.members;
        CREATE VIEW brain.members AS
          SELECT (row_number() OVER (ORDER BY u.created_at, u.id))::integer AS member_number,
                 u.id AS user_id, u.username, NULLIF(u.display_name, '') AS display_name,
                 (u.created_at AT TIME ZONE 'UTC')::date AS joined_on,
                 NULL::text AS discord_username, u.email
            FROM public.users u;
        GRANT SELECT ON brain.members TO brain_reader;
        SET LOCAL ROLE brain_reader;
      `);
      const query = queryOf(transaction);
      expect(await assertBrainRole(query)).toEqual({ pictures: false });
      const brain = await readBrain(query, { pictures: false });
      expect(brain.members).toHaveLength(3);
      expect(brain.members.every((member) => member.pictureVersion === null)).toBe(true);
      await transaction.rollback();
    });
  });

  it("says a migration is waiting when a view it cannot do without is missing", async () => {
    await database.client.transaction(async (transaction) => {
      await transaction.exec("DROP VIEW brain.rank_steps; SET LOCAL ROLE brain_reader;");
      await expect(assertBrainRole(queryOf(transaction))).rejects.toThrow(
        /migration is waiting.*npm run db:migrate/,
      );
      await transaction.rollback();
    });
    await expect(asBrain(() => assertBrainRole(queryOf(database.client)))).resolves.toEqual({
      pictures: true,
    });
  });

  it("refuses any other role, the app's own and the owner's included", async () => {
    await expect(assertBrainRole(queryOf(database.client))).rejects.toThrow(
      /does not connect as brain_reader/,
    );
    await expect(
      database.asAppRole(() => assertBrainRole(queryOf(database.client))),
    ).rejects.toBeInstanceOf(BrainReadError);
  });

  it("refuses brain_reader once it could read more than the allowlist", async () => {
    await database.client.exec("GRANT SELECT ON public.users TO brain_reader");
    try {
      await expect(asBrain(() => assertBrainRole(queryOf(database.client)))).rejects.toThrow(
        /can read 1 table\(s\) outside the brain's views/,
      );
    } finally {
      await database.client.exec("REVOKE SELECT ON public.users FROM brain_reader");
    }
    await database.client.exec("GRANT zerocorps_app TO brain_reader");
    try {
      await expect(asBrain(() => assertBrainRole(queryOf(database.client)))).rejects.toThrow(
        /belongs to another role/,
      );
    } finally {
      await database.client.exec("REVOKE zerocorps_app FROM brain_reader");
    }
    await expect(asBrain(() => assertBrainRole(queryOf(database.client)))).resolves.toEqual({
      pictures: true,
    });
  });
});
