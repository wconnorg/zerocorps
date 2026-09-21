import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../test/test-database.ts";
import { createEventLog } from "./events.ts";
import { createEmailBudget, createLimiter, LIMITS } from "./limits.ts";

const SECRET = "fixture-hmac-secret-000000000000000000";
let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
}, 180_000);

afterAll(async () => {
  await database?.close();
});

describe("the per-address limiter", () => {
  it("allows up to the maximum, then refuses, and says when to come back", async () => {
    const limiter = createLimiter(database.db, SECRET);
    const max = LIMITS.passwordResetPerAddress.max;
    for (let use = 1; use <= max; use++) {
      expect(await limiter.hit("passwordResetPerAddress", "member@example.com")).toMatchObject({
        allowed: true,
        count: use,
      });
    }
    const refused = await limiter.hit("passwordResetPerAddress", "member@example.com");
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThan(3500);
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(3600);
  }, 60_000);

  it("counts each address and each rule separately", async () => {
    const limiter = createLimiter(database.db, SECRET);
    expect((await limiter.hit("passwordResetPerAddress", "other@example.com")).count).toBe(1);
    expect((await limiter.hit("signInPerAddress", "member@example.com")).count).toBe(1);
  });

  it("starts a fresh window once the old one has expired", async () => {
    const limiter = createLimiter(database.db, SECRET);
    for (let use = 0; use < 5; use++)
      await limiter.hit("signUpStartPerAddress", "window@example.com");
    expect((await limiter.hit("signUpStartPerAddress", "window@example.com")).allowed).toBe(false);
    await database.client.exec(
      "UPDATE abuse_counters SET expires_at = now() - interval '1 second'",
    );
    expect(await limiter.hit("signUpStartPerAddress", "window@example.com")).toMatchObject({
      allowed: true,
      count: 1,
    });
  });

  it("stores no address in the clear, and keys differ between the laptop and the live site", async () => {
    const limiter = createLimiter(database.db, SECRET);
    const live = createLimiter(database.db, "a-different-hmac-secret-for-the-live-site");
    await limiter.hit("signInPerAddress", "clear@example.com");
    expect((await live.hit("signInPerAddress", "clear@example.com")).count).toBe(1);
    const { rows } = await database.client.query<{ key: string }>("SELECT key FROM abuse_counters");
    expect(rows.length).toBeGreaterThan(3);
    for (const row of rows) {
      expect(row.key).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(row.key).not.toContain("example");
    }
  });

  it("works as zerocorps_app, the role the app really connects as", async () => {
    await database.asAppRole(async () => {
      const limiter = createLimiter(database.db, SECRET);
      expect((await limiter.hit("signUpStartPerIp", "203.0.113.9")).allowed).toBe(true);
    });
  });

  it("fails closed: if the counter cannot be written, it throws and never says 'allowed'", async () => {
    const broken = await createTestDatabase();
    const limiter = createLimiter(broken.db, SECRET);
    await broken.close();
    await expect(limiter.hit("signInPerAddress", "member@example.com")).rejects.toThrow();
  }, 120_000);
});

describe("the daily email cap", () => {
  it("holds back ordinary email past the cap but never a security notice", async () => {
    const budget = createEmailBudget(createLimiter(database.db, SECRET));
    const max = LIMITS.emailsPerAddressPerDay.max;
    for (let sent = 0; sent < max; sent++) {
      expect(await budget.allow("capped@example.com", "signup-code")).toBe(true);
    }
    expect(await budget.allow("capped@example.com", "signup-code")).toBe(false);
    expect(await budget.allow("capped@example.com", "password-reset")).toBe(false);
    expect(await budget.allow("capped@example.com", "already-registered")).toBe(false);
    expect(await budget.allow("capped@example.com", "password-changed")).toBe(true);
    expect(await budget.allow("capped@example.com", "new-device")).toBe(true);
  }, 60_000);
});

describe("the event log", () => {
  it("stores hashes, a coarse prefix and a browser family, and never the address or the raw IP", async () => {
    const events = createEventLog(database.db, {
      appEnv: "local",
      hmacSecret: SECRET,
      trustedIpHeader: "x-forwarded-for",
    });
    await events.record({
      type: "signin_failed",
      identifier: " Member@Example.com ",
      detail: "invalid_credentials",
      headers: new Headers({
        "x-forwarded-for": "203.0.113.77",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 Safari/537.36 <script>",
      }),
    });
    await events.record({ type: "signin_failed", identifier: "member@example.com" });

    const { rows } = await database.client.query<Record<string, unknown>>(
      "SELECT * FROM auth_events WHERE type = 'signin_failed' ORDER BY created_at",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      user_id: null,
      ip_prefix: "203.0.113.0/24",
      user_agent: "Chrome on Windows",
      detail: "invalid_credentials",
      app_env: "local",
    });
    // The same address, normalised, hashes the same: events can be grouped without being readable.
    expect(rows[0]?.identifier_hash).toBe(rows[1]?.identifier_hash);
    const stored = JSON.stringify(rows);
    expect(stored).not.toMatch(/member@example\.com/i);
    expect(stored).not.toContain("203.0.113.77");
    expect(stored).not.toContain("script");
  });

  it("never throws: a logging failure must not take a working sign-in down", async () => {
    const broken = await createTestDatabase();
    const events = createEventLog(broken.db, {
      appEnv: "local",
      hmacSecret: SECRET,
      trustedIpHeader: "x-forwarded-for",
    });
    await broken.close();
    await expect(events.record({ type: "signin_failed" })).resolves.toBeUndefined();
  }, 120_000);
});
