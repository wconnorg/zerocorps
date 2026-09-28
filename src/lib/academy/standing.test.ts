import { describe, expect, it } from "vitest";
import { buildCatalog as build, TWO_QUESTIONS } from "../../test/academy-fixture.ts";
import { levelStepKey, standing } from "./standing.ts";

/**
 * The rank rules, on a small made-up Academy: Level 1 with two chapters, Level 2 with a
 * course that is open and one that is coming soon.
 */

const ACADEMY = build({
  courses: [
    {
      id: "foundations",
      level: 1,
      chapters: [
        { id: "markets", lessons: [{ id: "m1" }, { id: "m2" }] },
        { id: "risk", lessons: [{ id: "r1" }], checkpoint: TWO_QUESTIONS },
      ],
    },
    {
      id: "quantower",
      level: 2,
      chapters: [{ id: "setup", lessons: [{ id: "q1" }, { id: "q2", draft: true }] }],
    },
    {
      id: "sierra",
      level: 2,
      comingSoon: true,
      chapters: [{ id: "sierra-setup", lessons: [{ id: "s1" }] }],
    },
  ],
});

const done = (...ids: string[]) => new Set(ids);

describe("a chapter", () => {
  it("is complete when every open lesson is done, and there is no checkpoint", () => {
    const s = standing(ACADEMY, done("m1", "m2"), done());
    expect(s.chapters.get("markets")).toMatchObject({
      complete: true,
      doneLessons: 2,
      nextLesson: null,
    });
  });

  it("with a checkpoint, needs the checkpoint passed as well", () => {
    expect(standing(ACADEMY, done("r1"), done()).chapters.get("risk")).toMatchObject({
      lessonsDone: true,
      checkpointPassed: false,
      complete: false,
    });
    expect(standing(ACADEMY, done("r1"), done("risk")).chapters.get("risk")?.complete).toBe(true);
  });

  it("a passed checkpoint means nothing until the lessons are done too", () => {
    expect(standing(ACADEMY, done(), done("risk")).chapters.get("risk")?.complete).toBe(false);
  });

  it("drafts are not counted: done means the lessons that can be opened", () => {
    const setup = standing(ACADEMY, done("q1"), done()).chapters.get("setup");
    expect(setup).toMatchObject({ openLessons: 1, complete: true, fullyWritten: false });
  });

  it("nothing in a course that is coming soon is open or complete, whatever was recorded", () => {
    const sierra = standing(ACADEMY, done("s1"), done()).chapters.get("sierra-setup");
    expect(sierra).toMatchObject({ open: false, complete: false, doneLessons: 0 });
  });
});

describe("a level, and the Rookie steps", () => {
  it("Level 1 is finished when all its chapters are complete, and that is step 1", () => {
    const s = standing(ACADEMY, done("m1", "m2", "r1"), done("risk"));
    expect(s.levels.find((l) => l.level === 1)?.finished).toBe(true);
    expect(s.earnedSteps).toEqual([levelStepKey(1)]);
  });

  it("a level with a draft left in it cannot be finished yet, even with everything open done", () => {
    const s = standing(ACADEMY, done("q1"), done());
    expect(s.levels.find((l) => l.level === 2)).toMatchObject({
      finished: false,
      chaptersComplete: 1,
    });
    expect(s.earnedSteps).toEqual([]);
  });

  it("a course that is coming soon does not hold Level 2 back", () => {
    const written = build({
      courses: [
        { id: "quantower", level: 2, chapters: [{ id: "setup", lessons: [{ id: "q1" }] }] },
        {
          id: "sierra",
          level: 2,
          comingSoon: true,
          chapters: [{ id: "sierra-setup", lessons: [{ id: "s1", draft: true }] }],
        },
      ],
    });
    expect(standing(written, done("q1"), done()).earnedSteps).toEqual([levelStepKey(2)]);
  });

  it("levels can be finished in any order: The Platform is open from the start", () => {
    const written = build({
      courses: [
        { id: "foundations", level: 1, chapters: [{ id: "markets", lessons: [{ id: "m1" }] }] },
        { id: "quantower", level: 2, chapters: [{ id: "setup", lessons: [{ id: "q1" }] }] },
      ],
    });
    expect(standing(written, done("q1"), done()).earnedSteps).toEqual([levelStepKey(2)]);
  });

  it("a level with nothing in it, or only a coming-soon course, is never finished", () => {
    const empty = build({
      courses: [
        {
          id: "sierra",
          level: 2,
          comingSoon: true,
          chapters: [{ id: "sierra-setup", lessons: [{ id: "s1" }] }],
        },
      ],
    });
    expect(standing(empty, done("s1"), done()).earnedSteps).toEqual([]);
  });

  it("a lesson id that no longer exists counts for nothing", () => {
    expect(standing(ACADEMY, done("renamed-away"), done("gone")).lessonsDone).toBe(0);
  });
});

describe("where Continue leads", () => {
  it("to the first open lesson not yet done, in order", () => {
    const s = standing(ACADEMY, done("m1"), done());
    expect(s.next?.chapter.id).toBe("markets");
    expect(s.next?.lesson?.id).toBe("m2");
  });

  it("to a checkpoint that is ready, before moving on", () => {
    const s = standing(ACADEMY, done("m1", "m2", "r1"), done());
    expect(s.next?.chapter.id).toBe("risk");
    expect(s.next?.lesson).toBeNull();
  });

  it("to the next level once one is finished, and nowhere when everything open is done", () => {
    expect(standing(ACADEMY, done("m1", "m2", "r1"), done("risk")).next?.lesson?.id).toBe("q1");
    expect(standing(ACADEMY, done("m1", "m2", "r1", "q1"), done("risk")).next).toBeNull();
  });

  it("counts what is open and what is done, for the member's record", () => {
    const s = standing(ACADEMY, done("m1", "r1"), done("risk"));
    expect(s).toMatchObject({ lessonsOpen: 4, lessonsDone: 2, checkpointsPassed: 1 });
  });
});
