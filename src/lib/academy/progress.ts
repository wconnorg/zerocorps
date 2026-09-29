import { and, count, eq, gte, sql } from "drizzle-orm";
import { checkpointPasses, lessonProgress, rankHistory } from "../../db/schema.ts";
import type { AuthDatabase } from "../auth/create-auth.ts";
import { type Catalog, isOpen } from "./content.ts";
import { type Standing, standing } from "./standing.ts";

/**
 * What a member has done in the Academy, read from and written to the database.
 *
 * Every write takes the member from the session (the caller's job) and every id from the
 * catalog: a lesson that does not exist, is a draft, or sits in a course that is coming
 * soon cannot be marked, and a checkpoint cannot be taken before its lessons are done.
 * The answers to a checkpoint never leave this module: the result says which questions
 * were right, never what the right answer was.
 */

export type Progress = {
  completed: Set<string>;
  passed: Set<string>;
  /** Steps already stored in `rank_history`, with when each was earned. */
  steps: Map<string, Date>;
};

export async function readProgress(db: AuthDatabase, userId: string): Promise<Progress> {
  const [lessons, passes, ranks] = await Promise.all([
    db
      .select({ id: lessonProgress.lessonId })
      .from(lessonProgress)
      .where(eq(lessonProgress.userId, userId)),
    db
      .select({ id: checkpointPasses.chapterId })
      .from(checkpointPasses)
      .where(eq(checkpointPasses.userId, userId)),
    db
      .select({ rank: rankHistory.rank, at: rankHistory.achievedAt })
      .from(rankHistory)
      .where(eq(rankHistory.userId, userId)),
  ]);
  return {
    completed: new Set(lessons.map((row) => row.id)),
    passed: new Set(passes.map((row) => row.id)),
    steps: new Map(ranks.map((row) => [row.rank, row.at])),
  };
}

/**
 * Stores every step the member has now earned and not stored before. Never removes one.
 * Returns the steps that are new, so the page can celebrate them.
 */
async function recordSteps(
  db: AuthDatabase,
  userId: string,
  current: Standing,
  already: Map<string, Date>,
  now: Date,
): Promise<string[]> {
  const fresh = current.earnedSteps.filter((step) => !already.has(step));
  if (fresh.length === 0) return [];
  const inserted = await db
    .insert(rankHistory)
    .values(fresh.map((rank) => ({ userId, rank, achievedAt: now })))
    .onConflictDoNothing()
    .returning({ rank: rankHistory.rank });
  return inserted.map((row) => row.rank);
}

export type CompleteResult =
  { ok: true; newlyCompleted: boolean; newSteps: string[] } | { ok: false; reason: "not-found" };

/** Marks a lesson complete, once. Marking it again changes nothing. */
export async function completeLesson(
  db: AuthDatabase,
  catalog: Catalog,
  options: { userId: string; lessonId: string; now: Date },
): Promise<CompleteResult> {
  const lesson = catalog.lessons.get(options.lessonId);
  // One answer for "no such lesson", "not written yet" and "coming soon".
  if (!lesson || !isOpen(catalog, lesson)) return { ok: false, reason: "not-found" };

  const inserted = await db
    .insert(lessonProgress)
    .values({ userId: options.userId, lessonId: lesson.id, completedAt: options.now })
    .onConflictDoNothing()
    .returning({ id: lessonProgress.lessonId });

  const progress = await readProgress(db, options.userId);
  const now = standing(catalog, progress.completed, progress.passed);
  const newSteps = await recordSteps(db, options.userId, now, progress.steps, options.now);
  return { ok: true, newlyCompleted: inserted.length > 0, newSteps };
}

export type CheckpointResult =
  | {
      ok: true;
      score: number;
      outOf: number;
      pass: number;
      passed: boolean;
      /** Per question: right or not, and the lesson to reread when not. Never the answer. */
      results: { right: boolean; reread: string | null }[];
      newSteps: string[];
    }
  | { ok: false; reason: "not-found" | "lessons-not-done" | "invalid-answers" };

/**
 * Grades a checkpoint on the server. `answers[i]` is the option the member chose for
 * question i. A pass is stored once (the first); a fail is not stored at all.
 */
export async function submitCheckpoint(
  db: AuthDatabase,
  catalog: Catalog,
  options: { userId: string; chapterId: string; answers: number[]; now: Date },
): Promise<CheckpointResult> {
  const chapter = catalog.chapters.get(options.chapterId);
  const course = catalog.courses.find((candidate) => candidate.id === chapter?.courseId);
  const checkpoint = chapter?.checkpoint;
  if (!chapter || !checkpoint || !course || course.comingSoon) {
    return { ok: false, reason: "not-found" };
  }

  const progress = await readProgress(db, options.userId);
  const before = standing(catalog, progress.completed, progress.passed);
  if (!before.chapters.get(chapter.id)?.lessonsDone)
    return { ok: false, reason: "lessons-not-done" };

  const { answers } = options;
  const valid =
    answers.length === checkpoint.questions.length &&
    answers.every(
      (answer, index) =>
        Number.isInteger(answer) &&
        answer >= 0 &&
        answer < checkpoint.questions[index]!.options.length,
    );
  if (!valid) return { ok: false, reason: "invalid-answers" };

  const results = checkpoint.questions.map((question, index) => {
    const right = answers[index] === question.correct;
    return { right, reread: right ? null : question.reread };
  });
  const score = results.filter((result) => result.right).length;
  const passed = score >= checkpoint.pass;

  let newSteps: string[] = [];
  if (passed) {
    await db
      .insert(checkpointPasses)
      .values({
        userId: options.userId,
        chapterId: chapter.id,
        score,
        outOf: results.length,
        passedAt: options.now,
      })
      .onConflictDoNothing();
    const after = standing(catalog, progress.completed, new Set([...progress.passed, chapter.id]));
    newSteps = await recordSteps(db, options.userId, after, progress.steps, options.now);
  }

  return {
    ok: true,
    score,
    outOf: results.length,
    pass: checkpoint.pass,
    passed,
    results,
    newSteps,
  };
}

/** Lessons completed per day (UTC), from `since` on: the activity heatmap. */
export async function activityByDay(
  db: AuthDatabase,
  userId: string,
  since: Date,
): Promise<Map<string, number>> {
  const day = sql<string>`to_char(${lessonProgress.completedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;
  const rows = await db
    .select({ day, lessons: count() })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), gte(lessonProgress.completedAt, since)))
    .groupBy(day);
  return new Map(rows.map((row) => [row.day, Number(row.lessons)]));
}
