import { describe, expect, it } from "vitest";
import { buildCatalog as build, TWO_QUESTIONS } from "../../test/academy-fixture.ts";
import { celebrated } from "./ranks.ts";
import { BRONZE_KEY, levelStepKey, rankKeyOf, standing, stepsEarned } from "./standing.ts";

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

describe("a level, a step towards Bronze", () => {
  it("Level 1 is finished when all its chapters are complete, and that is step 1", () => {
    const s = standing(ACADEMY, done("m1", "m2", "r1"), done("risk"));
    expect(s.levels.find((l) => l.level === 1)?.finished).toBe(true);
    // One level is a step, not the rank.
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

  it("levels can be finished in any order: Order Flow Software is open from the start", () => {
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

describe("the Bronze rank", () => {
  /** Both levels fully written, Level 1 with a checkpoint. */
  const TWO_LEVELS = build({
    courses: [
      {
        id: "foundations",
        level: 1,
        chapters: [
          { id: "markets", lessons: [{ id: "m1" }, { id: "m2" }], checkpoint: TWO_QUESTIONS },
        ],
      },
      { id: "quantower", level: 2, chapters: [{ id: "setup", lessons: [{ id: "q1" }] }] },
      {
        id: "sierra",
        level: 2,
        comingSoon: true,
        chapters: [{ id: "sierra-setup", lessons: [{ id: "s1" }] }],
      },
    ],
  });

  it("is earned by finishing both levels, every chapter and its checkpoint", () => {
    expect(standing(TWO_LEVELS, done("m1", "m2"), done("markets")).earnedSteps).toEqual([
      levelStepKey(1),
    ]);
    expect(standing(TWO_LEVELS, done("m1", "m2", "q1"), done()).earnedSteps).toEqual([
      levelStepKey(2),
    ]);
    expect(standing(TWO_LEVELS, done("m1", "m2", "q1"), done("markets")).earnedSteps).toEqual([
      levelStepKey(1),
      levelStepKey(2),
      BRONZE_KEY,
    ]);
  });

  it("is not earned by finishing the first chapter, as Rookie used to be", () => {
    expect(standing(ACADEMY, done("m1", "m2"), done()).earnedSteps).toEqual([]);
  });

  it("counts a level finished before, even after it has grown: nothing is taken away", () => {
    // Level 1 was finished and stored; it has since grown a lesson the member has not done.
    const grown = build({
      courses: [
        {
          id: "foundations",
          level: 1,
          chapters: [{ id: "markets", lessons: [{ id: "m1" }, { id: "m-new" }] }],
        },
        { id: "quantower", level: 2, chapters: [{ id: "setup", lessons: [{ id: "q1" }] }] },
      ],
    });
    const now = standing(grown, done("m1", "q1"), done());
    expect(now.earnedSteps).toEqual([levelStepKey(2)]);
    expect(stepsEarned(now, new Set([levelStepKey(1)]))).toEqual([levelStepKey(2), BRONZE_KEY]);
    // Without the stored step, no Bronze.
    expect(stepsEarned(now, new Set())).toEqual([levelStepKey(2)]);
  });

  it("is what Discord's roles follow: the rank key, or none before it is earned", () => {
    expect(rankKeyOf(new Set([BRONZE_KEY, levelStepKey(1)]))).toBe(BRONZE_KEY);
    expect(rankKeyOf(new Set([levelStepKey(1), levelStepKey(2)]))).toBeNull();
    expect(rankKeyOf(new Set())).toBeNull();
  });

  it("is what the moment celebrates when it comes, and a level otherwise", () => {
    expect(celebrated([levelStepKey(2), BRONZE_KEY])).toEqual({ kind: "rank", title: "Bronze" });
    expect(celebrated([levelStepKey(1)])).toEqual({ kind: "level", title: "Fundamentals" });
    expect(celebrated([levelStepKey(2)])).toEqual({ kind: "level", title: "Order Flow Software" });
    expect(celebrated([])).toBeNull();
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
