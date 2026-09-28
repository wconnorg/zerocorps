import { type Catalog, type Chapter, type Course, isOpen, type Lesson } from "./content.ts";

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
 * - **Levels 1, 2 and 3 are the Rookie stage.** A member is a Rookie from sign-up; each
 *   finished level is a step within it, earned in any order, since The Platform is open
 *   from the start. What comes after Rookie is not defined yet.
 * - **Nothing is ever taken away.** Steps are stored once earned (`rank_history`), so a
 *   lesson added to a finished level later does not undo anyone's step.
 */

export const LEVEL_NAMES: Readonly<Record<number, string>> = {
  1: "Foundations",
  2: "The Platform",
  3: "Level 3",
};

/** The levels that make up the Rookie stage. */
export const ROOKIE_LEVELS = [1, 2, 3] as const;

export const RANK_TITLE = "Rookie";

/** The key stored in `rank_history` when a level is finished. */
export const levelStepKey = (level: number) => `rookie-level-${level}`;

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

  const earnedSteps = levels
    .filter((level) => level.finished && (ROOKIE_LEVELS as readonly number[]).includes(level.level))
    .map((level) => levelStepKey(level.level));

  return { chapters, levels, earnedSteps, lessonsOpen, lessonsDone, checkpointsPassed, next };
}
