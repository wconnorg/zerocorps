import { describe, expect, it } from "vitest";
import type { Catalog, Chapter, Course, Lesson } from "../academy/content.ts";
import { buildBrain, GENERATED_BY } from "./notes.ts";
import type { BrainData, BrainMember } from "./read.ts";

/**
 * The brain's notes as text. The member-typed fields carry attacks on purpose: HTML,
 * links, tags, backticks and an attempt to break out of the frontmatter.
 */

const NOW = new Date("2026-09-30T12:34:00Z");

function lesson(id: string, chapter: string, number: number, draft = false): Lesson {
  return {
    id,
    title: id.replace(/-/g, " "),
    summary: "",
    minutes: 5,
    draft,
    chapterId: chapter,
    courseId: "foundations",
    number,
    parts: [],
    file: `${id}.md`,
  };
}

function catalog(): Catalog {
  const lessons = [
    lesson("what-a-market-is", "how-markets-work", 1),
    lesson("orders-and-fills", "how-markets-work", 2),
    lesson("aux", "how-markets-work", 3),
    lesson("not-written", "how-markets-work", 4, true),
  ];
  const chapter: Chapter = {
    id: "how-markets-work",
    title: "How markets work",
    summary: "",
    courseId: "foundations",
    number: 1,
    lessons,
    checkpoint: null,
  };
  const course: Course = {
    id: "foundations",
    title: "Foundations",
    summary: "",
    level: 1,
    platform: null,
    comingSoon: false,
    chapters: [chapter],
  };
  return {
    courses: [course],
    chapters: new Map([[chapter.id, chapter]]),
    lessons: new Map(lessons.map((entry) => [entry.id, entry])),
  };
}

const member = (number: number, overrides: Partial<BrainMember> = {}): BrainMember => ({
  memberNumber: number,
  userId: `00000000-0000-4000-8000-00000000000${number}`,
  username: `member_${number}`,
  displayName: null,
  joinedOn: "2026-09-21",
  discordUsername: null,
  email: `member${number}@example.com`,
  pictureVersion: null,
  ...overrides,
});

const HOSTILE_NAME = '<img src="https://evil.example/t.png"> [[Leaderboard]] #owned `x`';

function data(): BrainData {
  return {
    members: [
      member(2, { username: "con", displayName: HOSTILE_NAME, discordUsername: "trader.one" }),
      member(1, { username: "first_one" }),
      member(3, { username: null }),
      member(4, { username: "fourth", displayName: "x\n---\ninjected: true" }),
    ],
    completions: [
      // member 2: three lessons, one of them before the 30-day window.
      { userId: member(2).userId, lessonId: "orders-and-fills", completedOn: "2026-09-29" },
      { userId: member(2).userId, lessonId: "what-a-market-is", completedOn: "2026-08-31" },
      { userId: member(2).userId, lessonId: "removed-lesson", completedOn: "2026-09-01" },
      // member 1: two lessons in the window.
      { userId: member(1).userId, lessonId: "what-a-market-is", completedOn: "2026-09-10" },
      { userId: member(1).userId, lessonId: "aux", completedOn: "2026-09-12" },
      // member 4: two lessons in the window, a tie with member 1 and member 2.
      { userId: member(4).userId, lessonId: "orders-and-fills", completedOn: "2026-09-30" },
      { userId: member(4).userId, lessonId: "aux", completedOn: "2026-09-02" },
    ],
    steps: [
      { userId: member(1).userId, step: "bronze", achievedOn: "2026-09-12" },
      { userId: member(1).userId, step: "level-1", achievedOn: "2026-09-12" },
    ],
  };
}

const build = () => buildBrain({ data: data(), catalog: catalog(), now: NOW, academy: true });
const file = (path: string) => {
  const content = build().files.get(path);
  if (content === undefined) throw new Error(`no note at ${path}`);
  return content;
};
/** The text after the frontmatter. */
const body = (content: string) => content.split("\n---\n").slice(1).join("\n---\n");

describe("buildBrain", () => {
  it("writes one note per member, lesson, chapter, course and rank, a hub and a leaderboard", () => {
    expect([...build().files.keys()].sort()).toEqual([
      "ZeroCorps/Chapters/how-markets-work.md",
      "ZeroCorps/Courses/foundations.md",
      "ZeroCorps/Leaderboard.md",
      "ZeroCorps/Lessons/aux-.md",
      "ZeroCorps/Lessons/not-written.md",
      "ZeroCorps/Lessons/orders-and-fills.md",
      "ZeroCorps/Lessons/removed-lesson.md",
      "ZeroCorps/Lessons/what-a-market-is.md",
      "ZeroCorps/Members/con-.md",
      "ZeroCorps/Members/first_one.md",
      "ZeroCorps/Members/fourth.md",
      "ZeroCorps/Members/member-3.md",
      "ZeroCorps/Ranks/bronze.md",
      "ZeroCorps/Ranks/no-rank.md",
      "ZeroCorps/ZeroCorps Brain.md",
    ]);
    for (const content of build().files.values()) {
      expect(content.startsWith(`---\ngenerated_by: "${GENERATED_BY}"\n`)).toBe(true);
      expect(content.endsWith("\n")).toBe(true);
    }
  });

  it("is the same text every time for the same database and clock", () => {
    expect([...build().files]).toEqual([...build().files]);
  });

  it("gives a member's note the allowlisted fields, the pace and the rank tag", () => {
    const note = file("ZeroCorps/Members/first_one.md");
    expect(note).toContain(
      [
        "type: member",
        "member_number: 1",
        'username: "first_one"',
        "signed_up: 2026-09-21",
        "discord_linked: false",
        'rank: "bronze"',
        "last_active_on: 2026-09-12",
        "lessons_completed: 2",
        "pace_30d: 2",
        "tags:",
        "  - zc/member",
        "  - zc/rank/bronze",
      ].join("\n"),
    );
    expect(note).toContain("- Member: **#1**\n");
    expect(note).toContain("- Signed up: 2026-09-21\n");
    expect(note).toContain("- Rank: [[ZeroCorps/Ranks/bronze|Bronze]]\n");
    expect(note).toContain("- Levels finished: Fundamentals (2026-09-12)");
    // Oldest first, each a link to the lesson's note by full path.
    expect(note).toContain(
      "- 2026-09-10 · [[ZeroCorps/Lessons/what-a-market-is|what a market is]]\n" +
        "- 2026-09-12 · [[ZeroCorps/Lessons/aux-|aux]]",
    );
    expect(note).toContain("- Email: `member1@example.com`");
    // The address is in the body only: a property could turn typed text into a link.
    expect(note.split("\n---\n")[0]).not.toMatch(/@example/);
    expect(note).not.toMatch(/password|session|ip_/i);
  });

  it("counts only the last 30 days, today included, as the pace", () => {
    // 2026-08-31 is outside the window that starts on 2026-09-01.
    expect(file("ZeroCorps/Members/con-.md")).toContain("pace_30d: 2");
    expect(file("ZeroCorps/Members/con-.md")).toContain("lessons_completed: 3");
  });

  it("never lets a display name or a Discord name become HTML, a link, a tag or a property", () => {
    const note = file("ZeroCorps/Members/con-.md");
    // Never in the frontmatter: Obsidian reads a quoted [[...]] property as a real link.
    const front = note.split("\n---\n")[0] ?? "";
    expect(front).not.toMatch(/display_name|discord_username|Leaderboard|trader\.one|evil/);
    expect(front).toContain("discord_linked: true");
    // In the body: only inside a code span.
    expect(body(note)).toContain(
      '- Display name: `` <img src="https://evil.example/t.png"> [[Leaderboard]] #owned `x` ``',
    );
    expect(body(note)).toContain("- Discord: `trader.one`");
    const outsideCode = body(note).replace(/(`+)[\s\S]*?\1/g, "");
    expect(outsideCode).not.toMatch(/<img|\[\[Leaderboard|#owned|evil\.example/);

    // A line break cannot end the frontmatter early.
    const fourth = file("ZeroCorps/Members/fourth.md");
    expect(fourth.split("\n").filter((entry) => entry === "---")).toHaveLength(2);
    expect(fourth).not.toMatch(/^injected: true$/m);
  });

  it("names a member without a username by number, and a name Windows reserves safely", () => {
    const third = file("ZeroCorps/Members/member-3.md");
    expect(third).toContain("username:\n");
    expect(third).toContain("# Member #3 (no username yet)");
    expect(file("ZeroCorps/ZeroCorps Brain.md")).toContain(
      "| 2 | [[ZeroCorps/Members/con-\\|con]] | 2026-09-21 |",
    );
  });

  it("keeps a lesson the Academy's files no longer have, and marks drafts", () => {
    const removed = file("ZeroCorps/Lessons/removed-lesson.md");
    expect(removed).toContain("in_academy: false");
    expect(removed).toContain("# removed-lesson (no longer in the Academy)");
    expect(removed).toContain("Completed by **1 member**");
    expect(file("ZeroCorps/Lessons/not-written.md")).toContain("draft: true");
    expect(file("ZeroCorps/Lessons/orders-and-fills.md")).toContain(
      "Lesson 2 of [[ZeroCorps/Chapters/how-markets-work|Chapter 01 · How markets work]].",
    );
    expect(file("ZeroCorps/Lessons/orders-and-fills.md")).toContain("completed_by: 2");
  });

  it("ranks pace on the leaderboard, ties sharing a place, and counts the idle", () => {
    const board = file("ZeroCorps/Leaderboard.md");
    const rows = board.split("\n").filter((line) => /^\| \d/.test(line));
    // All three tie on 2 lessons; the all-time total, then the member number, order them.
    expect(rows).toEqual([
      "| 1 | [[ZeroCorps/Members/con-\\|con]] | 2 | 3 | No rank yet | 2026-09-29 |",
      "| 1 | [[ZeroCorps/Members/first_one\\|first_one]] | 2 | 2 | Bronze | 2026-09-12 |",
      "| 1 | [[ZeroCorps/Members/fourth\\|fourth]] | 2 | 2 | No rank yet | 2026-09-30 |",
    ]);
    expect(board).toContain("window_start: 2026-09-01\nwindow_end: 2026-09-30");
    expect(board).toContain("Not on the board: 1 member with no lesson in the last 30 days.");
  });

  it("gives every rank a note and a colour, Bronze first, in bronze", () => {
    expect(file("ZeroCorps/Ranks/bronze.md")).toContain("members: 1");
    expect(file("ZeroCorps/Ranks/no-rank.md")).toContain("members: 3");
    const { colorGroups } = build();
    expect(colorGroups[0]).toEqual({
      query: "tag:#zc/rank/bronze",
      color: { a: 1, rgb: 0xcd7f32 },
    });
    expect(colorGroups.map((group) => group.query)).toEqual([
      "tag:#zc/rank/bronze",
      "tag:#zc/rank/none",
      "tag:#zc/lesson",
      "tag:#zc/chapter",
      "tag:#zc/course",
      "tag:#zc/hub",
    ]);
  });

  it("sums up the community on the hub", () => {
    const hub = file("ZeroCorps/ZeroCorps Brain.md");
    expect(hub).toContain("- Members: **4**, of whom **1** linked Discord");
    expect(hub).toContain("- Lessons completed: **7** in all, **6** in the last 30 days");
    expect(hub).toContain("on 2026-09-30 at 12:34 UTC");
    expect(hub).toContain(
      "- [[ZeroCorps/Courses/foundations|Level 1 · Foundations]]: 1 chapter, 4 lessons",
    );
  });

  it("still makes a whole vault from an empty database", () => {
    const empty = buildBrain({
      data: { members: [], completions: [], steps: [] },
      catalog: catalog(),
      now: NOW,
      academy: true,
    });
    expect(empty.files.get("ZeroCorps/ZeroCorps Brain.md")).toContain("No accounts yet.");
    expect(empty.files.get("ZeroCorps/Leaderboard.md")).toContain(
      "Nobody completed a lesson in the last 30 days.",
    );
    expect(empty.files.has("ZeroCorps/Ranks/bronze.md")).toBe(true);
  });
});

describe("buildBrain, the members' list (the default)", () => {
  const PICTURE = "AbCdEfGhIjKlMnOpQrSt_-";
  const withPictures = (): BrainData => {
    const base = data();
    return {
      ...base,
      members: base.members.map((entry) =>
        // Two members share one picture: it is one file.
        entry.memberNumber === 1 || entry.memberNumber === 4
          ? { ...entry, pictureVersion: PICTURE }
          : entry,
      ),
    };
  };
  // No Academy files given: the members' list does not need them.
  const brain = buildBrain({ data: withPictures(), now: NOW });

  it("writes one note per member and nothing else", () => {
    expect([...brain.files.keys()].sort()).toEqual([
      "ZeroCorps/Members/con-.md",
      "ZeroCorps/Members/first_one.md",
      "ZeroCorps/Members/fourth.md",
      "ZeroCorps/Members/member-3.md",
    ]);
    expect(brain.counts).toEqual({ members: 4, pictures: 2, lessonNotes: 0, completions: 7 });
  });

  it("holds the member's details and nothing about the Academy", () => {
    const note = brain.files.get("ZeroCorps/Members/first_one.md") ?? "";
    expect(note).toBe(
      [
        "---",
        `generated_by: "${GENERATED_BY}"`,
        "type: member",
        "member_number: 1",
        'username: "first_one"',
        "signed_up: 2026-09-21",
        "discord_linked: false",
        "tags:",
        "  - zc/member",
        "---",
        "# first_one",
        "",
        `![[ZeroCorps/Pictures/${PICTURE}.webp|160]]`,
        "",
        "- Member: **#1**",
        "- Email: `member1@example.com`",
        "- Display name: none",
        "- Signed up: 2026-09-21",
        "- Discord: not linked",
        "",
      ].join("\n"),
    );
    for (const content of brain.files.values()) {
      // Outside the code spans that hold typed names: no Academy word, and no link but the
      // picture's embed.
      const ours = content.replace(/(`+)[\s\S]*?\1/g, "");
      expect(ours).not.toMatch(/\brank|lesson|\bpace|last_active|Academy|(?<!!)\[\[/i);
    }
  });

  it("says so when a member has no picture, and asks for each picture once", () => {
    expect(brain.files.get("ZeroCorps/Members/con-.md")).toContain("\nNo profile picture.\n");
    expect([...brain.pictures]).toEqual([[PICTURE, member(1).userId]]);
  });

  it("says nothing about a picture while the database cannot tell yet", () => {
    const before = buildBrain({ data: data(), now: NOW, pictures: false });
    const note = before.files.get("ZeroCorps/Members/first_one.md") ?? "";
    expect(note).toContain("# first_one\n\n- Member: **#1**\n");
    expect(note).not.toMatch(/picture/i);
    expect(before.counts.pictures).toBe(0);
  });

  it("still never lets a display name or a Discord name become HTML, a link or a property", () => {
    const note = brain.files.get("ZeroCorps/Members/con-.md") ?? "";
    const front = note.split("\n---\n")[0] ?? "";
    expect(front).not.toMatch(/display_name|discord_username|Leaderboard|trader\.one|evil/);
    const outsideCode = body(note).replace(/(`+)[\s\S]*?\1/g, "");
    expect(outsideCode).not.toMatch(/<img|\[\[Leaderboard|#owned|evil\.example/);
  });

  it("colours the members in the graph, and refuses a picture name it could not trust", () => {
    expect(brain.colorGroups).toEqual([
      { query: "tag:#zc/member", color: { a: 1, rgb: 0xff3b47 } },
    ]);
    const bad = data();
    bad.members[0] = { ...member(2), pictureVersion: "../../escape.webp|x]]" };
    expect(() => buildBrain({ data: bad, now: NOW })).toThrow(/picture's name/);
  });

  it("needs the Academy's files for the Academy's brain only", () => {
    expect(() => buildBrain({ data: data(), now: NOW, academy: true })).toThrow(/Academy's files/);
  });
});
