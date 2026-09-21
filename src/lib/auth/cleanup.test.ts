import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient } from "../../test/auth-client.ts";
import { createTestAuth, TEST_BASE_URL } from "../../test/test-auth.ts";
import { createTestDatabase, type TestDatabase } from "../../test/test-database.ts";
import type { Query } from "../backup/dump.ts";
import { deleteTestAccounts, findTestAccounts } from "../db-tools/test-accounts.ts";
import { buildSecurityTxt, runCleanup } from "./cleanup.ts";
import { keyedHash } from "./keyed-hash.ts";
import { LIMITS } from "./limits.ts";

const HMAC_SECRET = "fixture-hmac-secret-000000000000000000";
let database: TestDatabase;
const query: Query = async (text, params) =>
  (await database.client.query<Record<string, unknown>>(text, params)).rows;
const count = async (table: string) =>
  Number(
    (await database.client.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`)).rows[0]
      ?.n,
  );

beforeAll(async () => {
  database = await createTestDatabase();
}, 180_000);

afterAll(async () => {
  await database?.close();
});

describe("the daily cleanup", () => {
  it("removes only what has run out, and works as zerocorps_app", async () => {
    await database.client.exec(`
      INSERT INTO users (id, email) VALUES ('11111111-1111-4111-8111-111111111111', 'keeper@example.com');
      INSERT INTO pending_signups (email, code_hash, reference, expires_at, terms_version) VALUES
        ('old@example.com', 'h', 'AAAA', now() - interval '1 minute', 'v'),
        ('live@example.com', 'h', 'BBBB', now() + interval '10 minutes', 'v');
      INSERT INTO verifications (identifier, value, expires_at) VALUES
        ('reset-password:old', 'x', now() - interval '1 minute'),
        ('reset-password:live', 'x', now() + interval '30 minutes');
      INSERT INTO sessions (user_id, token, expires_at) VALUES
        ('11111111-1111-4111-8111-111111111111', 'expired', now() - interval '1 day'),
        ('11111111-1111-4111-8111-111111111111', 'current', now() + interval '20 days');
      INSERT INTO rate_limits (key, count, last_request) VALUES
        ('old', 1, (extract(epoch FROM now() - interval '2 days') * 1000)::bigint),
        ('fresh', 1, (extract(epoch FROM now()) * 1000)::bigint);
      INSERT INTO abuse_counters (key, count, window_started_at, expires_at) VALUES
        ('old', 3, now() - interval '2 hours', now() - interval '1 hour'),
        ('fresh', 1, now(), now() + interval '1 hour');
      INSERT INTO auth_events (type, app_env, created_at) VALUES
        ('signin_failed', 'local', now() - interval '91 days'),
        ('signin_failed', 'local', now() - interval '89 days');
      INSERT INTO known_devices (user_id, device_hash, last_seen_at) VALUES
        ('11111111-1111-4111-8111-111111111111', 'gone', now() - interval '401 days'),
        ('11111111-1111-4111-8111-111111111111', 'here', now() - interval '3 days');
    `);

    const result = await database.asAppRole(() => runCleanup(database.db));
    expect(result).toEqual({
      pendingSignups: 1,
      verifications: 1,
      sessions: 1,
      rateLimits: 1,
      abuseCounters: 1,
      authEvents: 1,
      knownDevices: 1,
    });
    for (const table of [
      "pending_signups",
      "verifications",
      "sessions",
      "rate_limits",
      "abuse_counters",
      "auth_events",
      "known_devices",
    ]) {
      expect(await count(table), table).toBe(1);
    }
    expect(await count("users")).toBe(1);

    // A second run finds nothing to do.
    expect(Object.values(await runCleanup(database.db)).every((removed) => removed === 0)).toBe(
      true,
    );
  }, 120_000);
});

describe("security.txt", () => {
  it("has the two required fields, and expires within a year", () => {
    const text = buildSecurityTxt({
      contact: "https://example.com/security/advisories/new",
      siteUrl: "https://zerocorps.org",
      now: new Date("2026-09-20T12:00:00.000Z"),
    });
    expect(text).toContain("Contact: https://example.com/security/advisories/new\n");
    expect(text).toContain("Expires: 2027-09-19T12:00:00Z\n");
    expect(text).toContain("Canonical: https://zerocorps.org/.well-known/security.txt\n");
    expect(text.endsWith("\n")).toBe(true);
  });
});

describe("the test-account cleanup", () => {
  it("removes exactly the listed addresses and everything about them, and nobody else", async () => {
    const t = createTestAuth(database);
    let ip = 1;
    const signUp = async (email: string) => {
      const client = createTestClient(t.auth, { baseUrl: TEST_BASE_URL, ip: `192.0.2.${ip++}` });
      await client.post("/email-signup/start", {
        email,
        password: "a long enough passphrase",
        acceptTerms: true,
      });
      await client.post("/email-signup/verify", { code: t.latestCode(email) });
      return client;
    };
    await signUp("owner+test@example.com");
    await signUp("real.member@example.com");
    // A failed sign-in and a sign-up left waiting, for the test address.
    const stranger = createTestClient(t.auth, { baseUrl: TEST_BASE_URL, ip: "192.0.2.200" });
    await stranger.post("/sign-in/email", {
      email: "owner+test@example.com",
      password: "not the password",
    });
    await stranger.post("/email-signup/start", {
      email: "owner+pending@example.com",
      password: "a long enough passphrase",
      acceptTerms: true,
    });

    const addresses = [
      "owner+test@example.com",
      "owner+pending@example.com",
      "never.used@example.com",
    ];
    expect(await findTestAccounts(query, addresses)).toEqual([
      { address: "owner+test@example.com", hasAccount: true, pendingSignUps: 0 },
      { address: "owner+pending@example.com", hasAccount: false, pendingSignUps: 1 },
      { address: "never.used@example.com", hasAccount: false, pendingSignUps: 0 },
    ]);

    const removed = await deleteTestAccounts(query, addresses, HMAC_SECRET);
    expect(removed.users).toBe(1);
    expect(removed.pendingSignUps).toBe(1);
    expect(removed.events).toBeGreaterThan(0);
    expect(removed.counters).toBeGreaterThan(0);

    const testHash = keyedHash(HMAC_SECRET, "event-identifier", "owner+test@example.com");
    const left = await query(
      `SELECT (SELECT count(*)::int FROM users WHERE email = 'owner+test@example.com') AS test_users,
              (SELECT count(*)::int FROM users WHERE email = 'real.member@example.com') AS real_users,
              (SELECT count(*)::int FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = 'real.member@example.com') AS real_sessions,
              (SELECT count(*)::int FROM auth_events WHERE identifier_hash = $1) AS test_events,
              (SELECT count(*)::int FROM accounts a JOIN users u ON u.id = a.user_id WHERE u.email = 'real.member@example.com') AS real_accounts,
              (SELECT count(*)::int FROM known_devices d JOIN users u ON u.id = d.user_id WHERE u.email = 'real.member@example.com') AS real_devices,
              (SELECT count(*)::int FROM known_devices d LEFT JOIN users u ON u.id = d.user_id WHERE u.id IS NULL) AS orphaned_devices`,
      [testHash],
    );
    expect(left[0]).toEqual({
      test_users: 0,
      real_users: 1,
      real_sessions: 1,
      test_events: 0,
      real_accounts: 1,
      real_devices: 1,
      orphaned_devices: 0,
    });
  }, 240_000);

  it("hashes addresses and limit names exactly as the app does", async () => {
    // test-accounts.ts cannot import the app's helpers (the script loads it directly), so
    // it carries its own copy. This proves the copy still matches: a counter the app wrote
    // is found and removed by the cleanup.
    const t = createTestAuth(database);
    const client = createTestClient(t.auth, { baseUrl: TEST_BASE_URL, ip: "192.0.2.250" });
    await client.post("/request-password-reset", { email: "owner+limits@example.com" });
    const removed = await deleteTestAccounts(query, ["owner+limits@example.com"], HMAC_SECRET);
    // The reset counter and the reset_requested event.
    expect(removed.counters).toBeGreaterThanOrEqual(1);
    expect(removed.events).toBeGreaterThanOrEqual(1);
    expect(Object.keys(LIMITS)).toEqual(
      expect.arrayContaining([
        "signUpStartPerAddress",
        "signInPerAddress",
        "passwordResetPerAddress",
        "emailsPerAddressPerDay",
      ]),
    );
  }, 120_000);
});
