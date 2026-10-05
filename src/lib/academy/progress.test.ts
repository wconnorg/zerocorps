import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCatalog, TWO_QUESTIONS } from "../../test/academy-fixture.ts";
import { createTestDatabase, type TestDatabase } from "../../test/test-database.ts";
import { activityByDay, completeLesson, readProgress, submitCheckpoint } from "./progress.ts";

/**
 * Saving what a member does, on a real Postgres (in the test process), tested against
 * the ways it could be misused: lessons that cannot be opened, a checkpoint taken early,
 * answers that are not answers, and trying to learn the answers from the result.
 */

let database: TestDatabase;
const rows = async (text: string, params?: unknown[]) =>
  (await database.client.query<Record<string, unknown>>(text, params)).rows;

const ACADEMY = buildCatalog({
  courses: [
    {
      id: "foundations",
      level: 1,
      chapters: [
        { id: "markets", lessons: [{ id: "m1" }, { id: "m2" }] },
        {
          id: "risk",
          lessons: [{ id: "r1" }, { id: "r2", draft: true }],
          checkpoint: TWO_QUESTIONS,
        },
      ],
    },
    {
      id: "sierra",
      level: 2,
      comingSoon: true,
      chapters: [{ id: "sierra-setup", lessons: [{ id: "s1" }] }],
    },
  ],
});
const WRITTEN = buildCatalog({
  courses: [
    {
      id: "foundations",
      level: 1,
      chapters: [
        { id: "markets", lessons: [{ id: "m1" }] },
        { id: "risk", lessons: [{ id: "r1" }], checkpoint: TWO_QUESTIONS },
      ],
    },
  ],
});

const NOW = new Date("2026-09-28T12:00:00.000Z");
let next = 0;
async function member(): Promise<string> {
  next += 1;
  const id = `00000000-0000-4000-8000-${String(next).padStart(12, "0")}`;
  await rows("INSERT INTO users (id, email) VALUES ($1::uuid, $2)", [
    id,
    `member${next}@example.com`,
  ]);
  return id;
}

beforeAll(async () => {
  database = await createTestDatabase();
}, 180_000);
afterAll(async () => {
  await database?.close();
});

describe("marking a lesson complete", () => {
  it("stores it once; marking it again changes nothing", async () => {
    const userId = await member();
    const first = await completeLesson(database.db, ACADEMY, { userId, lessonId: "m1", now: NOW });
    const again = await completeLesson(database.db, ACADEMY, { userId, lessonId: "m1", now: NOW });
    expect(first).toEqual({ ok: true, newlyCompleted: true, newSteps: [] });
    expect(again).toEqual({ ok: true, newlyCompleted: false, newSteps: [] });
    expect(
      await rows("SELECT lesson_id FROM lesson_progress WHERE user_id = $1::uuid", [userId]),
    ).toEqual([{ lesson_id: "m1" }]);
  });

  it("refuses, with ONE answer, a lesson that does not exist, a draft, or one that is coming soon", async () => {
    const userId = await member();
    for (const lessonId of ["no-such-lesson", "r2", "s1"]) {
      expect(
        await completeLesson(database.db, ACADEMY, { userId, lessonId, now: NOW }),
        lessonId,
      ).toEqual({
        ok: false,
        reason: "not-found",
      });
    }
    expect(await rows("SELECT 1 FROM lesson_progress WHERE user_id = $1::uuid", [userId])).toEqual(
      [],
    );
  });

  it("only touches the member it is given", async () => {
    const one = await member();
    const other = await member();
    await completeLesson(database.db, ACADEMY, { userId: one, lessonId: "m1", now: NOW });
    expect((await readProgress(database.db, other)).completed.size).toBe(0);
  });

  it("the database itself refuses an id of the wrong shape, however it arrives", async () => {
    const userId = await member();
    await expect(
      rows("INSERT INTO lesson_progress (user_id, lesson_id) VALUES ($1::uuid, $2)", [
        userId,
        "../../etc/passwd",
      ]),
    ).rejects.toMatchObject({ code: "23514" });
  });
});

describe("a chapter's checkpoint", () => {
  it("cannot be taken before the chapter's lessons are done", async () => {
    const userId = await member();
    const result = await submitCheckpoint(database.db, ACADEMY, {
      userId,
      chapterId: "risk",
      answers: [1, 0],
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "lessons-not-done" });
  });

  it("answers that are not answers are refused, and nothing is stored", async () => {
    const userId = await member();
    await completeLesson(database.db, ACADEMY, { userId, lessonId: "r1", now: NOW });
    for (const answers of [[1], [1, 0, 0], [1, 2], [-1, 0], [1.5, 0], [Number.NaN, 0]]) {
      expect(
        await submitCheckpoint(database.db, ACADEMY, {
          userId,
          chapterId: "risk",
          answers,
          now: NOW,
        }),
        JSON.stringify(answers),
      ).toEqual({ ok: false, reason: "invalid-answers" });
    }
    expect(
      await rows("SELECT 1 FROM checkpoint_passes WHERE user_id = $1::uuid", [userId]),
    ).toEqual([]);
  });

  it("a fail says which questions were wrong and what to reread, but never the right answer", async () => {
    const userId = await member();
    await completeLesson(database.db, ACADEMY, { userId, lessonId: "r1", now: NOW });
    const result = await submitCheckpoint(database.db, ACADEMY, {
      userId,
      chapterId: "risk",
      answers: [0, 0],
      now: NOW,
    });
    expect(result).toEqual({
      ok: true,
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
    // Nothing about the right option is in the result, however it is looked at.
    expect(JSON.stringify(result)).not.toMatch(/correct|options/);
    expect(
      await rows("SELECT 1 FROM checkpoint_passes WHERE user_id = $1::uuid", [userId]),
    ).toEqual([]);
  });

  it("a pass is stored once, the first one", async () => {
    const userId = await member();
    await completeLesson(database.db, ACADEMY, { userId, lessonId: "r1", now: NOW });
    const pass = await submitCheckpoint(database.db, ACADEMY, {
      userId,
      chapterId: "risk",
      answers: [1, 0],
      now: NOW,
    });
    expect(pass).toMatchObject({ ok: true, passed: true, score: 2 });
    await submitCheckpoint(database.db, ACADEMY, {
      userId,
      chapterId: "risk",
      answers: [1, 0],
      now: new Date(NOW.getTime() + 60_000),
    });
    const stored = await rows(
      "SELECT score, out_of, passed_at FROM checkpoint_passes WHERE user_id = $1::uuid",
      [userId],
    );
    expect(stored).toEqual([{ score: 2, out_of: 2, passed_at: NOW }]);
  });

  it("a chapter without a checkpoint, or in a course that is coming soon, has none to take", async () => {
    const userId = await member();
    for (const chapterId of ["markets", "sierra-setup", "no-such-chapter"]) {
      expect(
        await submitCheckpoint(database.db, ACADEMY, { userId, chapterId, answers: [0], now: NOW }),
        chapterId,
      ).toEqual({ ok: false, reason: "not-found" });
    }
  });
});

describe("the steps and the Bronze rank", () => {
  /** Level 1 (with a checkpoint) and Level 2, both fully written. */
  const BOTH = buildCatalog({
    courses: [
      {
        id: "foundations",
        level: 1,
        chapters: [
          { id: "markets", lessons: [{ id: "m1" }] },
          { id: "risk", lessons: [{ id: "r1" }], checkpoint: TWO_QUESTIONS },
        ],
      },
      { id: "quantower", level: 2, chapters: [{ id: "setup", lessons: [{ id: "q1" }] }] },
    ],
  });

  it("each level is a step and both make Bronze: each stored once, when it was earned", async () => {
    const userId = await member();
    expect(
      await completeLesson(database.db, BOTH, { userId, lessonId: "m1", now: NOW }),
    ).toMatchObject({ ok: true, newSteps: [] });
    // Not yet: the chapter with a checkpoint is not complete until it is passed.
    expect(
      await completeLesson(database.db, BOTH, { userId, lessonId: "r1", now: NOW }),
    ).toMatchObject({ ok: true, newSteps: [] });

    const later = new Date(NOW.getTime() + 3_600_000);
    const pass = await submitCheckpoint(database.db, BOTH, {
      userId,
      chapterId: "risk",
      answers: [1, 0],
      now: later,
    });
    expect(pass).toMatchObject({ ok: true, passed: true, newSteps: ["level-1"] });

    const latest = new Date(NOW.getTime() + 7_200_000);
    const second = await completeLesson(database.db, BOTH, {
      userId,
      lessonId: "q1",
      now: latest,
    });
    expect(second).toMatchObject({ ok: true, newSteps: ["level-2", "bronze"] });

    const again = await completeLesson(database.db, BOTH, { userId, lessonId: "m1", now: latest });
    expect(again).toMatchObject({ ok: true, newSteps: [] });
    expect(
      await rows(
        "SELECT rank, achieved_at FROM rank_history WHERE user_id = $1::uuid ORDER BY achieved_at, rank",
        [userId],
      ),
    ).toEqual([
      { rank: "level-1", achieved_at: later },
      { rank: "bronze", achieved_at: latest },
      { rank: "level-2", achieved_at: latest },
    ]);
  });

  it("a level finished before still counts towards Bronze after it has grown", async () => {
    const userId = await member();
    await completeLesson(database.db, BOTH, { userId, lessonId: "m1", now: NOW });
    await completeLesson(database.db, BOTH, { userId, lessonId: "r1", now: NOW });
    await submitCheckpoint(database.db, BOTH, {
      userId,
      chapterId: "risk",
      answers: [1, 0],
      now: NOW,
    });

    // Level 1 has since grown a lesson this member has not done.
    const grown = buildCatalog({
      courses: [
        {
          id: "foundations",
          level: 1,
          chapters: [
            { id: "markets", lessons: [{ id: "m1" }, { id: "m-new" }] },
            { id: "risk", lessons: [{ id: "r1" }], checkpoint: TWO_QUESTIONS },
          ],
        },
        { id: "quantower", level: 2, chapters: [{ id: "setup", lessons: [{ id: "q1" }] }] },
      ],
    });
    const second = await completeLesson(database.db, grown, {
      userId,
      lessonId: "q1",
      now: NOW,
    });
    expect(second).toMatchObject({ ok: true, newSteps: ["level-2", "bronze"] });
    expect((await readProgress(database.db, userId)).steps.has("level-1")).toBe(true);
  });

  it("one level alone earns no rank", async () => {
    const userId = await member();
    await completeLesson(database.db, WRITTEN, { userId, lessonId: "m1", now: NOW });
    await completeLesson(database.db, WRITTEN, { userId, lessonId: "r1", now: NOW });
    const pass = await submitCheckpoint(database.db, WRITTEN, {
      userId,
      chapterId: "risk",
      answers: [1, 0],
      now: NOW,
    });
    expect(pass).toMatchObject({ ok: true, passed: true, newSteps: ["level-1"] });
    expect((await readProgress(database.db, userId)).steps.has("bronze")).toBe(false);
  });
});

describe("the activity heatmap", () => {
  it("counts lessons per UTC day, from the date asked for", async () => {
    const userId = await member();
    const at = (iso: string) => new Date(iso);
    await completeLesson(database.db, ACADEMY, {
      userId,
      lessonId: "m1",
      now: at("2026-09-26T23:30:00Z"),
    });
    await completeLesson(database.db, ACADEMY, {
      userId,
      lessonId: "m2",
      now: at("2026-09-27T00:30:00Z"),
    });
    await completeLesson(database.db, ACADEMY, {
      userId,
      lessonId: "r1",
      now: at("2026-09-27T18:00:00Z"),
    });
    const days = await activityByDay(database.db, userId, at("2026-09-27T00:00:00Z"));
    expect([...days]).toEqual([["2026-09-27", 2]]);
  });
});
