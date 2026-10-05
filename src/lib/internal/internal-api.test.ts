import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../test/test-database.ts";
import { createLimiter, LIMITS } from "../auth/limits.ts";
import { discordProfile, type InternalDeps, linkedRanks, stats } from "./internal-api.ts";

/**
 * The internal API Agent Zero calls, on a real Postgres. What matters most is what it
 * refuses: no secret configured, a wrong or missing secret, a malformed id, and ever
 * returning more than the contract's fields.
 */

const SECRET = "internal-api-secret-for-tests-0000000000";
const LINKED = "123456789012345678";
const UNKNOWN = "223456789012345678";

let database: TestDatabase;
let deps: InternalDeps;
const rows = async (text: string, params?: unknown[]) =>
  (await database.client.query<Record<string, unknown>>(text, params)).rows;
const call = (secret: string | null) =>
  new Request("https://zerocorps.org/api/internal/x", {
    headers: secret === null ? {} : { "x-internal-secret": secret },
  });
const body = async (response: Response) => JSON.parse(await response.text());

beforeAll(async () => {
  database = await createTestDatabase();
  deps = { db: database.db, limiter: createLimiter(database.db, "fixture-hmac"), secret: SECRET };
  const member = "00000000-0000-4000-8000-000000000001";
  await rows(
    "INSERT INTO users (id, email, email_verified, username) VALUES ($1::uuid, 'linked@example.com', true, 'trader_99')",
    [member],
  );
  await rows(
    "INSERT INTO discord_links (user_id, discord_id, discord_username) VALUES ($1::uuid, $2, 'trader')",
    [member, LINKED],
  );
  await rows("INSERT INTO rank_history (user_id, rank) VALUES ($1::uuid, 'bronze')", [member]);
  // Counted: verified and onboarded. Not counted: no username yet, or not verified.
  await rows(
    "INSERT INTO users (email, email_verified, username) VALUES ('other@example.com', true, 'other_one')",
  );
  await rows("INSERT INTO users (email, email_verified) VALUES ('new@example.com', true)");
  await rows(
    "INSERT INTO users (email, email_verified, username) VALUES ('unverified@example.com', false, 'unverified')",
  );
}, 180_000);
afterAll(async () => {
  await database?.close();
});

describe("who may call it", () => {
  it("nobody, while no secret is configured: it is switched off", async () => {
    const off = { ...deps, secret: undefined };
    expect((await discordProfile(off, call(SECRET), LINKED)).status).toBe(503);
    expect((await stats(off, call(SECRET))).status).toBe(503);
  });

  it("not without the secret, or with a wrong one", async () => {
    for (const secret of [null, "", "wrong", `${SECRET}x`, SECRET.slice(0, -1)]) {
      expect((await discordProfile(deps, call(secret), LINKED)).status, String(secret)).toBe(401);
      expect((await stats(deps, call(secret))).status, String(secret)).toBe(401);
    }
  });
});

describe("a Discord user's profile", () => {
  it("a linked member: linked, their ZeroCorps username and their rank, and nothing else", async () => {
    const response = await discordProfile(deps, call(SECRET), LINKED);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const data = await body(response);
    expect(data).toEqual({ linked: true, username: "trader_99", rank: "bronze" });
    expect(JSON.stringify(data)).not.toMatch(/@|example\.com/);
  });

  it("someone who never linked: 404, linked false", async () => {
    const response = await discordProfile(deps, call(SECRET), UNKNOWN);
    expect(response.status).toBe(404);
    expect(await body(response)).toEqual({ linked: false });
  });

  it("an id that is not a Discord id is refused before anything is looked up", async () => {
    for (const id of ["abc", "123", "1234567890123456789012", "123456789012345678' OR 1=1"]) {
      expect((await discordProfile(deps, call(SECRET), id)).status, id).toBe(400);
    }
  });
});

describe("every linked member's rank, for the bot's role sync", () => {
  it("lists each linked member once: Discord id and rank key, nothing else", async () => {
    const second = "00000000-0000-4000-8000-000000000009";
    await rows(
      "INSERT INTO users (id, email, email_verified, username) VALUES ($1::uuid, 'second.linked@example.com', true, 'second')",
      [second],
    );
    await rows(
      "INSERT INTO discord_links (user_id, discord_id, discord_username) VALUES ($1::uuid, '323456789012345678', 'second')",
      [second],
    );
    // A level step without the rank: still no rank.
    await rows("INSERT INTO rank_history (user_id, rank) VALUES ($1::uuid, 'level-2')", [second]);

    const response = await linkedRanks(deps, call(SECRET));
    expect(response.status).toBe(200);
    const data = await body(response);
    const sorted = [...data.members].sort((a, b) => a.discordId.localeCompare(b.discordId));
    expect(sorted).toEqual([
      { discordId: LINKED, rank: "bronze" },
      { discordId: "323456789012345678", rank: null },
    ]);
    expect(JSON.stringify(data)).not.toMatch(/@|trader_99|second/);
  });

  it("is refused without the secret", async () => {
    expect((await linkedRanks(deps, call("wrong"))).status).toBe(401);
  });
});

describe("stats", () => {
  it("counts academy members: verified and onboarded only", async () => {
    const response = await stats(deps, call(SECRET));
    // The two verified, onboarded members from the start, and the one the ranks test added.
    expect(await body(response)).toEqual({ academyMembers: 3 });
  });
});

describe("the limit", () => {
  it("is counted only once the caller is known, so a stranger cannot lock the bot out", async () => {
    const fresh = { ...deps, limiter: createLimiter(database.db, "fixture-hmac-2") };
    for (let i = 0; i < LIMITS.internalApi.max + 5; i++) await stats(fresh, call("wrong"));
    expect((await stats(fresh, call(SECRET))).status).toBe(200);
    let last = 200;
    for (let i = 0; i < LIMITS.internalApi.max + 1; i++)
      last = (await stats(fresh, call(SECRET))).status;
    expect(last).toBe(429);
  }, 240_000);
});
