import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient, type TestClient } from "../../test/auth-client.ts";
import { createTestAuth, TEST_BASE_URL, type TestAuth } from "../../test/test-auth.ts";
import { createTestDatabase, type TestDatabase } from "../../test/test-database.ts";
import { LIMITS } from "./limits.ts";
import { BACKUP_CODE_COUNT, TRUST_DEVICE_PREFIX } from "./two-factor.ts";

/**
 * Two-factor (milestone 5), through the real auth configuration and over HTTP: an
 * authenticator app after the password, backup codes and trusted browsers. Tested for
 * what it refuses as much as for what it does. The app codes are made by an independent
 * RFC 6238 implementation below, from the set-up link alone, the way a real authenticator
 * app makes them.
 */

const PASSWORD = "a long enough passphrase";

let database: TestDatabase;
let t: TestAuth;
let nextIp = 1;

const rows = async (text: string, params?: unknown[]) =>
  (await database.client.query<Record<string, unknown>>(text, params)).rows;
const idOf = async (email: string) =>
  String((await rows("SELECT id FROM users WHERE email = $1", [email]))[0]?.id ?? "");
const enabled = async (userId: string) =>
  (await rows("SELECT two_factor_enabled FROM users WHERE id = $1::uuid", [userId]))[0]
    ?.two_factor_enabled;
const eventsOf = async (userId: string) =>
  (
    await rows("SELECT type, detail FROM auth_events WHERE user_id = $1::uuid ORDER BY id", [
      userId,
    ])
  ).map((row) => String(row.type));

/**
 * A browser. Better Auth allows 3 two-factor requests per 10 seconds per IP address, so
 * every browser gets its own address, and `elsewhere` moves one to a new address while
 * keeping its cookies.
 */
const newClient = () =>
  createTestClient(t.auth, { baseUrl: TEST_BASE_URL, ip: `198.51.100.${nextIp++}` });
function elsewhere(client: TestClient): TestClient {
  const moved = newClient();
  for (const [name, value] of client.cookies) moved.cookies.set(name, value);
  return moved;
}

async function signUp(email: string): Promise<TestClient> {
  const client = newClient();
  await client.post("/email-signup/start", { email, password: PASSWORD, acceptTerms: true });
  const verified = await client.post("/email-signup/verify", { code: t.latestCode(email) });
  expect(verified.status, `sign-up of ${email}`).toBe(200);
  return client;
}

// ── An authenticator app, from the set-up link alone (RFC 4648 base32, RFC 6238) ──────

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of input.replace(/=+$/, "").toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error("not base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 0xff);
      value &= (1 << bits) - 1;
    }
  }
  return Buffer.from(out);
}

type App = { code: (stepOffset?: number) => string; uri: URL };

function appFrom(totpURI: string): App {
  const uri = new URL(totpURI);
  const key = base32Decode(uri.searchParams.get("secret") ?? "");
  return {
    uri,
    code(stepOffset = 0) {
      const counter = Buffer.alloc(8);
      counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + stepOffset));
      const mac = createHmac("sha1", key).update(counter).digest();
      const offset = (mac[mac.length - 1] ?? 0) & 0xf;
      return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
    },
  };
}

/** Six digits that are certainly not any code the app accepts right now. */
function wrongCode(app: App, salt: number): string {
  const valid = new Set([app.code(-1), app.code(0), app.code(1)]);
  for (let n = salt; ; n++) {
    const candidate = String(n % 1_000_000).padStart(6, "0");
    if (!valid.has(candidate)) return candidate;
  }
}

/**
 * Signs up and sets two-factor up: returns the signed-in browser, the app and the codes.
 * Switching it on replaces the browser's session, so the browser that typed the first
 * code is the one still signed in.
 */
async function withTwoFactor(email: string) {
  const signedUp = await signUp(email);
  const started = await signedUp.post("/two-factor/enable", { password: PASSWORD });
  expect(started.status, `set-up of ${email}`).toBe(200);
  const app = appFrom(String(started.json?.totpURI));
  const member = elsewhere(signedUp);
  const confirmed = await member.post("/two-factor/verify-totp", { code: app.code() });
  expect(confirmed.status, `confirming ${email}`).toBe(200);
  return {
    member,
    app,
    backupCodes: started.json?.backupCodes as string[],
    userId: await idOf(email),
  };
}

/** A fresh browser that gave the right password: it now sits at the code screen. */
async function atCodeScreen(email: string, password = PASSWORD) {
  const browser = newClient();
  const response = await browser.post("/sign-in/email", { email, password });
  return { browser, response };
}

beforeAll(async () => {
  database = await createTestDatabase();
  t = createTestAuth(database);
}, 180_000);
afterAll(async () => {
  await database?.close();
});

describe("setting two-factor up", () => {
  it("needs the password, and is on only once a first code from the app is typed", async () => {
    const member = await signUp("tf.setup@example.com");
    const userId = await idOf("tf.setup@example.com");

    const wrong = await member.post("/two-factor/enable", { password: "not the password" });
    expect(wrong.status).toBe(400);
    expect(await rows("SELECT id FROM two_factors WHERE user_id = $1::uuid", [userId])).toEqual([]);

    const started = await member.post("/two-factor/enable", { password: PASSWORD });
    expect(started.status).toBe(200);
    const app = appFrom(String(started.json?.totpURI));
    expect(app.uri.protocol).toBe("otpauth:");
    expect(app.uri.searchParams.get("issuer")).toBe("ZeroCorps");
    const backupCodes = started.json?.backupCodes as string[];
    expect(backupCodes).toHaveLength(BACKUP_CODE_COUNT);
    expect(new Set(backupCodes).size).toBe(BACKUP_CODE_COUNT);

    // Not on yet: a set-up nobody finishes changes nothing about signing in.
    expect(await enabled(userId)).toBe(false);
    expect((await atCodeScreen("tf.setup@example.com")).response.json).not.toHaveProperty(
      "twoFactorRedirect",
    );

    const moved = elsewhere(member);
    expect((await moved.post("/two-factor/verify-totp", { code: wrongCode(app, 1) })).status).toBe(
      401,
    );
    expect(await enabled(userId)).toBe(false);
    expect((await moved.post("/two-factor/verify-totp", { code: app.code() })).status).toBe(200);
    expect(await enabled(userId)).toBe(true);

    // Still signed in here, and told by email.
    expect((await moved.get("/get-session")).json).toMatchObject({
      user: { twoFactorEnabled: true },
    });
    expect(t.sentTo("two-factor-changed", "tf.setup@example.com")).toEqual([
      { kind: "two-factor-changed", to: "tf.setup@example.com", change: "enabled" },
    ]);
    expect(await eventsOf(userId)).toContain("two_factor_enabled");
  }, 120_000);

  it("stores the app's secret and the backup codes only encrypted", async () => {
    const { app, backupCodes, userId } = await withTwoFactor("tf.stored@example.com");
    const [row] = await rows(
      "SELECT secret, backup_codes, verified FROM two_factors WHERE user_id = $1::uuid",
      [userId],
    );
    const stored = JSON.stringify(row);
    expect(row?.verified).toBe(true);
    expect(stored).not.toContain(app.uri.searchParams.get("secret"));
    expect(stored).not.toContain(base32Decode(app.uri.searchParams.get("secret") ?? "").toString());
    for (const code of backupCodes) expect(stored).not.toContain(code);
  }, 60_000);

  it("offers no text or email codes, and never shows the secret again", async () => {
    const member = await signUp("tf.nosms@example.com");
    for (const path of ["/two-factor/send-otp", "/two-factor/verify-otp"]) {
      expect((await member.post(path, { code: "123456" })).status, path).toBe(404);
    }
    expect(
      (await member.post("/two-factor/enable", { password: PASSWORD, method: "otp" })).json,
    ).toMatchObject({ code: "APP_CODES_ONLY" });
    expect(await enabled(await idOf("tf.nosms@example.com"))).toBe(false);

    await elsewhere(member).post("/two-factor/enable", { password: PASSWORD });
    expect(
      (await elsewhere(member).post("/two-factor/get-totp-uri", { password: PASSWORD })).status,
    ).toBe(404);
  }, 60_000);

  it("counts password guesses with every other password check", async () => {
    const member = await signUp("tf.guess@example.com");
    let last = 0;
    for (let i = 0; i < LIMITS.passwordCheckPerUser.max + 1; i++) {
      last = (await elsewhere(member).post("/two-factor/enable", { password: `guess ${i}` }))
        .status;
      if (last === 429) break;
    }
    expect(last).toBe(429);
    expect(
      (await elsewhere(member).post("/two-factor/enable", { password: PASSWORD })).status,
    ).toBe(429);
  }, 120_000);

  it("refuses a request from another website", async () => {
    const member = await signUp("tf.csrf@example.com");
    const forged = createTestClient(t.auth, {
      baseUrl: TEST_BASE_URL,
      ip: `198.51.100.${nextIp++}`,
      origin: "https://evil.example",
    });
    for (const [name, value] of member.cookies) forged.cookies.set(name, value);
    expect((await forged.post("/two-factor/enable", { password: PASSWORD })).status).toBe(403);
    expect(await enabled(await idOf("tf.csrf@example.com"))).toBe(false);
  }, 60_000);
});

describe("signing in with two-factor on", () => {
  it("a password alone signs nobody in; the code from the app does", async () => {
    const { app, userId } = await withTwoFactor("tf.signin@example.com");
    const newDeviceAlerts = () => t.sentTo("new-device", "tf.signin@example.com").length;
    const alertsBefore = newDeviceAlerts();
    const signInsBefore = (await eventsOf(userId)).filter((e) => e === "signin_succeeded").length;

    const { browser, response } = await atCodeScreen("tf.signin@example.com");
    expect(response.status).toBe(200);
    expect(response.json).toEqual({ twoFactorRedirect: true, twoFactorMethods: ["totp"] });
    // No session, no known browser, no alert: nothing has signed in yet.
    expect((await browser.get("/get-session")).json).toBeNull();
    expect(newDeviceAlerts()).toBe(alertsBefore);
    expect((await eventsOf(userId)).filter((e) => e === "signin_succeeded")).toHaveLength(
      signInsBefore,
    );

    const wrong = await browser.post("/two-factor/verify-totp", { code: wrongCode(app, 7) });
    expect(wrong.status).toBe(401);
    expect(await eventsOf(userId)).toContain("two_factor_failed");

    const right = await browser.post("/two-factor/verify-totp", { code: app.code() });
    expect(right.status).toBe(200);
    expect((await browser.get("/get-session")).json).toMatchObject({ user: { id: userId } });
    // Now it is a sign-in, from a browser the account has not seen.
    expect((await eventsOf(userId)).filter((e) => e === "signin_succeeded")).toHaveLength(
      signInsBefore + 1,
    );
    expect(newDeviceAlerts()).toBe(alertsBefore + 1);
  }, 120_000);

  it("a code works once, even inside the 90 seconds it is accepted", async () => {
    const { app } = await withTwoFactor("tf.once@example.com");
    const code = app.code();
    const first = await atCodeScreen("tf.once@example.com");
    expect((await first.browser.post("/two-factor/verify-totp", { code })).status).toBe(200);

    const second = await atCodeScreen("tf.once@example.com");
    const again = await second.browser.post("/two-factor/verify-totp", { code });
    expect(again.status).toBe(401);
    expect(again.json).toMatchObject({ code: "CODE_ALREADY_USED" });
    expect((await second.browser.get("/get-session")).json).toBeNull();
    // The next code from the app still works.
    const next = await elsewhere(second.browser).post("/two-factor/verify-totp", {
      code: app.code(1),
    });
    expect(next.status).toBe(200);
  }, 120_000);

  it("five wrong codes end the attempt; ten in a row lock the code screen", async () => {
    const { app } = await withTwoFactor("tf.lock@example.com");
    let at = (await atCodeScreen("tf.lock@example.com")).browser;
    for (let i = 0; i < 5; i++) {
      at = elsewhere(at);
      expect(
        (await at.post("/two-factor/verify-totp", { code: wrongCode(app, 100 + i) })).status,
      ).toBe(401);
    }
    at = elsewhere(at);
    const sixth = await at.post("/two-factor/verify-totp", { code: wrongCode(app, 200) });
    expect(sixth.json).toMatchObject({ code: "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE" });
    // That attempt is over: even the right code no longer signs this browser in.
    expect((await elsewhere(at).post("/two-factor/verify-totp", { code: app.code() })).status).toBe(
      401,
    );

    // Five more wrong codes on a new attempt make ten in a row: the account's code screen
    // is locked, and the right code is refused too until the lock runs out.
    at = (await atCodeScreen("tf.lock@example.com")).browser;
    for (let i = 0; i < 5; i++) {
      at = elsewhere(at);
      await at.post("/two-factor/verify-totp", { code: wrongCode(app, 300 + i) });
    }
    const locked = await elsewhere((await atCodeScreen("tf.lock@example.com")).browser).post(
      "/two-factor/verify-totp",
      { code: app.code(1) },
    );
    expect(locked.status).toBe(429);
    expect(locked.json).toMatchObject({ code: "ACCOUNT_TEMPORARILY_LOCKED" });
  }, 180_000);

  it("gets no session without the code screen's own cookie", async () => {
    const { app } = await withTwoFactor("tf.nocookie@example.com");
    const stranger = newClient();
    expect((await stranger.post("/two-factor/verify-totp", { code: app.code() })).status).toBe(401);
    expect((await stranger.get("/get-session")).json).toBeNull();
  }, 60_000);
});

describe("backup codes", () => {
  it("each works once, only at sign-in, and the member is told when one is used", async () => {
    const { member, backupCodes, userId } = await withTwoFactor("tf.backup@example.com");
    const [first = "", second = ""] = backupCodes;

    // Not while signed in: a stolen session cannot try them, nor use them up.
    const signedIn = await elsewhere(member).post("/two-factor/verify-backup-code", {
      code: second,
    });
    expect(signedIn.json).toMatchObject({ code: "BACKUP_CODES_SIGN_IN_ONLY" });

    const { browser } = await atCodeScreen("tf.backup@example.com");
    // Nor used up without signing in: the plugin's `disableSession` is refused.
    const unsigned = await browser.post("/two-factor/verify-backup-code", {
      code: first,
      disableSession: true,
    });
    expect(unsigned.json).toMatchObject({ code: "BACKUP_CODES_SIGN_IN_ONLY" });
    const signingIn = elsewhere(browser);
    expect((await signingIn.post("/two-factor/verify-backup-code", { code: first })).status).toBe(
      200,
    );
    expect((await signingIn.get("/get-session")).json).toMatchObject({ user: { id: userId } });
    expect(await eventsOf(userId)).toContain("backup_code_used");
    expect(
      t.sentTo("two-factor-changed", "tf.backup@example.com").map((email) => email.change),
    ).toContain("backup-code-used");

    const reused = await atCodeScreen("tf.backup@example.com");
    expect(
      (await reused.browser.post("/two-factor/verify-backup-code", { code: first })).status,
    ).toBe(401);
    // The one tried while signed in was not used up.
    expect(
      (await elsewhere(reused.browser).post("/two-factor/verify-backup-code", { code: second }))
        .status,
    ).toBe(200);
  }, 120_000);

  it("new ones need the password; the old ones stop working; the member is told", async () => {
    const { member, backupCodes } = await withTwoFactor("tf.newcodes@example.com");
    expect(
      (await elsewhere(member).post("/two-factor/generate-backup-codes", { password: "nope" }))
        .status,
    ).not.toBe(200);
    const fresh = await elsewhere(member).post("/two-factor/generate-backup-codes", {
      password: PASSWORD,
    });
    expect(fresh.status).toBe(200);
    const newCodes = fresh.json?.backupCodes as string[];
    expect(newCodes).toHaveLength(BACKUP_CODE_COUNT);
    expect(
      t.sentTo("two-factor-changed", "tf.newcodes@example.com").map((email) => email.change),
    ).toContain("backup-codes");

    const { browser } = await atCodeScreen("tf.newcodes@example.com");
    expect(
      (await browser.post("/two-factor/verify-backup-code", { code: backupCodes[0] })).status,
    ).toBe(401);
    expect(
      (await elsewhere(browser).post("/two-factor/verify-backup-code", { code: newCodes[0] }))
        .status,
    ).toBe(200);
  }, 120_000);
});

describe("trusted browsers", () => {
  it("skip the code on that browser only; turning two-factor off forgets every one", async () => {
    const { app, userId } = await withTwoFactor("tf.trust@example.com");
    const home = (await atCodeScreen("tf.trust@example.com")).browser;
    const trusted = await home.post("/two-factor/verify-totp", {
      code: app.code(),
      trustDevice: true,
    });
    expect(trusted.status).toBe(200);
    // Better Auth's record of it: the name `forgetTrustedDevices` relies on.
    const records = await rows(
      "SELECT identifier FROM verifications WHERE value = $1 AND identifier LIKE $2",
      [userId, `${TRUST_DEVICE_PREFIX}%`],
    );
    expect(records).toHaveLength(1);

    await home.post("/sign-out");
    const back = await elsewhere(home).post("/sign-in/email", {
      email: "tf.trust@example.com",
      password: PASSWORD,
    });
    expect(back.json).not.toHaveProperty("twoFactorRedirect");
    expect(back.json).toHaveProperty("token");
    // Another browser still gets the code screen.
    expect((await atCodeScreen("tf.trust@example.com")).response.json).toMatchObject({
      twoFactorRedirect: true,
    });

    // Turning two-factor off from ANOTHER signed-in browser forgets this one as well.
    const other = (await atCodeScreen("tf.trust@example.com")).browser;
    await other.post("/two-factor/verify-totp", { code: app.code(1) });
    const off = await elsewhere(other).post("/two-factor/disable", { password: PASSWORD });
    expect(off.status).toBe(200);
    expect(
      await rows("SELECT id FROM verifications WHERE value = $1 AND identifier LIKE $2", [
        userId,
        `${TRUST_DEVICE_PREFIX}%`,
      ]),
    ).toEqual([]);
  }, 180_000);

  it("are forgotten when the password is reset", async () => {
    const { app, userId } = await withTwoFactor("tf.reset@example.com");
    const home = (await atCodeScreen("tf.reset@example.com")).browser;
    await home.post("/two-factor/verify-totp", { code: app.code(), trustDevice: true });

    const visitor = newClient();
    await visitor.post("/request-password-reset", { email: "tf.reset@example.com" });
    const link = t.sentTo("password-reset", "tf.reset@example.com").at(-1);
    const token = new URL(link?.url ?? TEST_BASE_URL).searchParams.get("token") ?? "";
    const newPassword = "an entirely new passphrase";
    expect((await visitor.post("/reset-password", { token, newPassword })).status).toBe(200);

    expect(
      await rows("SELECT id FROM verifications WHERE value = $1 AND identifier LIKE $2", [
        userId,
        `${TRUST_DEVICE_PREFIX}%`,
      ]),
    ).toEqual([]);
    // The browser that was trusted gets the code screen again.
    const again = await elsewhere(home).post("/sign-in/email", {
      email: "tf.reset@example.com",
      password: newPassword,
    });
    expect(again.json).toMatchObject({ twoFactorRedirect: true });
  }, 120_000);
});

describe("turning two-factor off", () => {
  it("needs the password; sign-in is password-only again; the member is told", async () => {
    const { member, userId } = await withTwoFactor("tf.off@example.com");
    expect((await elsewhere(member).post("/two-factor/disable", { password: "nope" })).status).toBe(
      400,
    );
    expect(await enabled(userId)).toBe(true);

    expect(
      (await elsewhere(member).post("/two-factor/disable", { password: PASSWORD })).status,
    ).toBe(200);
    expect(await enabled(userId)).toBe(false);
    expect(await rows("SELECT id FROM two_factors WHERE user_id = $1::uuid", [userId])).toEqual([]);
    expect(
      t.sentTo("two-factor-changed", "tf.off@example.com").map((email) => email.change),
    ).toEqual(["enabled", "disabled"]);
    expect(await eventsOf(userId)).toContain("two_factor_disabled");
    expect((await atCodeScreen("tf.off@example.com")).response.json).toHaveProperty("token");
  }, 120_000);

  it("goes with the account when the account is deleted", async () => {
    const { member, userId } = await withTwoFactor("tf.delete@example.com");
    expect((await elsewhere(member).post("/delete-user", { password: PASSWORD })).status).toBe(200);
    expect(await rows("SELECT id FROM two_factors WHERE user_id = $1::uuid", [userId])).toEqual([]);
  }, 60_000);
});
