import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient, type TestClient } from "../../test/auth-client.ts";
import { createTestAuth, TEST_BASE_URL, type TestAuth } from "../../test/test-auth.ts";
import { createTestDatabase, type TestDatabase } from "../../test/test-database.ts";
import { LIMITS } from "./limits.ts";

/**
 * Changing the email address, through the real auth configuration and over HTTP. Tested
 * for what it refuses as much as for what it does: no change without the password and a
 * code from the new inbox, nothing learned about other accounts, five guesses per code,
 * a code works once, and the old address is always told.
 */

const PASSWORD = "a long enough passphrase";

let database: TestDatabase;
let t: TestAuth;
let nextIp = 1;

const rows = async (text: string, params?: unknown[]) =>
  (await database.client.query<Record<string, unknown>>(text, params)).rows;
const newClient = () =>
  createTestClient(t.auth, { baseUrl: TEST_BASE_URL, ip: `198.51.100.${nextIp++}` });
const emailOf = async (userId: string) =>
  String((await rows("SELECT email FROM users WHERE id = $1::uuid", [userId]))[0]?.email ?? "");
const idOf = async (email: string) =>
  String((await rows("SELECT id FROM users WHERE email = $1", [email]))[0]?.id ?? "");

async function signUp(email: string): Promise<TestClient> {
  const client = newClient();
  await client.post("/email-signup/start", { email, password: PASSWORD, acceptTerms: true });
  const verified = await client.post("/email-signup/verify", { code: t.latestCode(email) });
  expect(verified.status, `sign-up of ${email}`).toBe(200);
  return client;
}

const start = (client: TestClient, newEmail: string, password = PASSWORD) =>
  client.post("/account/email/start", { newEmail, password });
const verify = (client: TestClient, code: string) => client.post("/account/email/verify", { code });

function latestChangeCode(to: string): string {
  const email = t.sentTo("email-change-code", to).at(-1);
  if (!email) throw new Error(`no email-change code was sent to ${to}`);
  return email.code;
}

/** A six-digit code that is certainly not `code`. */
const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

beforeAll(async () => {
  database = await createTestDatabase();
  t = createTestAuth(database);
}, 180_000);
afterAll(async () => {
  await database?.close();
});

describe("changing the email address", () => {
  it("works with the password and the code from the new inbox; the old address is told", async () => {
    const member = await signUp("move.old@example.com");
    const userId = await idOf("move.old@example.com");

    const started = await start(member, "  Move.New@Example.com ");
    expect(started.status).toBe(200);
    expect(JSON.stringify(started.json)).not.toMatch(/\d{6}/);
    // Nothing has changed yet.
    expect(await emailOf(userId)).toBe("move.old@example.com");

    const code = latestChangeCode("move.new@example.com");
    expect((await verify(member, code.replace(/(\d{3})/, "$1 "))).status).toBe(200);
    expect(await emailOf(userId)).toBe("move.new@example.com");
    const notice = t.sentTo("email-changed", "move.old@example.com");
    expect(notice).toHaveLength(1);
    expect(notice[0]?.newEmail).toBe("m***@example.com");

    // This device stays signed in; the new address signs in, the old one no longer does.
    expect((await member.get("/get-session")).json).not.toBeNull();
    const fresh = newClient();
    expect(
      (await fresh.post("/sign-in/email", { email: "move.new@example.com", password: PASSWORD }))
        .status,
    ).toBe(200);
    expect(
      (
        await newClient().post("/sign-in/email", {
          email: "move.old@example.com",
          password: PASSWORD,
        })
      ).status,
    ).toBe(401);

    // The code worked once.
    expect((await verify(member, code)).json).toMatchObject({ code: "NO_PENDING_CHANGE" });
    expect(
      await rows("SELECT type FROM auth_events WHERE user_id = $1::uuid AND type LIKE 'email_%'", [
        userId,
      ]),
    ).toEqual([{ type: "email_change_started" }, { type: "email_changed" }]);
  });

  it("needs the member's password; a wrong one sends nothing", async () => {
    const member = await signUp("move.nopass@example.com");
    const response = await start(member, "move.nopass.new@example.com", "not the password");
    expect(response.status).toBe(400);
    expect(response.json).toMatchObject({ code: "INVALID_PASSWORD" });
    expect(t.sentTo("email-change-code", "move.nopass.new@example.com")).toHaveLength(0);
  });

  it("counts password guesses with every other password check", async () => {
    const member = await signUp("move.guess@example.com");
    let last = 0;
    for (let i = 0; i < LIMITS.passwordCheckPerUser.max + 1; i++) {
      last = (await start(member, "move.guess.new@example.com", `guess ${i}`)).status;
      if (last === 429) break;
    }
    expect(last).toBe(429);
    // The right password is refused too, until the hour is over.
    expect((await start(member, "move.guess.new@example.com")).status).toBe(429);
  }, 120_000);

  it("gives a taken address the same answer as a free one, and no code can take it", async () => {
    await signUp("move.owner@example.com");
    const member = await signUp("move.taker@example.com");
    const free = await start(member, "move.free@example.com");
    const taken = await start(member, "move.owner@example.com");
    expect(taken.status).toBe(free.status);
    expect(Object.keys(taken.json ?? {}).sort()).toEqual(Object.keys(free.json ?? {}).sort());

    // No code went to the owner's inbox; a short note did.
    expect(t.sentTo("email-change-code", "move.owner@example.com")).toHaveLength(0);
    expect(t.sentTo("email-change-taken", "move.owner@example.com")).toHaveLength(1);
    // The earlier code (for the free address) was replaced, and no code finishes this one.
    const replaced = latestChangeCode("move.free@example.com");
    expect((await verify(member, replaced)).json).toMatchObject({ code: "INVALID_CODE" });
    expect(await emailOf(await idOf("move.taker@example.com"))).toBe("move.taker@example.com");
  });

  it("allows five guesses per code, then the change is gone, right code or not", async () => {
    const member = await signUp("move.brute@example.com");
    await start(member, "move.brute.new@example.com");
    const code = latestChangeCode("move.brute.new@example.com");
    for (let i = 0; i < LIMITS.emailChangeCodePerChange.max - 1; i++) {
      expect((await verify(member, wrong(code))).json).toMatchObject({ code: "INVALID_CODE" });
    }
    expect((await verify(member, wrong(code))).json).toMatchObject({ code: "TOO_MANY_ATTEMPTS" });
    expect((await verify(member, code)).json).toMatchObject({ code: "NO_PENDING_CHANGE" });
    expect(await emailOf(await idOf("move.brute@example.com"))).toBe("move.brute@example.com");
  });

  it("a code only works in the account that asked for it", async () => {
    const asker = await signUp("move.asker@example.com");
    const other = await signUp("move.other@example.com");
    await start(asker, "move.target@example.com");
    const code = latestChangeCode("move.target@example.com");
    expect((await verify(other, code)).json).toMatchObject({ code: "NO_PENDING_CHANGE" });
    expect(await emailOf(await idOf("move.other@example.com"))).toBe("move.other@example.com");
    expect((await verify(asker, code)).status).toBe(200);
  });

  it("an expired change cannot be finished", async () => {
    const member = await signUp("move.late@example.com");
    const userId = await idOf("move.late@example.com");
    await start(member, "move.late.new@example.com");
    const code = latestChangeCode("move.late.new@example.com");
    await rows(
      "UPDATE verifications SET expires_at = now() - interval '1 second' WHERE identifier = $1",
      [`email-change:${userId}`],
    );
    expect((await verify(member, code)).json).toMatchObject({ code: "NO_PENDING_CHANGE" });
    expect(await emailOf(userId)).toBe("move.late@example.com");
  });

  it("stores the new address and a keyed hash, never the code", async () => {
    const member = await signUp("move.stored@example.com");
    const userId = await idOf("move.stored@example.com");
    await start(member, "move.stored.new@example.com");
    const code = latestChangeCode("move.stored.new@example.com");
    const [row] = await rows("SELECT value FROM verifications WHERE identifier = $1", [
      `email-change:${userId}`,
    ]);
    expect(String(row?.value)).toContain("move.stored.new@example.com");
    expect(String(row?.value)).not.toContain(code);
  });

  it("refuses the same address, and one that is not an address", async () => {
    const member = await signUp("move.same@example.com");
    expect((await start(member, "MOVE.SAME@example.com")).json).toMatchObject({
      code: "SAME_EMAIL",
    });
    expect((await start(member, "not-an-address")).json).toMatchObject({
      code: "INVALID_EMAIL",
    });
  });

  it("if the address gets an account before the code is typed, nothing changes", async () => {
    const member = await signUp("move.race@example.com");
    await start(member, "move.race.new@example.com");
    const code = latestChangeCode("move.race.new@example.com");
    await signUp("move.race.new@example.com");
    const response = await verify(member, code);
    expect(response.status).toBe(409);
    expect(response.json).toMatchObject({ code: "EMAIL_TAKEN" });
    expect(await emailOf(await idOf("move.race@example.com"))).toBe("move.race@example.com");
  });

  it("is refused signed out, and from another website even with the member's cookies", async () => {
    expect((await start(newClient(), "move.nobody@example.com")).status).toBe(401);
    expect((await verify(newClient(), "123456")).status).toBe(401);

    const member = await signUp("move.forged@example.com");
    const forged = createTestClient(t.auth, {
      baseUrl: TEST_BASE_URL,
      ip: "198.51.100.250",
      origin: "https://evil.example",
    });
    for (const [name, value] of member.cookies) forged.cookies.set(name, value);
    expect((await start(forged, "move.forged.new@example.com")).status).toBe(403);
    expect((await verify(forged, "123456")).status).toBe(403);
    expect(t.sentTo("email-change-code", "move.forged.new@example.com")).toHaveLength(0);
  });

  it("Better Auth's own change-email stays off", async () => {
    const member = await signUp("move.stock@example.com");
    const response = await member.post("/change-email", { newEmail: "move.stock.new@example.com" });
    expect(response.status).toBe(404);
    expect(await emailOf(await idOf("move.stock@example.com"))).toBe("move.stock@example.com");
  });

  it("limits how many codes a member can have sent", async () => {
    const member = await signUp("move.spam@example.com");
    let last = 0;
    for (let i = 0; i < LIMITS.emailChangeStartPerUser.max + 1; i++) {
      last = (await start(member, `move.spam.${i}@example.com`)).status;
      if (last === 429) break;
    }
    expect(last).toBe(429);
  }, 120_000);
});
