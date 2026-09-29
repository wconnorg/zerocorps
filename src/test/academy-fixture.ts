import type { Catalog, Chapter, Checkpoint, Course, Lesson } from "../lib/academy/content.ts";

/**
 * A small made-up Academy for tests, built directly rather than from files, so each test
 * says exactly the shape it needs. The real folder is read in `content.test.ts`.
 */

export type FixtureSpec = {
  courses: {
    id: string;
    level: number;
    comingSoon?: boolean;
    chapters: {
      id: string;
      lessons: { id: string; draft?: boolean }[];
      checkpoint?: Checkpoint;
    }[];
  }[];
};

export function buildCatalog(spec: FixtureSpec): Catalog {
  let chapterNumber = 0;
  const lessons = new Map<string, Lesson>();
  const chapters = new Map<string, Chapter>();
  const courses: Course[] = spec.courses.map((c) => ({
    id: c.id,
    title: c.id,
    summary: "",
    level: c.level,
    platform: null,
    comingSoon: c.comingSoon ?? false,
    chapters: c.chapters.map((ch) => {
      const chapter: Chapter = {
        id: ch.id,
        title: ch.id,
        summary: "",
        courseId: c.id,
        number: ++chapterNumber,
        checkpoint: ch.checkpoint ?? null,
        lessons: ch.lessons.map((l, i) => {
          const lesson: Lesson = {
            id: l.id,
            title: l.id,
            summary: "",
            minutes: 5,
            draft: l.draft ?? false,
            chapterId: ch.id,
            courseId: c.id,
            number: i + 1,
            parts: [],
            file: `${l.id}.md`,
          };
          lessons.set(l.id, lesson);
          return lesson;
        }),
      };
      chapters.set(ch.id, chapter);
      return chapter;
    }),
  }));
  return { courses, chapters, lessons };
}

/** A two-question checkpoint: the answers are option 1, then option 0. Pass with both. */
export const TWO_QUESTIONS: Checkpoint = {
  pass: 2,
  questions: [
    { question: "First?", options: ["wrong", "right", "wrong"], correct: 1, reread: "m1" },
    { question: "Second?", options: ["right", "wrong"], correct: 0, reread: null },
  ],
};
