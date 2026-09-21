import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestClient, type TestClient } from "../../test/auth-client.ts";
import { createTestAuth, TEST_BASE_URL, type TestAuth } from "../../test/test-auth.ts";
import { createTestDatabase, type TestDatabase } from "../../test/test-database.ts";
import { keyedHash } from "./keyed-hash.ts";
import { createLimiter, LIMITS } from "./limits.ts";

/**
 * The email-code sign-up, tested as an attacker would use it. Every test here goes
 * through real HTTP requests to the real configuration, on a Postgres inside this
 * process built from the real migration files.
 */

const HMAC_SECRET = "fixture-hmac-secret-000000000000000000";
const VICTIM_PASSWORD = "the victim chose this passphrase";
const ATTACKER_PASSWORD = "the attacker chose this passphrase";

let database: TestDatabase;
let t: TestAuth;
let nextIp = 1;

beforeAll(async () => {
  database = await createTestDatabase();
  t = createTestAuth(database);
}, 180_000);

afterAll(async () => {
  await database?.close();
});

beforeEach(async () => {
  // Each test gets fresh limits, so one test's sign-ups never throttle another's.
  await database.client.exec("DELETE FROM abuse_counters; DELETE FROM rate_limits;");
});

/** A separate browser: its own cookies and its own address. */
const browser = (auth = t.auth, extra: Partial<Parameters<typeof createTestClient>[1]> = {}) =>
  createTestClient(auth, { baseUrl: TEST_BASE_URL, ip: `198.51.100.${nextIp++}`, ...extra });

const start = (client: TestClient, email: string, password = VICTIM_PASSWORD) =>
  client.post("/email-signup/start", { email, password, acceptTerms: true });
const verify = (client: TestClient, code: string) => client.post("/email-signup/verify", { code });
const signIn = (client: TestClient, email: string, password: string) =>
  client.post("/sign-in/email", { email, password });

const count = async (sqlText: string, params: unknown[] = []) =>
  Number((await database.client.query<{ n: number }>(sqlText, params)).rows[0]?.n);
const usersWith = (email: string) =>
  count("SELECT count(*)::int AS n FROM users WHERE email = $1", [email]);
const pendingFor = (email: string) =>
  count("SELECT count(*)::int AS n FROM pending_signups WHERE email = $1", [email]);
const wrongCodeFor = (code: string) => (code === "000000" ? "000001" : "000000");

/** Signs an address up completely and returns the browser that did it. */
async function signUp(email: string, password = VICTIM_PASSWORD) {
  const client = browser();
  expect((await start(client, email, password)).status).toBe(200);
  expect((await verify(client, t.latestCode(email))).status).toBe(200);
  return client;
}

describe("nothing exists until the code is correct", () => {
  it("writes no user at the start, and a verified user with a session once the code is right", async () => {
    const client = browser();
    const started = await start(client, "new@example.com");
    expect(started.status).toBe(200);
    expect(Object.keys(started.json ?? {}).sort()).toEqual([
      "attemptsLeft",
      "email",
      "expiresAt",
      "reference",
      "resendAvailableAt",
      "sendsLeft",
    ]);
    expect(started.json).toMatchObject({
      email: "n***@example.com",
      attemptsLeft: 5,
      sendsLeft: 2,
    });
    expect(await usersWith("new@example.com")).toBe(0);
    expect(await pendingFor("new@example.com")).toBe(1);

    const email = t.sentTo("signup-code", "new@example.com").at(-1);
    expect(email?.code).toMatch(/^\d{6}$/);
    expect(email?.expiresInMinutes).toBe(15);
    // The reference on the screen is the one in the email, so two emails can be told apart.
    expect(email?.reference).toBe(started.json?.reference);

    expect((await verify(client, email?.code ?? "")).status).toBe(200);
    const { rows } = await database.client.query<Record<string, unknown>>(
      "SELECT email_verified, display_name, terms_version, terms_accepted_at FROM users WHERE email = $1",
      ["new@example.com"],
    );
    expect(rows[0]).toMatchObject({
      email_verified: true,
      display_name: "",
      terms_version: "test-1",
    });
    expect(rows[0]?.terms_accepted_at).toBeInstanceOf(Date);
    expect((await client.get("/get-session")).json).toMatchObject({
      user: { email: "new@example.com" },
    });
    expect(await pendingFor("new@example.com")).toBe(0);
    expect((await client.get("/email-signup/status")).json).toEqual({ pending: false });
  }, 120_000);

  it("stores the code only as a keyed hash, and the pending id only in a signed httpOnly cookie", async () => {
    const client = browser();
    const started = await start(client, "stored@example.com");
    const code = t.latestCode("stored@example.com");
    const { rows } = await database.client.query<Record<string, string>>(
      "SELECT id, code_hash, password_hash FROM pending_signups WHERE email = $1",
      ["stored@example.com"],
    );
    expect(JSON.stringify(rows)).not.toContain(code);
    expect(JSON.stringify(rows)).not.toContain(VICTIM_PASSWORD);
    expect(rows[0]?.code_hash).toBe(
      keyedHash(HMAC_SECRET, "signup-code", `${rows[0]?.id}:${code}`),
    );

    const cookie = started.setCookies.find((line) => line.startsWith("zc.signup_pending=")) ?? "";
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=900/i);
    expect(cookie).not.toMatch(/Domain=/i);
  }, 60_000);

  it("requires the terms, a real address and a password of 12 to 128 characters", async () => {
    const client = browser();
    const post = (body: Record<string, unknown>) => client.post("/email-signup/start", body);
    const good = { email: "rules@example.com", password: VICTIM_PASSWORD, acceptTerms: true };
    expect((await post({ ...good, acceptTerms: false })).json).toMatchObject({
      code: "TERMS_NOT_ACCEPTED",
    });
    expect((await post({ ...good, email: "not an address" })).json).toMatchObject({
      code: "INVALID_EMAIL",
    });
    expect((await post({ ...good, password: "short" })).json).toMatchObject({
      code: "PASSWORD_TOO_SHORT",
    });
    expect((await post({ ...good, password: "x".repeat(129) })).json).toMatchObject({
      code: "PASSWORD_TOO_LONG",
    });
    expect(await pendingFor("rules@example.com")).toBe(0);
    expect(client.cookies.size).toBe(0);
  }, 60_000);

  it("uses one normalised form of the address everywhere: trimmed and lower-cased", async () => {
    const client = browser();
    expect((await start(client, "  Mixed.Case@Example.COM ")).status).toBe(200);
    expect((await verify(client, t.latestCode("mixed.case@example.com"))).status).toBe(200);
    expect(await usersWith("mixed.case@example.com")).toBe(1);
    expect((await signIn(browser(), "MIXED.case@example.com", VICTIM_PASSWORD)).status).toBe(200);
  }, 120_000);
});

describe("an attacker who knows the victim's address", () => {
  it("cannot finish a sign-up for it, and the victim then signs up with their own password", async () => {
    const attacker = browser();
    expect((await start(attacker, "victim@example.com", ATTACKER_PASSWORD)).status).toBe(200);
    const mailedToVictim = t.latestCode("victim@example.com");

    // The code is in the victim's mailbox, not the attacker's: all the attacker can do is guess.
    for (let guess = 1; guess <= 4; guess++) {
      expect((await verify(attacker, wrongCodeFor(mailedToVictim))).json).toMatchObject({
        code: "INVALID_CODE",
        attemptsLeft: 5 - guess,
      });
    }
    expect((await verify(attacker, wrongCodeFor(mailedToVictim))).json).toMatchObject({
      code: "TOO_MANY_ATTEMPTS",
    });
    // Five wrong attempts kill the row: now even the right code is refused.
    expect((await verify(attacker, mailedToVictim)).json).toMatchObject({
      code: "TOO_MANY_ATTEMPTS",
    });
    expect(await usersWith("victim@example.com")).toBe(0);

    const victim = browser();
    expect((await start(victim, "victim@example.com", VICTIM_PASSWORD)).status).toBe(200);
    expect((await verify(victim, t.latestCode("victim@example.com"))).status).toBe(200);
    expect((await signIn(browser(), "victim@example.com", ATTACKER_PASSWORD)).status).toBe(401);
    expect((await signIn(browser(), "victim@example.com", VICTIM_PASSWORD)).status).toBe(200);
  }, 180_000);

  it("cannot cancel the victim's sign-up or get verified by starting another one after it", async () => {
    const victim = browser();
    const victimStart = await start(victim, "raced@example.com", VICTIM_PASSWORD);
    const victimCode = t.latestCode("raced@example.com");

    const attacker = browser();
    await start(attacker, "raced@example.com", ATTACKER_PASSWORD);
    const attackerTriggeredCode = t.latestCode("raced@example.com");
    expect(await pendingFor("raced@example.com")).toBe(2);

    // The victim now holds two emails. The newer code was triggered by the attacker, and
    // on the victim's screen it is simply wrong: a code belongs to one browser's sign-up.
    if (attackerTriggeredCode !== victimCode) {
      expect((await verify(victim, attackerTriggeredCode)).json).toMatchObject({
        code: "INVALID_CODE",
      });
    }
    // The reference tells the victim which email is theirs.
    const emails = t.sentTo("signup-code", "raced@example.com").slice(-2);
    expect(emails[0]?.reference).toBe(victimStart.json?.reference);
    expect(emails[1]?.reference).not.toBe(victimStart.json?.reference);

    // The victim's own code still works.
    expect((await verify(victim, victimCode)).status).toBe(200);

    // Success removed EVERY pending row for the address, the attacker's included.
    expect(await pendingFor("raced@example.com")).toBe(0);
    expect((await verify(attacker, attackerTriggeredCode)).json).toMatchObject({
      code: "NO_PENDING_SIGNUP",
    });
    expect((await signIn(browser(), "raced@example.com", ATTACKER_PASSWORD)).status).toBe(401);
    expect((await signIn(browser(), "raced@example.com", VICTIM_PASSWORD)).status).toBe(200);
  }, 180_000);

  it("gets nowhere with a code and an address but no cookie: a code is never accepted by email alone", async () => {
    const victim = browser();
    await start(victim, "alone@example.com");
    const code = t.latestCode("alone@example.com");
    const { rows } = await database.client.query<{ id: string }>(
      "SELECT id FROM pending_signups WHERE email = $1",
      ["alone@example.com"],
    );

    const noCookie = browser();
    expect(
      (await noCookie.post("/email-signup/verify", { code, email: "alone@example.com" })).json,
    ).toMatchObject({
      code: "NO_PENDING_SIGNUP",
    });

    // Knowing the pending id is not enough either: the cookie is signed with the server's secret.
    const forged = browser();
    forged.cookies.set("zc.signup_pending", rows[0]?.id ?? "");
    expect((await verify(forged, code)).json).toMatchObject({ code: "NO_PENDING_SIGNUP" });
    forged.cookies.set(
      "zc.signup_pending",
      `${rows[0]?.id}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA%3D`,
    );
    expect((await verify(forged, code)).json).toMatchObject({ code: "NO_PENDING_SIGNUP" });

    expect(await usersWith("alone@example.com")).toBe(0);
    expect((await verify(victim, code)).status).toBe(200);
  }, 120_000);

  it("cannot plant a sign-up in the victim's browser from another site", async () => {
    // A script on another site: the browser sends its Origin.
    const crossSiteFetch = browser(t.auth, { origin: "https://evil.example" });
    const fetched = await start(crossSiteFetch, "planted@example.com", ATTACKER_PASSWORD);
    expect(fetched.status).toBe(403);

    // A form on another site that submits itself: a cross-site navigation, no JSON, no preflight.
    const crossSiteForm = browser(t.auth, {
      origin: "https://evil.example",
      headers: {
        "sec-fetch-site": "cross-site",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
      },
    });
    const submitted = await crossSiteForm.postForm("/email-signup/start", {
      email: "planted@example.com",
      password: ATTACKER_PASSWORD,
      acceptTerms: "true",
    });
    expect([403, 415]).toContain(submitted.status);

    for (const response of [fetched, submitted]) expect(response.setCookies).toEqual([]);
    expect(crossSiteFetch.cookies.size + crossSiteForm.cookies.size).toBe(0);
    expect(await pendingFor("planted@example.com")).toBe(0);
  }, 60_000);

  it("is refused once the code has expired", async () => {
    const client = browser();
    await start(client, "expired@example.com");
    const code = t.latestCode("expired@example.com");
    await database.client.query(
      "UPDATE pending_signups SET expires_at = now() - interval '1 second' WHERE email = $1",
      ["expired@example.com"],
    );
    expect((await verify(client, code)).json).toMatchObject({ code: "CODE_EXPIRED" });
    expect((await client.get("/email-signup/status")).json).toEqual({ pending: false });
    expect(await usersWith("expired@example.com")).toBe(0);
  }, 60_000);

  it("is throttled per address, with the same refusal whether or not the address has an account", async () => {
    await signUp("member@example.com");
    await database.client.exec("DELETE FROM abuse_counters; DELETE FROM rate_limits;");
    for (const email of ["member@example.com", "stranger@example.com"]) {
      for (let use = 0; use < LIMITS.signUpStartPerAddress.max; use++) {
        expect((await start(browser(), email, ATTACKER_PASSWORD)).status).toBe(200);
      }
    }
    const registered = await start(browser(), "member@example.com", ATTACKER_PASSWORD);
    const unregistered = await start(browser(), "stranger@example.com", ATTACKER_PASSWORD);
    expect(registered.status).toBe(429);
    expect(registered.json).toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect({ ...unregistered.json, retryAfterSeconds: 0 }).toEqual({
      ...registered.json,
      retryAfterSeconds: 0,
    });
  }, 240_000);
});

describe("an address that already has an account", () => {
  it("gets the same answer and the same code screen, creates nothing, and hears about it by email", async () => {
    await signUp("taken@example.com", VICTIM_PASSWORD);
    const codesBefore = t.sentTo("signup-code", "taken@example.com").length;

    const fresh = await start(browser(), "untaken@example.com", ATTACKER_PASSWORD);
    const prober = browser();
    const taken = await start(prober, "taken@example.com", ATTACKER_PASSWORD);

    // Indistinguishable from outside: same status, same fields, same cookie.
    expect(taken.status).toBe(fresh.status);
    expect(Object.keys(taken.json ?? {}).sort()).toEqual(Object.keys(fresh.json ?? {}).sort());
    expect(taken.json).toMatchObject({ attemptsLeft: 5, sendsLeft: 2 });
    const cookieShape = (lines: string[]) =>
      lines.map((line) => line.replace(/=[^;]*/, "=<value>")).sort();
    expect(cookieShape(taken.setCookies)).toEqual(cookieShape(fresh.setCookies));

    // No code was sent: the address got a "you already have an account" note instead.
    expect(t.sentTo("signup-code", "taken@example.com")).toHaveLength(codesBefore);
    expect(t.sentTo("already-registered", "taken@example.com")).toHaveLength(1);

    // The row holds no password and can never create anything.
    const { rows } = await database.client.query<{
      id: string;
      password_hash: string | null;
      code_hash: string;
    }>("SELECT id, password_hash, code_hash FROM pending_signups WHERE email = $1", [
      "taken@example.com",
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.password_hash).toBeNull();

    // The code screen behaves exactly as it does for a wrong code on a real sign-up.
    expect((await verify(prober, "000000")).json).toMatchObject({
      code: "INVALID_CODE",
      attemptsLeft: 4,
    });

    // Even the code that was never sent, found here by brute force with the server's
    // secret, which no attacker has, does not complete anything.
    let neverSent = "";
    for (let guess = 0; guess < 1_000_000 && !neverSent; guess++) {
      const candidate = String(guess).padStart(6, "0");
      if (
        keyedHash(HMAC_SECRET, "signup-code", `${rows[0]?.id}:${candidate}`) === rows[0]?.code_hash
      ) {
        neverSent = candidate;
      }
    }
    expect(neverSent).toMatch(/^\d{6}$/);
    expect((await verify(prober, neverSent)).json).toMatchObject({ code: "INVALID_CODE" });

    expect(await usersWith("taken@example.com")).toBe(1);
    expect((await signIn(browser(), "taken@example.com", ATTACKER_PASSWORD)).status).toBe(401);
    expect((await signIn(browser(), "taken@example.com", VICTIM_PASSWORD)).status).toBe(200);
  }, 240_000);
});

describe("resending a code", () => {
  it("waits 60 seconds, replaces the code, keeps the attempts, and stops after three sends", async () => {
    const client = browser();
    await start(client, "resend@example.com");
    const first = t.latestCode("resend@example.com");
    expect((await verify(client, wrongCodeFor(first))).json).toMatchObject({ attemptsLeft: 4 });

    const tooSoon = await client.post("/email-signup/resend");
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.json).toMatchObject({ code: "RESEND_TOO_SOON" });
    expect(Number(tooSoon.json?.retryAfterSeconds)).toBeGreaterThan(50);

    const waitOutCooldown = () =>
      database.client.query(
        "UPDATE pending_signups SET last_sent_at = now() - interval '61 seconds' WHERE email = $1",
        ["resend@example.com"],
      );

    await waitOutCooldown();
    const second = await client.post("/email-signup/resend");
    expect(second.status).toBe(200);
    // A resend does not hand back the attempts that were used.
    expect(second.json).toMatchObject({ sendsLeft: 1, attemptsLeft: 4 });
    const secondCode = t.latestCode("resend@example.com");
    if (secondCode !== first) {
      expect((await verify(client, first)).json).toMatchObject({
        code: "INVALID_CODE",
        attemptsLeft: 3,
      });
    }

    await waitOutCooldown();
    expect((await client.post("/email-signup/resend")).json).toMatchObject({ sendsLeft: 0 });
    await waitOutCooldown();
    expect((await client.post("/email-signup/resend")).json).toMatchObject({
      code: "RESEND_LIMIT",
    });
    expect(t.sentTo("signup-code", "resend@example.com")).toHaveLength(3);

    expect((await verify(client, t.latestCode("resend@example.com"))).status).toBe(200);
  }, 120_000);

  it("stops sending, without saying so, once an address has had ten emails in a day", async () => {
    const limiter = createLimiter(database.db, HMAC_SECRET);
    for (let sent = 0; sent < LIMITS.emailsPerAddressPerDay.max; sent++) {
      await limiter.hit("emailsPerAddressPerDay", "flooded@example.com");
    }
    const before = t.outbox.length;
    const started = await start(browser(), "flooded@example.com");
    expect(started.status).toBe(200);
    expect(started.json).toMatchObject({ attemptsLeft: 5 });
    expect(t.outbox.length).toBe(before);
    expect(
      await count(
        "SELECT count(*)::int AS n FROM auth_events WHERE type = 'rate_limited' AND detail = 'emails_per_day'",
      ),
    ).toBeGreaterThan(0);
  }, 60_000);
});

describe("SIGNUP_MODE, enforced on the server at the start and at the code check", () => {
  it("closed: refuses to start, and refuses to finish a sign-up that was already in progress", async () => {
    const inProgress = browser();
    await start(inProgress, "midway@example.com");
    const code = t.latestCode("midway@example.com");

    const closed = createTestAuth(database, { signUpMode: "closed" });
    expect((await start(browser(closed.auth), "late@example.com")).json).toMatchObject({
      code: "SIGNUPS_CLOSED",
    });
    expect(await pendingFor("late@example.com")).toBe(0);

    // The same browser, the same cookie, a server that has since been closed.
    const sameBrowser = browser(closed.auth);
    for (const [name, value] of inProgress.cookies) sameBrowser.cookies.set(name, value);
    expect((await verify(sameBrowser, code)).json).toMatchObject({ code: "SIGNUPS_CLOSED" });
    expect((await sameBrowser.post("/email-signup/resend")).json).toMatchObject({
      code: "SIGNUPS_CLOSED",
    });
    expect(await usersWith("midway@example.com")).toBe(0);

    // Sign-in keeps working while sign-ups are closed.
    await signUp("existing@example.com");
    expect(
      (await signIn(browser(closed.auth), "existing@example.com", VICTIM_PASSWORD)).status,
    ).toBe(200);
  }, 180_000);

  it("allowlist: only invited addresses start, and everyone else gets one polite message", async () => {
    await signUp("registered-but-uninvited@example.com");
    const beta = createTestAuth(database, {
      signUpMode: "allowlist",
      signUpAllowlist: ["invited@example.com"],
    });

    const stranger = await start(browser(beta.auth), "stranger@example.com");
    const registered = await start(browser(beta.auth), "registered-but-uninvited@example.com");
    expect(stranger.status).toBe(403);
    expect(stranger.json).toMatchObject({ code: "SIGNUP_NOT_INVITED" });
    // The same words for a stranger and for someone who has an account: nothing to learn.
    expect(registered.json).toEqual(stranger.json);
    expect(beta.outbox).toHaveLength(0);

    const invited = browser(beta.auth);
    expect((await start(invited, " Invited@Example.com ")).status).toBe(200);
    expect((await verify(invited, beta.latestCode("invited@example.com"))).status).toBe(200);
  }, 180_000);

  it("allowlist: is checked again at the code, so a sign-up started while open cannot slip through", async () => {
    const started = browser();
    await start(started, "slipping@example.com");
    const code = t.latestCode("slipping@example.com");

    const beta = createTestAuth(database, {
      signUpMode: "allowlist",
      signUpAllowlist: ["invited@example.com"],
    });
    const sameBrowser = browser(beta.auth);
    for (const [name, value] of started.cookies) sameBrowser.cookies.set(name, value);
    expect((await verify(sameBrowser, code)).json).toMatchObject({ code: "SIGNUP_NOT_INVITED" });
    expect(await usersWith("slipping@example.com")).toBe(0);
  }, 120_000);
});

describe("the success path is one transaction", () => {
  afterEach(() => vi.restoreAllMocks());

  it("leaves nothing behind when it fails at the last step, and the same code still works afterwards", async () => {
    const client = browser();
    await start(client, "atomic@example.com");
    const code = t.latestCode("atomic@example.com");

    const context = await t.auth.$context;
    vi.spyOn(context.internalAdapter, "createSession").mockRejectedValueOnce(
      new Error("forced failure"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const failed = await verify(client, code);
    expect(failed.status).toBeGreaterThanOrEqual(500);
    expect(await usersWith("atomic@example.com")).toBe(0);
    expect(
      await count(
        "SELECT count(*)::int AS n FROM accounts a JOIN users u ON u.id = a.user_id WHERE u.email = $1",
        ["atomic@example.com"],
      ),
    ).toBe(0);
    expect(
      await count(
        "SELECT count(*)::int AS n FROM known_devices d JOIN users u ON u.id = d.user_id WHERE u.email = $1",
        ["atomic@example.com"],
      ),
    ).toBe(0);
    expect(await pendingFor("atomic@example.com")).toBe(1);
    expect((await client.get("/get-session")).json).toBeNull();

    // The pending row survived the rollback, and it is still usable.
    expect((await verify(client, code)).status).toBe(200);
    expect(await usersWith("atomic@example.com")).toBe(1);
    expect(await pendingFor("atomic@example.com")).toBe(0);
  }, 120_000);

  it("lets exactly one of two correct submissions create the account", async () => {
    const client = browser();
    await start(client, "twice@example.com");
    const code = t.latestCode("twice@example.com");
    const results = await Promise.all([verify(client, code), verify(client, code)]);
    expect(results.map((result) => result.status).sort()).not.toEqual([200, 200]);
    expect(results.some((result) => result.status === 200)).toBe(true);
    expect(await usersWith("twice@example.com")).toBe(1);
  }, 120_000);
});

describe("devices, sessions and the event log", () => {
  it("alerts on a sign-in from a new browser, not from the one that signed up, and a reset forgets them all", async () => {
    const home = await signUp("devices@example.com");
    await home.post("/sign-out");

    expect((await signIn(home, "devices@example.com", VICTIM_PASSWORD)).status).toBe(200);
    expect(t.sentTo("new-device", "devices@example.com")).toHaveLength(0);

    const elsewhere = browser(t.auth, {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
    });
    expect((await signIn(elsewhere, "devices@example.com", VICTIM_PASSWORD)).status).toBe(200);
    const alerts = t.sentTo("new-device", "devices@example.com");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      device: "Safari on macOS",
      resetUrl: `${TEST_BASE_URL}/forgot-password`,
    });
    const cookie = [...elsewhere.cookies.keys()].find((name) => name === "zc.known_device");
    expect(cookie).toBeDefined();

    // The second sign-in from that browser is no longer news.
    await elsewhere.post("/sign-out");
    await signIn(elsewhere, "devices@example.com", VICTIM_PASSWORD);
    expect(t.sentTo("new-device", "devices@example.com")).toHaveLength(1);

    // A completed reset forgets every known device: whoever reset it may not be whoever used them.
    await browser().post("/request-password-reset", { email: "devices@example.com" });
    const link = t.sentTo("password-reset", "devices@example.com").at(-1)?.url ?? "";
    const token = new URL(link).searchParams.get("token");
    expect(
      (
        await browser().post("/reset-password", {
          token,
          newPassword: "a brand new long passphrase",
        })
      ).status,
    ).toBe(200);
    expect(
      await count(
        "SELECT count(*)::int AS n FROM known_devices d JOIN users u ON u.id = d.user_id WHERE u.email = $1",
        ["devices@example.com"],
      ),
    ).toBe(0);
    expect(t.sentTo("password-changed", "devices@example.com")).toHaveLength(1);

    await signIn(home, "devices@example.com", "a brand new long passphrase");
    expect(t.sentTo("new-device", "devices@example.com")).toHaveLength(2);
  }, 240_000);

  it("stores a coarse IP prefix and a browser family with the session, never the raw values", async () => {
    await signUp("session@example.com");
    const { rows } = await database.client.query<{ ip_address: string; user_agent: string }>(
      "SELECT s.ip_address, s.user_agent FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = $1",
      ["session@example.com"],
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.ip_address).toMatch(/^198\.51\.100\.0\/24$/);
      expect(row.user_agent).toBe("Chrome on Windows");
    }
  }, 120_000);

  it("records what happened, by which side, without an address or a raw IP anywhere", async () => {
    const client = browser();
    await start(client, "logged@example.com");
    await verify(client, wrongCodeFor(t.latestCode("logged@example.com")));
    await verify(client, t.latestCode("logged@example.com"));
    await signIn(browser(), "logged@example.com", "definitely the wrong password");

    const { rows } = await database.client.query<Record<string, unknown>>(
      "SELECT * FROM auth_events",
    );
    const types = new Set(rows.map((row) => row.type));
    for (const type of [
      "signup_started",
      "signup_code_failed",
      "signup_completed",
      "signin_failed",
    ]) {
      expect(types, type).toContain(type);
    }
    expect(new Set(rows.map((row) => row.app_env))).toEqual(new Set(["local"]));
    const stored = JSON.stringify(rows);
    expect(stored).not.toContain("@example.com");
    expect(stored).not.toMatch(/198\.51\.100\.\d+"/);
  }, 120_000);

  it("never logs a password, a code or a full email address", async () => {
    const logged: string[] = [];
    for (const level of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, level).mockImplementation(
        (...parts: unknown[]) => void logged.push(parts.map(String).join(" ")),
      );
    }
    try {
      const client = browser();
      await start(client, "quiet@example.com", "a password that must never be logged");
      const code = t.latestCode("quiet@example.com");
      await verify(client, wrongCodeFor(code));
      await verify(client, code);
      await signIn(browser(), "quiet@example.com", "a wrong password that must never be logged");
      await signIn(browser(), "quiet@example.com", "a password that must never be logged");
      await browser().post("/request-password-reset", { email: "quiet@example.com" });

      const output = logged.join("\n");
      expect(output).not.toContain("must never be logged");
      expect(output).not.toContain(code);
      expect(output).not.toContain("quiet@example.com");
    } finally {
      vi.restoreAllMocks();
    }
    // The mailbox does hold the code, by design. It never holds a password.
    expect(JSON.stringify(t.outbox)).not.toContain("must never be logged");
  }, 180_000);
});

describe("as zerocorps_app, the role the app really connects as", () => {
  it("runs a whole sign-up, sign-out and sign-in", async () => {
    await database.asAppRole(async () => {
      const client = browser();
      expect((await start(client, "asrole@example.com")).status).toBe(200);
      expect((await client.get("/email-signup/status")).json).toMatchObject({ pending: true });
      expect((await verify(client, t.latestCode("asrole@example.com"))).status).toBe(200);
      expect((await client.post("/sign-out")).status).toBe(200);
      expect((await signIn(client, "asrole@example.com", VICTIM_PASSWORD)).status).toBe(200);
    });
  }, 180_000);
});
