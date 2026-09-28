import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ContentError, isOpen, loadCatalog, parseCheckpoint, splitLesson } from "./content.ts";

/**
 * The Academy's content, read the way the site reads it. First the real folder, which is
 * what stops a broken lesson from reaching a release. Then small made-up folders, one
 * mistake each, to prove every mistake is caught and named.
 */

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/** Writes a made-up Academy folder: { "path/in/folder": "file text" }. */
function academy(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "zc-academy-"));
  folders.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const COURSE =
  "---\nid: foundations\ntitle: Foundations\nsummary: Where everyone starts.\nlevel: 1\n---\n";
const CHAPTER = "---\nid: how-markets-work\ntitle: How markets work\nsummary: The basics.\n---\n";
const lesson = (id: string, extra = "") =>
  `---\nid: ${id}\ntitle: A lesson\nsummary: One sentence.\nminutes: 5\n${extra}---\n\n## Heading\n\nText.\n`;

/** A folder with one course, one chapter and the given lesson files. */
function oneChapter(lessons: Record<string, string>, more: Record<string, string> = {}) {
  const files: Record<string, string> = {
    "01-foundations/_course.md": COURSE,
    "01-foundations/01-how-markets-work/_module.md": CHAPTER,
    ...more,
  };
  for (const [name, text] of Object.entries(lessons)) {
    files[`01-foundations/01-how-markets-work/${name}`] = text;
  }
  return academy(files);
}

function problemsOf(root: string): string[] {
  try {
    loadCatalog(root);
  } catch (error) {
    if (error instanceof ContentError) return error.problems;
    throw error;
  }
  return [];
}

describe("the real content folder", () => {
  const catalog = loadCatalog("content/academy");

  it("reads cleanly: the owner's structure, with every lesson id unique", () => {
    expect(catalog.courses.map((course) => [course.id, course.level, course.comingSoon])).toEqual([
      ["foundations", 1, false],
      ["backtesting-school", 2, false],
      ["sierra-chart", 2, true],
    ]);
    expect(catalog.chapters.size).toBe(13);
    expect(catalog.lessons.size).toBe(42);
  });

  it("numbers chapters across the whole Academy, in folder order", () => {
    const numbers = [...catalog.chapters.values()].map((chapter) => chapter.number);
    expect(numbers).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
    expect(catalog.chapters.get("how-markets-work")?.number).toBe(1);
    expect(catalog.lessons.get("orders-and-fills")?.number).toBe(2);
  });

  it("leaves _meta and _templates out: the template is not a lesson", () => {
    expect([...catalog.lessons.values()].some((l) => l.file.startsWith("_"))).toBe(false);
  });
});

describe("what a lesson may be", () => {
  it("a well-formed lesson is read, with its number in the chapter", () => {
    const root = oneChapter({ "01-first.md": lesson("first"), "02-second.md": lesson("second") });
    const catalog = loadCatalog(root);
    expect(catalog.lessons.get("second")).toMatchObject({
      title: "A lesson",
      minutes: 5,
      draft: false,
      chapterId: "how-markets-work",
      courseId: "foundations",
      number: 2,
    });
  });

  it("draft: true is a draft, and a draft cannot be opened", () => {
    const catalog = loadCatalog(oneChapter({ "01-first.md": lesson("first", "draft: true\n") }));
    const first = catalog.lessons.get("first")!;
    expect(first.draft).toBe(true);
    expect(isOpen(catalog, first)).toBe(false);
  });

  it("nothing in a course that is coming soon can be opened, even a written lesson", () => {
    const root = oneChapter(
      { "01-first.md": lesson("first") },
      { "01-foundations/_course.md": COURSE.replace("level: 1", "level: 1\nstatus: coming-soon") },
    );
    const catalog = loadCatalog(root);
    expect(isOpen(catalog, catalog.lessons.get("first")!)).toBe(false);
  });

  it("header values may be quoted, as Obsidian sometimes writes them", () => {
    const text = lesson("first").replace("title: A lesson", 'title: "Orders: and fills"');
    expect(loadCatalog(oneChapter({ "01-first.md": text })).lessons.get("first")?.title).toBe(
      "Orders: and fills",
    );
  });

  it("Windows line endings and a byte-order mark are fine", () => {
    const text = "\ufeff" + lesson("first").replace(/\n/g, "\r\n");
    expect(loadCatalog(oneChapter({ "01-first.md": text })).lessons.has("first")).toBe(true);
  });
});

describe("every mistake is caught, and named", () => {
  it("two lessons with one id, even in different chapters", () => {
    const root = oneChapter(
      { "01-a.md": lesson("same") },
      {
        "01-foundations/02-other/_module.md": CHAPTER.replace("how-markets-work", "other"),
        "01-foundations/02-other/01-b.md": lesson("same"),
      },
    );
    const problems = problemsOf(root);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(
      /the id "same" is also used by 01-foundations\/01-how-markets-work\/01-a\.md/,
    );
  });

  it("a missing or badly shaped id, and one the site's addresses use", () => {
    const problems = problemsOf(
      oneChapter({
        "01-a.md": lesson("").replace("id: \n", ""),
        "02-b.md": lesson("Has_Capitals"),
        "03-c.md": lesson("double--hyphen"),
        "04-d.md": lesson("checkpoint"),
      }),
    );
    expect(problems.join("\n")).toMatch(/01-a\.md: "id" is missing/);
    expect(problems.join("\n")).toMatch(/02-b\.md: the id "Has_Capitals"/);
    expect(problems.join("\n")).toMatch(/03-c\.md: the id "double--hyphen"/);
    expect(problems.join("\n")).toMatch(
      /04-d\.md: the id "checkpoint" is a word the site's addresses use/,
    );
  });

  it("a header line the site does not know, a repeated one, or one that is not name: value", () => {
    const problems = problemsOf(
      oneChapter({
        "01-a.md": lesson("a", "tags: trading\n"),
        "02-b.md": lesson("b", "minutes: 7\n"),
        "03-c.md": lesson("c", "just some words\n"),
      }),
    );
    expect(problems.join("\n")).toMatch(/01-a\.md: "tags" is not something this site reads/);
    expect(problems.join("\n")).toMatch(/02-b\.md: "minutes" appears twice/);
    expect(problems.join("\n")).toMatch(/03-c\.md: header line \d+ is not "name: value"/);
  });

  it("no header at all, a missing summary, and minutes that are not a number", () => {
    const problems = problemsOf(
      oneChapter({
        "01-a.md": "## Just text\n",
        "02-b.md": lesson("b").replace("summary: One sentence.\n", ""),
        "03-c.md": lesson("c").replace("minutes: 5", "minutes: soon"),
        "04-d.md": lesson("d", "draft: maybe\n"),
      }),
    );
    expect(problems.join("\n")).toMatch(/01-a\.md: the file must start with a header/);
    expect(problems.join("\n")).toMatch(/02-b\.md: "summary" is missing/);
    expect(problems.join("\n")).toMatch(/03-c\.md: "minutes" must be a whole number/);
    expect(problems.join("\n")).toMatch(/04-d\.md: "draft" can only be true or false/);
  });

  it("a folder or file without its number, and a chapter or course without its file", () => {
    const problems = problemsOf(
      academy({
        "01-foundations/_course.md": COURSE,
        "01-foundations/01-how-markets-work/_module.md": CHAPTER,
        "01-foundations/01-how-markets-work/orders.md": lesson("orders"),
        "01-foundations/02-no-file/01-a.md": lesson("a"),
        "02-no-course-file/01-x/_module.md": CHAPTER.replace("how-markets-work", "x"),
        "foundations/_course.md": COURSE,
      }),
    );
    expect(problems.join("\n")).toMatch(/orders\.md: a lesson's file name starts with its number/);
    expect(problems.join("\n")).toMatch(/02-no-file\/_module\.md: missing/);
    expect(problems.join("\n")).toMatch(/02-no-course-file\/_course\.md: missing/);
    expect(problems.join("\n")).toMatch(
      /foundations\/: a course folder's name starts with its number/,
    );
  });

  it("every problem is reported at once, so they can all be fixed in one go", () => {
    const problems = problemsOf(
      oneChapter({ "01-a.md": lesson("Bad"), "02-b.md": lesson("b", "colour: red\n") }),
    );
    expect(problems.length).toBeGreaterThanOrEqual(2);
  });

  it("files and folders starting with _ or . are not content", () => {
    const root = oneChapter(
      { "01-a.md": lesson("a"), "_scratch.md": "anything at all" },
      {
        "_meta/curriculum-map.md": "# not a course",
        "_templates/lesson.md": "---\nid: # comment\n---\n",
        ".obsidian/workspace.json": "{}",
      },
    );
    expect(problemsOf(root)).toEqual([]);
    expect(loadCatalog(root).lessons.size).toBe(1);
  });
});

describe("quick checks inside a lesson", () => {
  it("are cut out of the Markdown, with their answer and explanation", () => {
    const problems: string[] = [];
    const parts = splitLesson(
      [
        "Before.",
        "",
        "> [!check] You risk $50 and make $150. What is the result in R?",
        "> - [ ] +1R",
        "> - [x] +3R",
        "> - [ ] +150R",
        "> It made three times what it risked.",
        "",
        "After.",
      ].join("\n"),
      "lesson.md",
      problems,
    );
    expect(problems).toEqual([]);
    expect(parts.map((part) => part.kind)).toEqual(["markdown", "check", "markdown"]);
    expect(parts[1]).toMatchObject({
      question: "You risk $50 and make $150. What is the result in R?",
      options: ["+1R", "+3R", "+150R"],
      correct: 1,
      explanation: "It made three times what it risked.",
    });
  });

  it("a check with no answer ticked, two ticked, or too few options is a problem", () => {
    const problems: string[] = [];
    splitLesson("> [!check] Q?\n> - [ ] a\n> - [ ] b", "a.md", problems);
    splitLesson("> [!check] Q?\n> - [x] a\n> - [x] b", "b.md", problems);
    splitLesson("> [!check] Q?\n> - [x] a", "c.md", problems);
    expect(problems.join("\n")).toMatch(/a\.md.*tick the right answer/);
    expect(problems.join("\n")).toMatch(/b\.md.*more than one answer is ticked/);
    expect(problems.join("\n")).toMatch(/c\.md.*2 to 6 options/);
  });

  it("other callouts are left for the Markdown renderer", () => {
    const parts = splitLesson("> [!note] Just a note\n> Body", "a.md", []);
    expect(parts).toEqual([{ kind: "markdown", source: "> [!note] Just a note\n> Body" }]);
  });
});

describe("a chapter's checkpoint", () => {
  const TEST = [
    "---",
    "pass: 2",
    "---",
    "",
    "## What does maximum drawdown measure?",
    "",
    "- [ ] The biggest single losing trade.",
    "- [x] The largest fall from a peak, before a new high.",
    "- [ ] The average loss per day.",
    "",
    "Reread: first",
    "",
    "## Expectancy with a 40% win rate, +2.5R wins and -1R losses?",
    "",
    "- [x] +0.4R",
    "- [ ] -0.2R",
  ].join("\n");

  it("is read from _checkpoint.md: questions, answers, pass mark and what to reread", () => {
    const root = oneChapter(
      { "01-first.md": lesson("first") },
      { "01-foundations/01-how-markets-work/_checkpoint.md": TEST },
    );
    const checkpoint = loadCatalog(root).chapters.get("how-markets-work")?.checkpoint;
    expect(checkpoint?.pass).toBe(2);
    expect(checkpoint?.questions).toEqual([
      {
        question: "What does maximum drawdown measure?",
        options: [
          "The biggest single losing trade.",
          "The largest fall from a peak, before a new high.",
          "The average loss per day.",
        ],
        correct: 1,
        reread: "first",
      },
      {
        question: "Expectancy with a 40% win rate, +2.5R wins and -1R losses?",
        options: ["+0.4R", "-0.2R"],
        correct: 0,
        reread: null,
      },
    ]);
  });

  it("without a pass mark, 80% rounded up must be right", () => {
    const checkpoint = parseCheckpoint(TEST.replace("pass: 2\n", ""), "t.md", []);
    expect(checkpoint?.pass).toBe(2);
  });

  it("a pass mark out of range, no questions, or a reread that is not a lesson is a problem", () => {
    const problems: string[] = [];
    parseCheckpoint(TEST.replace("pass: 2", "pass: 3"), "t.md", problems);
    parseCheckpoint("---\n---\nNo questions here.", "u.md", problems);
    expect(problems.join("\n")).toMatch(/t\.md: "pass" must be a whole number from 1 to 2/);
    expect(problems.join("\n")).toMatch(/u\.md: a checkpoint needs at least one/);

    const root = oneChapter(
      { "01-first.md": lesson("first") },
      {
        "01-foundations/01-how-markets-work/_checkpoint.md": TEST.replace(
          "Reread: first",
          "Reread: nowhere",
        ),
      },
    );
    expect(problemsOf(root).join("\n")).toMatch(/"Reread: nowhere" is not a lesson id/);
  });
});
