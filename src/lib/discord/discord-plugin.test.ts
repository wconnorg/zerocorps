import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildCatalog } from "../../test/academy-fixture.ts";
import { createTestClient, type TestClient } from "../../test/auth-client.ts";
import { createTestAuth, TEST_BASE_URL, type TestAuth } from "../../test/test-auth.ts";
import { createTestDatabase, type TestDatabase } from "../../test/test-database.ts";

/**
 * Linking Discord, through the real auth configuration and over HTTP, against a fake
 * Discord that records every call. What matters most is what is refused: a link without
 * a session, a callback that did not start in this browser for this member, a Discord
 * account that is already somebody else's, and any token being kept.
 */

const DISCORD_ID = "123456789012345678";
const OTHER_DISCORD_ID = "223456789012345678";
const GUILD = "323456789012345678";
const BRONZE_ROLE = "423456789012345678";

type Call = { method: string; url: string; body: string; authorization: string | null };
let calls: Call[] = [];
/** Which Discord account the fake's `good-code-*` codes identify. */
let identity = DISCORD_ID;
let memberInServer = true;

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

const fakeDiscord: typeof fetch = async (input, init) => {
  const url = String(input);
  const headers = new Headers(init?.headers);
  const body = typeof init?.body === "string" ? init.body : "";
  calls.push({
    method: init?.method ?? "GET",
    url,
    body,
    authorization: headers.get("authorization"),
  });
  if (url.endsWith("/oauth2/token")) {
    const code = new URLSearchParams(body).get("code") ?? "";
    return code.startsWith("good-code")
      ? json({ access_token: "discord-access-token-xyz", token_type: "Bearer", scope: "identify" })
      : json({ error: "invalid_grant" }, 400);
  }
  if (url.endsWith("/oauth2/token/revoke")) return new Response(null, { status: 200 });
  if (url.endsWith("/users/@me")) {
    return headers.get("authorization") === "Bearer discord-access-token-xyz"
      ? json({ id: identity, username: "trader", discriminator: "0", email: "never@example.com" })
      : json({ message: "401: Unauthorized" }, 401);
  }
  if (url.includes(`/guilds/${GUILD}/members/`)) {
    return new Response(null, { status: memberInServer ? 204 : 404 });
  }
  return json({ message: "unexpected" }, 500);
};

let database: TestDatabase;
let t: TestAuth;
let unconfigured: TestAuth;
let nextIp = 1;

const rows = async (text: string, params?: unknown[]) =>
  (await database.client.query<Record<string, unknown>>(text, params)).rows;

async function signedIn(auth: TestAuth, email: string): Promise<TestClient> {
  const client = createTestClient(auth.auth, {
    baseUrl: TEST_BASE_URL,
    ip: `198.51.100.${nextIp++}`,
  });
  await client.post("/email-signup/start", {
    email,
    password: "a long enough passphrase",
    acceptTerms: true,
  });
  const verified = await client.post("/email-signup/verify", { code: auth.latestCode(email) });
  expect(verified.status, `sign-up of ${email}`).toBe(200);
  return client;
}

/** Starts a link and returns the `state` Discord would send back. */
async function startLink(client: TestClient): Promise<string> {
  const response = await client.get("/discord/link");
  expect(response.status).toBe(302);
  const target = new URL(response.location ?? "");
  expect(target.origin + target.pathname).toBe("https://discord.com/oauth2/authorize");
  return target.searchParams.get("state") ?? "";
}

const idOf = async (email: string) =>
  String((await rows("SELECT id FROM users WHERE email = $1", [email]))[0]?.id);

beforeAll(async () => {
  database = await createTestDatabase();
  const discord = {
    app: { clientId: "client-id-123", clientSecret: "client-secret-xyz" },
    roles: { botToken: "bot-token-abc", guildId: GUILD, roleIds: { bronze: BRONZE_ROLE } },
    fetch: fakeDiscord,
  };
  // Each level has one lesson, so completing both earns Bronze.
  const academy = buildCatalog({
    courses: [
      { id: "foundations", level: 1, chapters: [{ id: "markets", lessons: [{ id: "m1" }] }] },
      { id: "quantower", level: 2, chapters: [{ id: "setup", lessons: [{ id: "q1" }] }] },
    ],
  });
  t = createTestAuth(database, { discord, academyCatalog: () => academy });
  unconfigured = createTestAuth(database);
}, 180_000);
afterAll(async () => {
  await database?.close();
});
beforeEach(() => {
  calls = [];
  identity = DISCORD_ID;
  memberInServer = true;
});

describe("starting a link", () => {
  it("needs a signed-in member: anyone else is sent to sign in", async () => {
    const stranger = createTestClient(t.auth, { baseUrl: TEST_BASE_URL, ip: "198.51.100.200" });
    const response = await stranger.get("/discord/link");
    expect(response.status).toBe(302);
    expect(response.location).toBe(`${TEST_BASE_URL}/sign-in?next=/settings`);
  });

  it("asks Discord for identify only, with a state and this site's callback", async () => {
    const member = await signedIn(t, "discord.start@example.com");
    const response = await member.get("/discord/link");
    const target = new URL(response.location ?? "");
    expect(target.searchParams.get("scope")).toBe("identify");
    expect(target.searchParams.get("client_id")).toBe("client-id-123");
    expect(target.searchParams.get("redirect_uri")).toBe(
      `${TEST_BASE_URL}/api/auth/discord/callback`,
    );
    expect(target.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // The secret never goes to the browser.
    expect(response.location).not.toContain("client-secret");
    expect(response.setCookies.join(";")).toMatch(/discord_state=.*HttpOnly/i);
  });

  it("says linking is unavailable while Discord is not set up", async () => {
    const member = await signedIn(unconfigured, "discord.unset@example.com");
    const response = await member.get("/discord/link");
    expect(response.location).toBe(`${TEST_BASE_URL}/settings?discord=unavailable`);
  });
});

describe("coming back from Discord", () => {
  it("links the member, stores id, username and date only, revokes the token, gives the Bronze role", async () => {
    const member = await signedIn(t, "discord.happy@example.com");
    await member.post("/academy/complete", { lessonId: "m1" });
    await member.post("/academy/complete", { lessonId: "q1" }); // Both levels: Bronze
    calls = [];
    const state = await startLink(member);
    const back = await member.get(`/discord/callback?code=good-code-1&state=${state}`);
    expect(back.location).toBe(`${TEST_BASE_URL}/settings?discord=linked`);

    const userId = await idOf("discord.happy@example.com");
    const stored = await rows("SELECT * FROM discord_links WHERE user_id = $1::uuid", [userId]);
    expect(stored).toHaveLength(1);
    expect(Object.keys(stored[0]!).sort()).toEqual([
      "discord_id",
      "discord_username",
      "linked_at",
      "user_id",
    ]);
    expect(stored[0]).toMatchObject({ discord_id: DISCORD_ID, discord_username: "trader" });

    // The token was revoked, and it is nowhere in the database.
    expect(calls.some((call) => call.url.endsWith("/oauth2/token/revoke"))).toBe(true);
    const dump =
      JSON.stringify(await rows("SELECT * FROM discord_links")) +
      JSON.stringify(await rows("SELECT * FROM accounts"));
    expect(dump).not.toContain("discord-access-token-xyz");
    expect(dump).not.toContain("never@example.com");
    // Discord is not a way to sign in: no Discord account row was made (hard rule 2).
    expect(
      await rows("SELECT provider_id FROM accounts WHERE provider_id <> 'credential'"),
    ).toEqual([]);

    const put = calls.find((call) => call.method === "PUT");
    expect(put?.url).toContain(`/guilds/${GUILD}/members/${DISCORD_ID}/roles/${BRONZE_ROLE}`);
    expect(put?.authorization).toBe("Bot bot-token-abc");
  });

  it("a state that is wrong, missing, or from another member's browser links nothing", async () => {
    const victim = await signedIn(t, "discord.victim@example.com");
    const attacker = await signedIn(t, "discord.attacker@example.com");
    const attackerState = await startLink(attacker);

    // The attacker's own callback URL, opened by the victim: the victim has no such state.
    const forced = await victim.get(
      `/discord/callback?code=good-code-attacker&state=${attackerState}`,
    );
    expect(forced.location).toBe(`${TEST_BASE_URL}/settings?discord=expired`);

    // The victim's own state with a wrong value, and no state at all.
    const victimState = await startLink(victim);
    expect(
      (await victim.get(`/discord/callback?code=good-code-2&state=${victimState}x`)).location,
    ).toBe(`${TEST_BASE_URL}/settings?discord=expired`);
    expect((await victim.get(`/discord/callback?code=good-code-3`)).location).toBe(
      `${TEST_BASE_URL}/settings?discord=expired`,
    );

    const victimId = await idOf("discord.victim@example.com");
    expect(await rows("SELECT 1 FROM discord_links WHERE user_id = $1::uuid", [victimId])).toEqual(
      [],
    );
    // Refused before Discord was ever asked.
    expect(calls.filter((call) => call.url.endsWith("/oauth2/token"))).toEqual([]);
  });

  it("the state cookie of one member does not work with another member's session", async () => {
    const first = await signedIn(t, "discord.first@example.com");
    const second = await signedIn(t, "discord.second@example.com");
    const state = await startLink(first);
    // Second member's session, first member's state cookie.
    for (const [name, value] of first.cookies)
      if (name.includes("discord_state")) second.cookies.set(name, value);
    const response = await second.get(`/discord/callback?code=good-code-4&state=${state}`);
    expect(response.location).toBe(`${TEST_BASE_URL}/settings?discord=expired`);
  });

  it("a callback can be used once: the state is spent", async () => {
    const member = await signedIn(t, "discord.once@example.com");
    const state = await startLink(member);
    await member.get(`/discord/callback?code=good-code-5&state=${state}`);
    const again = await member.get(`/discord/callback?code=good-code-5&state=${state}`);
    expect(again.location).toBe(`${TEST_BASE_URL}/settings?discord=expired`);
  });

  it("a Discord account that is already somebody else's is refused, and nothing changes", async () => {
    identity = OTHER_DISCORD_ID;
    const owner = await signedIn(t, "discord.owner@example.com");
    await owner.get(`/discord/callback?code=good-code-6&state=${await startLink(owner)}`);

    const copycat = await signedIn(t, "discord.copycat@example.com");
    const response = await copycat.get(
      `/discord/callback?code=good-code-7&state=${await startLink(copycat)}`,
    );
    expect(response.location).toBe(`${TEST_BASE_URL}/settings?discord=taken`);
    const copycatId = await idOf("discord.copycat@example.com");
    expect(await rows("SELECT 1 FROM discord_links WHERE user_id = $1::uuid", [copycatId])).toEqual(
      [],
    );
  });

  it("the member said no on Discord's screen, or Discord refused the code: nothing is linked", async () => {
    const member = await signedIn(t, "discord.refused@example.com");
    expect(
      (await member.get(`/discord/callback?error=access_denied&state=${await startLink(member)}`))
        .location,
    ).toBe(`${TEST_BASE_URL}/settings?discord=cancelled`);
    expect(
      (await member.get(`/discord/callback?code=bad-code&state=${await startLink(member)}`))
        .location,
    ).toBe(`${TEST_BASE_URL}/settings?discord=failed`);
    const userId = await idOf("discord.refused@example.com");
    expect(await rows("SELECT 1 FROM discord_links WHERE user_id = $1::uuid", [userId])).toEqual(
      [],
    );
  });

  it("linked, but not in the server yet: says so, so the member can join", async () => {
    memberInServer = false;
    identity = "523456789012345678";
    const member = await signedIn(t, "discord.outside@example.com");
    const back = await member.get(
      `/discord/callback?code=good-code-8&state=${await startLink(member)}`,
    );
    expect(back.location).toBe(`${TEST_BASE_URL}/settings?discord=linked-join`);
  });
});

describe("the role follows the rank", () => {
  it("linked before Bronze: no role yet, and the page says how to earn it", async () => {
    identity = "823456789012345678";
    const member = await signedIn(t, "discord.early@example.com");
    const back = await member.get(
      `/discord/callback?code=good-code-11&state=${await startLink(member)}`,
    );
    expect(back.location).toBe(`${TEST_BASE_URL}/settings?discord=linked-no-rank`);
    expect(calls.filter((call) => call.method === "PUT")).toEqual([]);
  });

  it("finishing both levels later gives the Bronze role at that moment", async () => {
    identity = "923456789012345678";
    const member = await signedIn(t, "discord.later@example.com");
    await member.get(`/discord/callback?code=good-code-12&state=${await startLink(member)}`);
    calls = [];
    const first = await member.post("/academy/complete", { lessonId: "m1" });
    expect(first.json).toMatchObject({ ok: true, newSteps: ["level-1"] });
    // One level is a step, not the rank: no role yet.
    expect(calls.filter((call) => call.method === "PUT")).toEqual([]);
    const done = await member.post("/academy/complete", { lessonId: "q1" });
    expect(done.json).toMatchObject({ ok: true, newSteps: ["level-2", "bronze"] });
    const put = calls.find((call) => call.method === "PUT");
    expect(put?.url).toContain(`/members/923456789012345678/roles/${BRONZE_ROLE}`);
  });
});

describe("unlinking", () => {
  it("removes the link and takes the rank role back", async () => {
    identity = "623456789012345678";
    const member = await signedIn(t, "discord.unlink@example.com");
    await member.get(`/discord/callback?code=good-code-9&state=${await startLink(member)}`);
    calls = [];
    const response = await member.post("/discord/unlink", {});
    expect(response.status).toBe(200);
    const userId = await idOf("discord.unlink@example.com");
    expect(await rows("SELECT 1 FROM discord_links WHERE user_id = $1::uuid", [userId])).toEqual(
      [],
    );
    expect(calls.find((call) => call.method === "DELETE")?.url).toContain(`/roles/${BRONZE_ROLE}`);
  });

  it("cannot be done by another website, even with the member's cookies", async () => {
    identity = "723456789012345678";
    const member = await signedIn(t, "discord.forged@example.com");
    await member.get(`/discord/callback?code=good-code-10&state=${await startLink(member)}`);
    const forged = createTestClient(t.auth, {
      baseUrl: TEST_BASE_URL,
      ip: "198.51.100.201",
      origin: "https://evil.example",
    });
    for (const [name, value] of member.cookies) forged.cookies.set(name, value);
    expect((await forged.post("/discord/unlink", {})).status).toBe(403);
    const userId = await idOf("discord.forged@example.com");
    expect(
      await rows("SELECT 1 FROM discord_links WHERE user_id = $1::uuid", [userId]),
    ).toHaveLength(1);
  });
});
