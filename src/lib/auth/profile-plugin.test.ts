import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient, type TestClient } from "../../test/auth-client.ts";
import { createTestAuth, TEST_BASE_URL, type TestAuth } from "../../test/test-auth.ts";
import { createTestDatabase, type TestDatabase } from "../../test/test-database.ts";
import { LIMITS } from "./limits.ts";

/**
 * The username and display-name endpoints, through the real auth configuration and over
 * HTTP, because the origin check, the session check and the limiter exist only there.
 */

let database: TestDatabase;
let t: TestAuth;
let nextIp = 1;

const rows = async (text: string, params?: unknown[]) =>
  (await database.client.query<Record<string, unknown>>(text, params)).rows;

/** A member who has just signed up and is signed in. */
async function signedInMember(email: string): Promise<TestClient> {
  const client = createTestClient(t.auth, { baseUrl: TEST_BASE_URL, ip: `198.51.100.${nextIp++}` });
  await client.post("/email-signup/start", {
    email,
    password: "a long enough passphrase",
    acceptTerms: true,
  });
  const verified = await client.post("/email-signup/verify", { code: t.latestCode(email) });
  expect(verified.status, `sign-up of ${email}`).toBe(200);
  return client;
}

beforeAll(async () => {
  database = await createTestDatabase();
  t = createTestAuth(database);
}, 180_000);

afterAll(async () => {
  await database?.close();
});

describe("who may call them", () => {
  it("nobody who is signed out", async () => {
    const stranger = createTestClient(t.auth, { baseUrl: TEST_BASE_URL, ip: "198.51.100.200" });
    expect(
      (await stranger.post("/profile/username-available", { username: "anyone" })).status,
    ).toBe(401);
    expect((await stranger.post("/profile/save", { username: "anyone" })).status).toBe(401);
  });

  it("no other website, even with the member's own cookies", async () => {
    const member = await signedInMember("crosssite@example.com");
    // What a page on another site makes the member's browser send: their cookies, its origin.
    const forged = createTestClient(t.auth, {
      baseUrl: TEST_BASE_URL,
      ip: "198.51.100.201",
      origin: "https://evil.example",
    });
    for (const [name, value] of member.cookies) forged.cookies.set(name, value);

    const save = await forged.post("/profile/save", { username: "pwned_by_evil" });
    expect(save.status).toBe(403);
    const asForm = await forged.postForm("/profile/save", { username: "pwned_by_evil" });
    expect([403, 415]).toContain(asForm.status);
    expect(await rows("SELECT 1 FROM users WHERE username = 'pwned_by_evil'")).toEqual([]);
  });

  it("only for themselves: a member cannot name somebody else's account", async () => {
    const mallory = await signedInMember("mallory@example.com");
    const victim = await signedInMember("victim@example.com");
    const [victimRow] = await rows("SELECT id FROM users WHERE email = 'victim@example.com'");

    const save = await mallory.post("/profile/save", {
      username: "mallory_name",
      userId: victimRow?.id,
      id: victimRow?.id,
    });
    expect(save.status).toBe(200);
    expect(await rows("SELECT email, username FROM users WHERE username = 'mallory_name'")).toEqual(
      [{ email: "mallory@example.com", username: "mallory_name" }],
    );
    expect(await rows("SELECT username FROM users WHERE email = 'victim@example.com'")).toEqual([
      { username: null },
    ]);
    void victim;
  });
});

describe("choosing a name", () => {
  it("says free, taken or why not, and then saves it with the display name", async () => {
    const member = await signedInMember("chooser@example.com");
    const other = await signedInMember("holder@example.com");
    expect((await other.post("/profile/save", { username: "already_mine" })).status).toBe(200);

    const free = await member.post("/profile/username-available", { username: "  Fresh_Name " });
    expect(free.json).toMatchObject({ available: true, username: "fresh_name" });
    const taken = await member.post("/profile/username-available", { username: "ALREADY_MINE" });
    expect(taken.json).toMatchObject({ available: false });
    const reserved = await member.post("/profile/username-available", { username: "admin" });
    expect(reserved.json).toMatchObject({ available: false, problem: "reserved" });

    const saved = await member.post("/profile/save", {
      username: "Fresh_Name",
      displayName: "  Jane   Doe ",
    });
    expect(saved.status).toBe(200);
    expect(saved.json).toMatchObject({ ok: true, username: "fresh_name", displayName: "Jane Doe" });

    // The session now carries it, which is what the pages read.
    const session = await member.get("/get-session");
    expect((session.json?.user as Record<string, unknown>)?.username).toBe("fresh_name");
    expect((session.json?.user as Record<string, unknown>)?.name).toBe("Jane Doe");
  });

  it("refuses a name somebody else has, and says so plainly", async () => {
    const first = await signedInMember("first.claim@example.com");
    const second = await signedInMember("second.claim@example.com");
    expect((await first.post("/profile/save", { username: "wanted" })).status).toBe(200);

    const clash = await second.post("/profile/save", { username: "Wanted" });
    expect(clash.status).toBe(400);
    expect(clash.json).toMatchObject({ code: "USERNAME_TAKEN" });
    expect(
      await rows("SELECT username FROM users WHERE email = 'second.claim@example.com'"),
    ).toEqual([{ username: null }]);
  });

  it("a display name with hidden characters changes NOTHING, not even the username", async () => {
    const member = await signedInMember("hidden@example.com");
    const save = await member.post("/profile/save", {
      username: "would_be_fine",
      displayName: "Jane\u202eDoe",
    });
    expect(save.status).toBe(400);
    expect(save.json).toMatchObject({ code: "INVALID_DISPLAY_NAME" });
    expect(await rows("SELECT username FROM users WHERE email = 'hidden@example.com'")).toEqual([
      { username: null },
    ]);
  });

  it("the second change has to wait, and the log records a claim and then a change", async () => {
    const member = await signedInMember("changer@example.com");
    expect((await member.post("/profile/save", { username: "name_one" })).status).toBe(200);
    expect((await member.post("/profile/save", { username: "name_two" })).status).toBe(200);

    const third = await member.post("/profile/save", { username: "name_three" });
    expect(third.status).toBe(403);
    expect(third.json).toMatchObject({ code: "USERNAME_CHANGE_TOO_SOON" });

    const events = await rows(
      `SELECT e.type FROM auth_events e JOIN users u ON u.id = e.user_id
        WHERE u.email = 'changer@example.com' AND e.type LIKE 'username_%' ORDER BY e.created_at`,
    );
    expect(events.map((event) => event.type)).toEqual(["username_claimed", "username_changed"]);
  });

  it("saving the same name again is not a change and is not logged as one", async () => {
    const member = await signedInMember("steady@example.com");
    await member.post("/profile/save", { username: "steady_name" });
    const again = await member.post("/profile/save", {
      username: "steady_name",
      displayName: "Now With A Name",
    });
    expect(again.status).toBe(200);
    const events = await rows(
      `SELECT e.type FROM auth_events e JOIN users u ON u.id = e.user_id
        WHERE u.email = 'steady@example.com' AND e.type LIKE 'username_%'`,
    );
    expect(events.map((event) => event.type)).toEqual(["username_claimed"]);
  });
});

describe("the name list cannot be harvested", () => {
  it("the free-or-taken hint stops answering after its limit, per member", async () => {
    const member = await signedInMember("harvester@example.com");
    const max = LIMITS.usernameCheckPerUser.max;
    let last = 200;
    for (let i = 0; i < max + 1; i++) {
      last = (await member.post("/profile/username-available", { username: `guess_${i}` })).status;
      if (last !== 200) break;
    }
    expect(last).toBe(429);

    // Another member is not held back by it: the count is per member, never per address.
    const other = await signedInMember("not.the.harvester@example.com");
    expect((await other.post("/profile/username-available", { username: "calm" })).status).toBe(
      200,
    );
  }, 240_000);
});
