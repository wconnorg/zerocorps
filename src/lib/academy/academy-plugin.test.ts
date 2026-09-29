import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCatalog, TWO_QUESTIONS } from "../../test/academy-fixture.ts";
import { createTestClient, type TestClient } from "../../test/auth-client.ts";
import { createTestAuth, TEST_BASE_URL, type TestAuth } from "../../test/test-auth.ts";
import { createTestDatabase, type TestDatabase } from "../../test/test-database.ts";
import { LIMITS } from "../auth/limits.ts";

/**
 * The Academy's two endpoints, through the real auth configuration and over HTTP, because
 * the origin check, the session check and the limiter exist only there.
 */

const ACADEMY = buildCatalog({
  courses: [
    {
      id: "foundations",
      level: 1,
      chapters: [
        { id: "markets", lessons: [{ id: "m1" }] },
        {
          id: "risk",
          lessons: [{ id: "r1" }, { id: "r-draft", draft: true }],
          checkpoint: TWO_QUESTIONS,
        },
      ],
    },
  ],
});

let database: TestDatabase;
let t: TestAuth;
let nextIp = 1;

const rows = async (text: string, params?: unknown[]) =>
  (await database.client.query<Record<string, unknown>>(text, params)).rows;

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

const idOf = async (email: string) =>
  String((await rows("SELECT id FROM users WHERE email = $1", [email]))[0]?.id);

beforeAll(async () => {
  database = await createTestDatabase();
  t = createTestAuth(database, { academyCatalog: () => ACADEMY });
}, 180_000);
afterAll(async () => {
  await database?.close();
});

describe("who may call them", () => {
  it("nobody who is signed out", async () => {
    const stranger = createTestClient(t.auth, { baseUrl: TEST_BASE_URL, ip: "198.51.100.200" });
    expect((await stranger.post("/academy/complete", { lessonId: "m1" })).status).toBe(401);
    expect(
      (await stranger.post("/academy/checkpoint", { chapterId: "risk", answers: [1, 0] })).status,
    ).toBe(401);
  });

  it("no other website, even with the member's own cookies", async () => {
    const member = await signedInMember("academy.crosssite@example.com");
    const forged = createTestClient(t.auth, {
      baseUrl: TEST_BASE_URL,
      ip: "198.51.100.201",
      origin: "https://evil.example",
    });
    for (const [name, value] of member.cookies) forged.cookies.set(name, value);

    expect((await forged.post("/academy/complete", { lessonId: "m1" })).status).toBe(403);
    const asForm = await forged.postForm("/academy/complete", { lessonId: "m1" });
    expect([403, 415]).toContain(asForm.status);
    const userId = await idOf("academy.crosssite@example.com");
    expect(await rows("SELECT 1 FROM lesson_progress WHERE user_id = $1::uuid", [userId])).toEqual(
      [],
    );
  });

  it("only for themselves: another member's id in the body is ignored", async () => {
    const mallory = await signedInMember("academy.mallory@example.com");
    await signedInMember("academy.victim@example.com");
    const victimId = await idOf("academy.victim@example.com");

    const response = await mallory.post("/academy/complete", {
      lessonId: "m1",
      userId: victimId,
      user_id: victimId,
    });
    expect(response.status).toBe(200);
    expect(
      await rows("SELECT 1 FROM lesson_progress WHERE user_id = $1::uuid", [victimId]),
    ).toEqual([]);
    const malloryId = await idOf("academy.mallory@example.com");
    expect(
      await rows("SELECT lesson_id FROM lesson_progress WHERE user_id = $1::uuid", [malloryId]),
    ).toEqual([{ lesson_id: "m1" }]);
  });
});

describe("marking a lesson complete", () => {
  it("works for an open lesson, and answers 404 for a draft or an unknown one", async () => {
    const member = await signedInMember("academy.marker@example.com");
    // m1 is the whole of Chapter 1 in this fixture, so it earns the Rookie rank.
    expect((await member.post("/academy/complete", { lessonId: "m1" })).json).toEqual({
      ok: true,
      newSteps: ["rookie"],
    });
    for (const lessonId of ["r-draft", "no-such-lesson"]) {
      const refused = await member.post("/academy/complete", { lessonId });
      expect(refused.status, lessonId).toBe(404);
      expect(refused.json).toMatchObject({ code: "NOT_FOUND" });
    }
  });

  it("refuses an id that is not a string, or far too long, before touching anything", async () => {
    const member = await signedInMember("academy.shapes@example.com");
    for (const lessonId of [42, "", "x".repeat(81), ["m1"]]) {
      expect((await member.post("/academy/complete", { lessonId })).status, String(lessonId)).toBe(
        400,
      );
    }
  });
});

describe("a checkpoint", () => {
  it("is refused until the chapter's lessons are done, then graded without giving answers away", async () => {
    const member = await signedInMember("academy.tester@example.com");
    const early = await member.post("/academy/checkpoint", { chapterId: "risk", answers: [1, 0] });
    expect(early.status).toBe(403);
    expect(early.json).toMatchObject({ code: "LESSONS_NOT_DONE" });

    await member.post("/academy/complete", { lessonId: "r1" });
    const fail = await member.post("/academy/checkpoint", { chapterId: "risk", answers: [0, 0] });
    expect(fail.status).toBe(200);
    expect(fail.json).toEqual({
      score: 1,
      outOf: 2,
      pass: 2,
      passed: false,
      results: [
        { right: false, reread: "m1" },
        { right: true, reread: null },
      ],
      newSteps: [],
    });

    await member.post("/academy/complete", { lessonId: "m1" });
    const pass = await member.post("/academy/checkpoint", { chapterId: "risk", answers: [1, 0] });
    // Both chapters are complete, but Level 1 still has a draft in it: no step for half a level.
    expect(pass.json).toMatchObject({ passed: true, score: 2, newSteps: [] });
  });

  it("answers of the wrong shape are refused", async () => {
    const member = await signedInMember("academy.shapes2@example.com");
    await member.post("/academy/complete", { lessonId: "r1" });
    for (const answers of [[], [1], ["1", "0"], [1.5, 0], [-1, 0], Array(51).fill(0)]) {
      const response = await member.post("/academy/checkpoint", { chapterId: "risk", answers });
      expect(response.status, JSON.stringify(answers)).toBe(400);
    }
  });

  it("can only be tried a few times an hour, pass or fail, per member", async () => {
    const member = await signedInMember("academy.guesser@example.com");
    await member.post("/academy/complete", { lessonId: "r1" });
    let last = 200;
    for (let i = 0; i < LIMITS.checkpointSubmitPerUser.max + 1; i++) {
      last = (await member.post("/academy/checkpoint", { chapterId: "risk", answers: [0, 1] }))
        .status;
      if (last !== 200) break;
    }
    expect(last).toBe(429);

    const other = await signedInMember("academy.not.the.guesser@example.com");
    await other.post("/academy/complete", { lessonId: "r1" });
    expect(
      (await other.post("/academy/checkpoint", { chapterId: "risk", answers: [0, 1] })).status,
    ).toBe(200);
  }, 240_000);
});
