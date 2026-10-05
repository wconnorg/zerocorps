import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestClient, type TestClient } from "../../test/auth-client.ts";
import { createTestAuth, TEST_BASE_URL, type TestAuth } from "../../test/test-auth.ts";
import { createTestDatabase, type TestDatabase } from "../../test/test-database.ts";
import { listDevices, recentActivity } from "./account-data.ts";
import { LIMITS } from "./limits.ts";

/**
 * Milestone 4's account self-service, through the real auth configuration and over HTTP:
 * changing the password, signing devices out, and deleting the account. Tested for what
 * they refuse as much as for what they do.
 */

const PASSWORD = "a long enough passphrase";
const NEW_PASSWORD = "a brand new passphrase";
const DISCORD_ID = "123456789012345678";
const GUILD = "223456789012345678";
const BRONZE_ROLE = "323456789012345678";

let database: TestDatabase;
let t: TestAuth;
let nextIp = 1;
let discordCalls: { method: string; url: string }[] = [];

const rows = async (text: string, params?: unknown[]) =>
  (await database.client.query<Record<string, unknown>>(text, params)).rows;
const newClient = () =>
  createTestClient(t.auth, { baseUrl: TEST_BASE_URL, ip: `198.51.100.${nextIp++}` });

async function signUp(email: string): Promise<TestClient> {
  const client = newClient();
  await client.post("/email-signup/start", { email, password: PASSWORD, acceptTerms: true });
  const verified = await client.post("/email-signup/verify", { code: t.latestCode(email) });
  expect(verified.status, `sign-up of ${email}`).toBe(200);
  return client;
}

async function signIn(email: string, password = PASSWORD): Promise<TestClient> {
  const client = newClient();
  const response = await client.post("/sign-in/email", { email, password });
  expect(response.status, `sign-in of ${email}`).toBe(200);
  return client;
}

const signedIn = async (client: TestClient) => (await client.get("/get-session")).json !== null;
const idOf = async (email: string) =>
  String((await rows("SELECT id FROM users WHERE email = $1", [email]))[0]?.id ?? "");
const sessionIds = async (userId: string) =>
  (
    await rows("SELECT id FROM sessions WHERE user_id = $1::uuid ORDER BY created_at", [userId])
  ).map((row) => String(row.id));

beforeAll(async () => {
  database = await createTestDatabase();
  t = createTestAuth(database, {
    discord: {
      app: { clientId: "client-id", clientSecret: "client-secret" },
      roles: { botToken: "bot-token", guildId: GUILD, roleIds: { bronze: BRONZE_ROLE } },
      fetch: async (input, init) => {
        discordCalls.push({ method: init?.method ?? "GET", url: String(input) });
        return new Response(null, { status: 204 });
      },
    },
  });
}, 180_000);
afterAll(async () => {
  await database?.close();
});
beforeEach(() => {
  discordCalls = [];
});

describe("changing the password", () => {
  it("needs the current password; a wrong one changes nothing", async () => {
    const member = await signUp("change.wrong@example.com");
    const response = await member.post("/change-password", {
      currentPassword: "not the password",
      newPassword: NEW_PASSWORD,
      revokeOtherSessions: true,
    });
    expect(response.status).toBe(400);
    await signIn("change.wrong@example.com", PASSWORD);
  });

  it("always signs the other devices out: a request that would not is refused", async () => {
    const member = await signUp("change.keep@example.com");
    const response = await member.post("/change-password", {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(response.status).toBe(400);
    expect(response.json).toMatchObject({ code: "REVOKE_REQUIRED" });
  });

  it("works: the other devices are signed out, this one stays, and an email says so", async () => {
    const email = "change.ok@example.com";
    const member = await signUp(email);
    const laptop = await signIn(email);
    const response = await member.post("/change-password", {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
      revokeOtherSessions: true,
    });
    expect(response.status).toBe(200);
    expect(await signedIn(member)).toBe(true);
    expect(await signedIn(laptop)).toBe(false);
    expect(t.sentTo("password-changed", email)).toHaveLength(1);

    const userId = await idOf(email);
    expect(
      await rows(
        "SELECT 1 FROM auth_events WHERE user_id = $1::uuid AND type = 'password_changed'",
        [userId],
      ),
    ).toHaveLength(1);
    await signIn(email, NEW_PASSWORD);
    expect((await newClient().post("/sign-in/email", { email, password: PASSWORD })).status).toBe(
      401,
    );
  });

  it("is counted per member: a stolen session cannot guess its way to the password", async () => {
    const member = await signUp("change.guess@example.com");
    let last = 0;
    for (let i = 0; i < LIMITS.passwordCheckPerUser.max + 1; i++) {
      last = (
        await member.post("/change-password", {
          currentPassword: `guess number ${i}`,
          newPassword: NEW_PASSWORD,
          revokeOtherSessions: true,
        })
      ).status;
      if (last === 429) break;
    }
    expect(last).toBe(429);
  }, 240_000);
});

describe("signing devices out", () => {
  it("signs out one other device by its id, and only the member's own", async () => {
    const email = "devices.one@example.com";
    const member = await signUp(email);
    const phone = await signIn(email);
    const userId = await idOf(email);
    const [current, phoneSession] = await sessionIds(userId);

    const response = await member.post("/account/sessions/revoke", { sessionId: phoneSession });
    expect(response.json).toEqual({ ok: true, revoked: true });
    expect(await signedIn(phone)).toBe(false);
    expect(await signedIn(member)).toBe(true);

    const itself = await member.post("/account/sessions/revoke", { sessionId: current });
    expect(itself.status).toBe(400);
    expect(itself.json).toMatchObject({ code: "CURRENT_SESSION" });
  });

  it("cannot touch somebody else's session, whatever id is sent", async () => {
    const attacker = await signUp("devices.attacker@example.com");
    await signUp("devices.victim@example.com");
    const victimId = await idOf("devices.victim@example.com");
    const [victimSession] = await sessionIds(victimId);

    const response = await attacker.post("/account/sessions/revoke", { sessionId: victimSession });
    expect(response.json).toEqual({ ok: true, revoked: false });
    expect(await sessionIds(victimId)).toEqual([victimSession]);
    expect(
      (await attacker.post("/account/sessions/revoke", { sessionId: "not-a-uuid" })).status,
    ).toBe(400);
  });

  it("is refused signed out, and from another website even with the member's cookies", async () => {
    expect(
      (await newClient().post("/account/sessions/revoke", { sessionId: crypto.randomUUID() }))
        .status,
    ).toBe(401);
    const member = await signUp("devices.forged@example.com");
    const forged = createTestClient(t.auth, {
      baseUrl: TEST_BASE_URL,
      ip: "198.51.100.250",
      origin: "https://evil.example",
    });
    for (const [name, value] of member.cookies) forged.cookies.set(name, value);
    expect((await forged.post("/revoke-other-sessions", {})).status).toBe(403);
  });

  it('"sign out everywhere else" keeps this device and records it', async () => {
    const email = "devices.all@example.com";
    const member = await signUp(email);
    const tablet = await signIn(email);
    const phone = await signIn(email);
    expect((await member.post("/revoke-other-sessions", {})).status).toBe(200);
    expect(await signedIn(member)).toBe(true);
    expect(await signedIn(tablet)).toBe(false);
    expect(await signedIn(phone)).toBe(false);
    const userId = await idOf(email);
    expect(
      await rows(
        "SELECT 1 FROM auth_events WHERE user_id = $1::uuid AND type = 'other_sessions_revoked'",
        [userId],
      ),
    ).toHaveLength(1);
  });
});

describe("what settings reads about the member", () => {
  it("lists their devices, this one first, with ids and never a session token", async () => {
    const email = "settings.reads@example.com";
    await signUp(email);
    await signIn(email);
    const userId = await idOf(email);
    const [first, second] = await sessionIds(userId);
    const devices = await listDevices(database.db, userId, second!);
    expect(devices.map((device) => [device.id, device.current])).toEqual([
      [second, true],
      [first, false],
    ]);
    const tokens = await rows("SELECT token FROM sessions WHERE user_id = $1::uuid", [userId]);
    const shown = JSON.stringify(devices);
    for (const { token } of tokens) expect(shown).not.toContain(String(token));
  });

  it("shows their own security activity, newest first, and nobody else's", async () => {
    const email = "settings.activity@example.com";
    await signUp(email);
    await signIn(email);
    const userId = await idOf(email);
    const activity = await recentActivity(database.db, userId);
    expect(activity.map((entry) => entry.type)).toContain("signup_completed");
    expect(activity.map((entry) => entry.type)).toContain("signin_succeeded");
    expect(activity.length).toBeLessThanOrEqual(15);

    // Another member's event never shows in this member's list.
    const otherId = await idOf("devices.victim@example.com");
    await rows(
      "INSERT INTO auth_events (type, user_id, app_env) VALUES ('discord_linked', $1::uuid, 'local')",
      [otherId],
    );
    expect((await recentActivity(database.db, userId)).map((entry) => entry.type)).not.toContain(
      "discord_linked",
    );
    expect((await recentActivity(database.db, otherId)).map((entry) => entry.type)).toContain(
      "discord_linked",
    );
  });
});

describe("deleting the account", () => {
  it("always needs the password: none, an emailed token, or a wrong one deletes nothing", async () => {
    const email = "delete.refused@example.com";
    const member = await signUp(email);
    const none = await member.post("/delete-user", {});
    expect(none.status).toBe(400);
    expect(none.json).toMatchObject({ code: "PASSWORD_REQUIRED" });
    expect((await member.post("/delete-user", { token: "abc" })).status).toBe(400);
    expect((await member.post("/delete-user", { password: PASSWORD, token: "abc" })).status).toBe(
      400,
    );
    expect((await member.post("/delete-user", { password: "not the password" })).status).toBe(400);
    expect(await idOf(email)).not.toBe("");
    expect(await signedIn(member)).toBe(true);
  });

  it("cannot be done by another website, even with the member's cookies", async () => {
    const email = "delete.forged@example.com";
    const member = await signUp(email);
    const forged = createTestClient(t.auth, {
      baseUrl: TEST_BASE_URL,
      ip: "198.51.100.251",
      origin: "https://evil.example",
    });
    for (const [name, value] of member.cookies) forged.cookies.set(name, value);
    expect((await forged.post("/delete-user", { password: PASSWORD })).status).toBe(403);
    expect(await idOf(email)).not.toBe("");
  });

  it("with the password: everything tied to the account goes, the Discord role first", async () => {
    const email = "delete.ok@example.com";
    const member = await signUp(email);
    const otherDevice = await signIn(email);
    const userId = await idOf(email);
    await rows(
      "INSERT INTO lesson_progress (user_id, lesson_id) VALUES ($1::uuid, 'orders-and-fills')",
      [userId],
    );
    await rows("INSERT INTO rank_history (user_id, rank) VALUES ($1::uuid, 'bronze')", [userId]);
    await rows(
      "INSERT INTO discord_links (user_id, discord_id, discord_username) VALUES ($1::uuid, $2, 'trader')",
      [userId, DISCORD_ID],
    );

    const response = await member.post("/delete-user", { password: PASSWORD });
    expect(response.status).toBe(200);
    expect(await signedIn(member)).toBe(false);
    expect(await signedIn(otherDevice)).toBe(false);

    for (const table of [
      "users",
      "sessions",
      "accounts",
      "known_devices",
      "lesson_progress",
      "rank_history",
      "discord_links",
    ]) {
      const column = table === "users" ? "id" : "user_id";
      expect(
        await rows(`SELECT 1 FROM ${table} WHERE ${column} = $1::uuid`, [userId]),
        table,
      ).toEqual([]);
    }
    // The deletion is recorded without the member's id, as a keyed hash of the address.
    const [event] = await rows(
      "SELECT user_id, identifier_hash FROM auth_events WHERE type = 'account_deleted' ORDER BY created_at DESC LIMIT 1",
    );
    expect(event?.user_id).toBeNull();
    expect(String(event?.identifier_hash ?? "")).not.toContain("@");
    expect(String(event?.identifier_hash ?? "").length).toBeGreaterThan(20);
    expect(discordCalls.find((call) => call.method === "DELETE")?.url).toContain(
      `/members/${DISCORD_ID}/roles/${BRONZE_ROLE}`,
    );
    // The address is free again: the same person can come back.
    await signUp(email);
  });
});
