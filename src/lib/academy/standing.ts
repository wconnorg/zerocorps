import { type Catalog, type Chapter, type Course, isOpen, type Lesson } from "./content.ts";
import { BRONZE_KEY, BRONZE_LEVELS, LEVEL_NAMES, levelStepKey } from "./ranks.ts";

/**
 * Where a member stands: which chapters are complete, which levels are finished, and so
 * what their rank is. A pure function of the catalog and what the member has done, so it
 * can be tested without a database and computed the same way everywhere.
 *
 * The rules, as the owner set them (DECISIONS.md, "The Academy's structure, ranks and
 * lessons"):
 *
 * - **A chapter is complete** when every lesson in it that can be opened is marked
 *   complete, and its checkpoint is passed if it has one. A chapter with nothing open yet
 *   cannot be complete.
 * - **A level is finished** when every chapter of every course in it is written (no drafts
 *   left) and complete. A course that is coming soon does not count, so while Sierra Chart
 *   is coming soon, finishing Level 2 means finishing the Quantower course. A level that is
 *   not fully written yet cannot be finished: nobody earns a step for half a level.
 * - **Bronze is the rank, and the only one so far** (owner, 2026-10-05: "completing those
 *   two sections gives user the bronze rank", and no Rookie before it): earned by finishing
 *   Level 1, Fundamentals, and Level 2, Order Flow Software, in any order, since both are
 *   open from the start. Each finished level is a step towards it. Before Bronze a member
 *   has no rank. The Discord role follows the rank.
 * - **Nothing is ever taken away.** The rank and the steps are stored once earned
 *   (`rank_history`), so a lesson added later does not undo anyone's rank, and a level
 *   finished before still counts towards Bronze after it has grown.
 */

// The names and keys live in `ranks.ts`, which the browser can load too.
export {
  BRONZE_KEY,
  BRONZE_LEVELS,
  celebrated,
  LEVEL_NAMES,
  levelName,
  levelOfStep,
  levelStepKey,
  RANK_TITLE,
} from "./ranks.ts";

/**
 * The member's rank key from the steps stored for them, or null before they have one. It
 * is what Discord's roles follow: Agent Zero reads it from the internal API. A NEW key must
 * be set up in the bot before the site sends it (docs/INTERNAL-API.md, "What Agent Zero
 * relies on"); until then the bot changes nothing for members holding it.
 */
export const rankKeyOf = (steps: { has(key: string): boolean }): string | null =>
  steps.has(BRONZE_KEY) ? BRONZE_KEY : null;

/**
 * Every step to hold now: the levels finished by what the member has done, and Bronze
 * once every level it needs is finished, counting levels stored before (a level that has
 * grown since still counts: nothing earned is taken away).
 */
export function stepsEarned(
  current: Pick<Standing, "earnedSteps">,
  stored: { has(key: string): boolean },
): string[] {
  const steps = [...current.earnedSteps];
  const finished = (level: number) =>
    stored.has(levelStepKey(level)) || steps.includes(levelStepKey(level));
  if (!steps.includes(BRONZE_KEY) && BRONZE_LEVELS.every(finished)) steps.push(BRONZE_KEY);
  return steps;
}

export type ChapterStanding = {
  chapter: Chapter;
  course: Course;
  /** Something in it can be opened now. */
  open: boolean;
  /** Every lesson is written: no drafts. */
  fullyWritten: boolean;
  openLessons: number;
  doneLessons: number;
  lessonsDone: boolean;
  hasCheckpoint: boolean;
  checkpointPassed: boolean;
  complete: boolean;
  /** The first open lesson not yet done, if any. */
  nextLesson: Lesson | null;
};

export type LevelStanding = {
  level: number;
  name: string;
  courses: Course[];
  finished: boolean;
  chaptersOpen: number;
  chaptersComplete: number;
};

export type Standing = {
  chapters: ReadonlyMap<string, ChapterStanding>;
  levels: LevelStanding[];
  /** The `rank_history` keys this member has earned by what they have done. */
  earnedSteps: string[];
  lessonsOpen: number;
  lessonsDone: number;
  checkpointsPassed: number;
  /** Where "Continue" leads: the next lesson, or a checkpoint that is ready. Null when nothing is left. */
  next: { chapter: Chapter; lesson: Lesson | null } | null;
};

export function standing(
  catalog: Catalog,
  completedLessons: ReadonlySet<string>,
  passedCheckpoints: ReadonlySet<string>,
): Standing {
  const chapters = new Map<string, ChapterStanding>();
  let lessonsOpen = 0;
  let lessonsDone = 0;
  let checkpointsPassed = 0;
  let next: Standing["next"] = null;

  for (const course of catalog.courses) {
    for (const chapter of course.chapters) {
      const open = chapter.lessons.filter((lesson) => isOpen(catalog, lesson));
      const done = open.filter((lesson) => completedLessons.has(lesson.id));
      const lessonsAllDone = open.length > 0 && done.length === open.length;
      const hasCheckpoint = chapter.checkpoint !== null && !course.comingSoon;
      const checkpointPassed = hasCheckpoint && passedCheckpoints.has(chapter.id);
      const complete = lessonsAllDone && (!hasCheckpoint || checkpointPassed);
      const nextLesson = open.find((lesson) => !completedLessons.has(lesson.id)) ?? null;

      lessonsOpen += open.length;
      lessonsDone += done.length;
      if (checkpointPassed) checkpointsPassed += 1;
      if (!next && open.length > 0 && !complete) next = { chapter, lesson: nextLesson };

      chapters.set(chapter.id, {
        chapter,
        course,
        open: open.length > 0,
        fullyWritten:
          chapter.lessons.length > 0 && chapter.lessons.every((lesson) => !lesson.draft),
        openLessons: open.length,
        doneLessons: done.length,
        lessonsDone: lessonsAllDone,
        hasCheckpoint,
        checkpointPassed,
        complete,
        nextLesson,
      });
    }
  }

  const levelNumbers = [...new Set(catalog.courses.map((course) => course.level))].sort(
    (a, b) => a - b,
  );
  const levels = levelNumbers.map((level): LevelStanding => {
    const courses = catalog.courses.filter((course) => course.level === level);
    const counted = courses.filter((course) => !course.comingSoon);
    const counts = counted.flatMap((course) => course.chapters.map((c) => chapters.get(c.id)!));
    return {
      level,
      name: LEVEL_NAMES[level] ?? `Level ${level}`,
      courses,
      finished: counts.length > 0 && counts.every((entry) => entry.fullyWritten && entry.complete),
      chaptersOpen: counts.filter((entry) => entry.open).length,
      chaptersComplete: counts.filter((entry) => entry.complete).length,
    };
  });

  const finishedSteps = levels
    .filter((level) => level.finished)
    .map((level) => levelStepKey(level.level));
  const bronzeNow = BRONZE_LEVELS.every((number) =>
    levels.some((level) => level.level === number && level.finished),
  );
  const earnedSteps = [...finishedSteps, ...(bronzeNow ? [BRONZE_KEY] : [])];

  return { chapters, levels, earnedSteps, lessonsOpen, lessonsDone, checkpointsPassed, next };
}
