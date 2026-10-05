import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reads the Academy's lessons from `content/academy/`: the owner writes them in Obsidian,
 * and this is the one place that turns the folder into something the site can show.
 *
 * It is strict on purpose. A header it does not understand, a missing field or two
 * lessons with one `id` is an ERROR that names the file, never a page that silently
 * shows something else: members' progress is saved against those ids, so a quiet
 * mistake here would become lost progress later. `npm run academy:check` and the tests
 * run it over the real folder, so a broken lesson stops a release, not a member.
 *
 * The shape (content/academy/README.md has the owner's version):
 *
 *   <NN-course>/_course.md            a course, in a level
 *   <NN-course>/<NN-chapter>/_module.md   a chapter
 *   <NN-course>/<NN-chapter>/<NN-lesson>.md  a lesson
 *   <NN-course>/<NN-chapter>/_checkpoint.md  the chapter's test, if it has one
 *
 * Anything else whose name starts with `_` or `.` is not content (`_meta`, `_templates`,
 * Obsidian's `.obsidian`). Numbers at the front set the order and nothing else.
 *
 * This module imports nothing but Node, so the owner's command-line tools load it directly.
 */

export type QuickCheck = {
  question: string;
  options: string[];
  /** Index into `options`. The answer is in the page on purpose: a quick check is not graded. */
  correct: number;
  explanation: string;
};

export type LessonPart = { kind: "markdown"; source: string } | ({ kind: "check" } & QuickCheck);

export type Lesson = {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  /** Not written yet: listed as coming soon, and nobody can open it. */
  draft: boolean;
  chapterId: string;
  courseId: string;
  /** 1-based position in its chapter. */
  number: number;
  /** The lesson's text, cut into Markdown and quick checks, in order. */
  parts: LessonPart[];
  /** Relative to the Academy folder, with forward slashes. For error messages only. */
  file: string;
};

export type CheckpointQuestion = {
  question: string;
  options: string[];
  correct: number;
  /** A lesson id to point a member back to when they miss this one. */
  reread: string | null;
};

export type Checkpoint = {
  questions: CheckpointQuestion[];
  /** How many must be right to pass. */
  pass: number;
};

export type Chapter = {
  id: string;
  title: string;
  summary: string;
  courseId: string;
  /** 1-based position across the whole Academy, for "Chapter 08". */
  number: number;
  lessons: Lesson[];
  checkpoint: Checkpoint | null;
};

export type Course = {
  id: string;
  title: string;
  summary: string;
  level: number;
  platform: string | null;
  /** Shown as coming soon as a whole: nothing in it can be opened or completed. */
  comingSoon: boolean;
  chapters: Chapter[];
};

export type Catalog = {
  courses: Course[];
  chapters: ReadonlyMap<string, Chapter>;
  lessons: ReadonlyMap<string, Lesson>;
};

export class ContentError extends Error {
  // A plain property, not a constructor parameter property: Node's type stripping, which
  // the owner's command-line tools rely on, does not support those.
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`The Academy's content has ${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
    this.name = "ContentError";
    this.problems = problems;
  }
}

/** Lesson and chapter ids: lower-case letters, numbers and single hyphens. */
export const ID_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID_MAX = 80;
/** Words the site's own addresses use, so no chapter or lesson can hide a page. */
const RESERVED_IDS = new Set(["checkpoint", "ranks"]);
const ORDERED = /^(\d+)-(.+)$/;

type Header = Record<string, string>;

/**
 * The `---` block at the top of a file. Deliberately small: one `key: value` per line,
 * optional quotes around the value, blank lines allowed. Anything else is refused rather
 * than guessed at, and so is a key this site does not know.
 */
export function parseHeader(
  text: string,
  file: string,
  allowed: readonly string[],
  problems: string[],
): { header: Header; body: string } | null {
  const normalised = text.replace(/\r\n?/g, "\n").replace(/^\ufeff/, "");
  const match = /^---\n(?:([\s\S]*?)\n)?---(?:\n|$)/.exec(normalised);
  if (!match) {
    problems.push(`${file}: the file must start with a header between two "---" lines`);
    return null;
  }
  const header: Header = {};
  let ok = true;
  for (const [index, line] of (match[1] ?? "").split("\n").entries()) {
    if (line.trim() === "") continue;
    const pair = /^([a-z_]+):[ \t]*(.*)$/.exec(line);
    if (!pair) {
      problems.push(`${file}: header line ${index + 1} is not "name: value" (${line.trim()})`);
      ok = false;
      continue;
    }
    const [, key, raw] = pair as unknown as [string, string, string];
    if (!allowed.includes(key)) {
      problems.push(
        `${file}: "${key}" is not something this site reads (it knows ${allowed.join(", ")})`,
      );
      ok = false;
      continue;
    }
    if (key in header) {
      problems.push(`${file}: "${key}" appears twice`);
      ok = false;
      continue;
    }
    let value = raw.trim();
    const quoted = /^(["'])(.*)\1$/.exec(value);
    if (quoted) value = quoted[2]!;
    header[key] = value;
  }
  return ok ? { header, body: normalised.slice(match[0].length) } : null;
}

function requireText(header: Header, key: string, file: string, problems: string[], max = 300) {
  const value = header[key] ?? "";
  if (!value) problems.push(`${file}: "${key}" is missing`);
  else if (value.length > max) problems.push(`${file}: "${key}" is longer than ${max} characters`);
  return value;
}

function requireId(header: Header, file: string, problems: string[]) {
  const value = header.id ?? "";
  if (!value) problems.push(`${file}: "id" is missing`);
  else if (value.length > ID_MAX || !ID_SHAPE.test(value)) {
    problems.push(
      `${file}: the id "${value}" must be lower-case letters, numbers and single hyphens`,
    );
  } else if (RESERVED_IDS.has(value)) {
    problems.push(`${file}: the id "${value}" is a word the site's addresses use`);
  }
  return value;
}

/** The option lines of a question: `- [ ] wrong` and exactly one `- [x] right`. */
function parseOptions(lines: string[], where: string, problems: string[]) {
  const options: string[] = [];
  let correct = -1;
  for (const line of lines) {
    const option = /^[-*] \[( |x|X)\] (.+)$/.exec(line.trim());
    if (!option) continue;
    if (option[1] !== " ") {
      if (correct !== -1) problems.push(`${where}: more than one answer is ticked [x]`);
      correct = options.length;
    }
    options.push(option[2]!.trim());
  }
  if (options.length < 2 || options.length > 6) {
    problems.push(`${where}: a question needs 2 to 6 options written as "- [ ] ..."`);
  } else if (correct === -1) {
    problems.push(`${where}: tick the right answer as "- [x] ..."`);
  }
  return { options, correct };
}

/**
 * Cuts a lesson's text into Markdown and quick checks. A quick check is an Obsidian
 * callout of type `check`:
 *
 *   > [!check] You risk $50 and make $150. What is the result in R?
 *   > - [ ] +1R
 *   > - [x] +3R
 *   > It made three times what it risked.
 *
 * Lines after the options are the explanation, shown once the member has answered.
 */
export function splitLesson(body: string, file: string, problems: string[]): LessonPart[] {
  const parts: LessonPart[] = [];
  const lines = body.split("\n");
  let markdown: string[] = [];
  const flush = () => {
    if (markdown.join("").trim()) parts.push({ kind: "markdown", source: markdown.join("\n") });
    markdown = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const start = /^>\s*\[!check\][-+]?\s*(.*)$/i.exec(lines[i]!);
    if (!start) {
      markdown.push(lines[i]!);
      continue;
    }
    flush();
    const inside: string[] = [];
    while (i + 1 < lines.length && /^>/.test(lines[i + 1]!)) {
      i++;
      inside.push(lines[i]!.replace(/^>\s?/, ""));
    }
    const where = `${file}: the quick check "${start[1]!.trim() || "(no question)"}"`;
    if (!start[1]!.trim()) problems.push(`${where} has no question after [!check]`);
    const { options, correct } = parseOptions(inside, where, problems);
    const explanation = inside
      .filter((line) => !/^[-*] \[( |x|X)\] /.test(line.trim()))
      .join("\n")
      .trim();
    parts.push({ kind: "check", question: start[1]!.trim(), options, correct, explanation });
  }
  flush();
  return parts;
}

/**
 * A chapter's test. Each `## heading` is a question; its options are "- [ ] ..." lines
 * with the right one ticked "- [x] ..."; an optional "Reread: <lesson id>" line says
 * which lesson to send a member back to when they miss it.
 *
 * The answers are in this file, and this repository is public, so anyone can read them
 * on GitHub. The owner accepted that for the first levels (DECISIONS.md). The site still
 * never sends the answers to the browser.
 */
export function parseCheckpoint(text: string, file: string, problems: string[]): Checkpoint | null {
  // The header is optional here: it only ever holds the pass mark.
  const parsed = /^\ufeff?---\r?\n/.test(text)
    ? parseHeader(text, file, ["pass"], problems)
    : { header: {} as Header, body: text.replace(/\r\n?/g, "\n") };
  if (!parsed) return null;
  const questions: CheckpointQuestion[] = [];
  const blocks = parsed.body.split(/^## +/m).slice(1);
  for (const [index, block] of blocks.entries()) {
    const [first = "", ...rest] = block.split("\n");
    const where = `${file}: question ${index + 1}`;
    const question = first.trim();
    if (!question) problems.push(`${where} has no text after "##"`);
    const { options, correct } = parseOptions(rest, where, problems);
    const reread = /^reread:\s*(\S+)\s*$/im.exec(rest.join("\n"))?.[1] ?? null;
    questions.push({ question, options, correct, reread });
  }
  if (questions.length === 0) {
    problems.push(`${file}: a checkpoint needs at least one "## question"`);
    return null;
  }
  let pass = Math.ceil(questions.length * 0.8);
  if (parsed.header.pass !== undefined) {
    pass = Number(parsed.header.pass);
    if (!Number.isInteger(pass) || pass < 1 || pass > questions.length) {
      problems.push(`${file}: "pass" must be a whole number from 1 to ${questions.length}`);
    }
  }
  return { questions, pass };
}

function entries(directory: string) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/**
 * Reads and checks the whole Academy. Throws a `ContentError` listing EVERY problem found,
 * so the owner can fix them in one pass rather than one per attempt.
 */
export function loadCatalog(root: string): Catalog {
  const problems: string[] = [];
  const courses: Course[] = [];
  const chapters = new Map<string, Chapter>();
  const lessons = new Map<string, Lesson>();
  const courseIds = new Set<string>();
  const read = (relative: string) => readFileSync(join(root, relative), "utf8");
  let chapterNumber = 0;

  for (const courseEntry of entries(root)) {
    if (!courseEntry.isDirectory() || courseEntry.name.startsWith("_")) continue;
    const courseDir = courseEntry.name;
    if (!ORDERED.test(courseDir)) {
      problems.push(
        `${courseDir}/: a course folder's name starts with its number, like 01-foundations`,
      );
      continue;
    }
    const courseFile = `${courseDir}/_course.md`;
    let courseText: string;
    try {
      courseText = read(courseFile);
    } catch {
      problems.push(`${courseFile}: missing (every course folder needs one)`);
      continue;
    }
    const courseHead = parseHeader(
      courseText,
      courseFile,
      ["id", "title", "summary", "level", "platform", "status"],
      problems,
    );
    if (!courseHead) continue;
    const h = courseHead.header;
    const level = Number(h.level);
    if (!Number.isInteger(level) || level < 1 || level > 9) {
      problems.push(`${courseFile}: "level" must be a whole number from 1 to 9`);
    }
    if (h.status !== undefined && h.status !== "coming-soon") {
      problems.push(`${courseFile}: "status" can only be coming-soon`);
    }
    const course: Course = {
      id: requireId(h, courseFile, problems),
      title: requireText(h, "title", courseFile, problems, 120),
      summary: requireText(h, "summary", courseFile, problems),
      level,
      platform: h.platform || null,
      comingSoon: h.status === "coming-soon",
      chapters: [],
    };
    if (courseIds.has(course.id))
      problems.push(`${courseFile}: the id "${course.id}" is used twice`);
    courseIds.add(course.id);

    for (const chapterEntry of entries(join(root, courseDir))) {
      if (!chapterEntry.isDirectory() || chapterEntry.name.startsWith("_")) continue;
      const chapterDir = `${courseDir}/${chapterEntry.name}`;
      if (!ORDERED.test(chapterEntry.name)) {
        problems.push(
          `${chapterDir}/: a chapter folder's name starts with its number, like 01-how-markets-work`,
        );
        continue;
      }
      const chapterFile = `${chapterDir}/_module.md`;
      let chapterText: string;
      try {
        chapterText = read(chapterFile);
      } catch {
        problems.push(`${chapterFile}: missing (every chapter folder needs one)`);
        continue;
      }
      const chapterHead = parseHeader(
        chapterText,
        chapterFile,
        ["id", "title", "summary"],
        problems,
      );
      if (!chapterHead) continue;
      chapterNumber += 1;
      const chapter: Chapter = {
        id: requireId(chapterHead.header, chapterFile, problems),
        title: requireText(chapterHead.header, "title", chapterFile, problems, 120),
        summary: chapterHead.header.summary ?? "",
        courseId: course.id,
        number: chapterNumber,
        lessons: [],
        checkpoint: null,
      };
      if (chapters.has(chapter.id)) {
        problems.push(`${chapterFile}: the chapter id "${chapter.id}" is used twice`);
      }

      for (const fileEntry of entries(join(root, chapterDir))) {
        const name = fileEntry.name;
        if (fileEntry.isDirectory() || !name.endsWith(".md")) continue;
        const file = `${chapterDir}/${name}`;
        if (name === "_checkpoint.md") {
          chapter.checkpoint = parseCheckpoint(read(file), file, problems);
          continue;
        }
        if (name.startsWith("_")) continue;
        if (!ORDERED.test(name)) {
          problems.push(
            `${file}: a lesson's file name starts with its number, like 01-orders-and-fills.md`,
          );
          continue;
        }
        const parsed = parseHeader(
          read(file),
          file,
          ["id", "title", "summary", "minutes", "draft"],
          problems,
        );
        if (!parsed) continue;
        const lh = parsed.header;
        const minutes = Number(lh.minutes);
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
          problems.push(`${file}: "minutes" must be a whole number from 1 to 240`);
        }
        if (lh.draft !== undefined && lh.draft !== "true" && lh.draft !== "false") {
          problems.push(`${file}: "draft" can only be true or false`);
        }
        const summary = requireText(lh, "summary", file, problems);
        const lesson: Lesson = {
          id: requireId(lh, file, problems),
          title: requireText(lh, "title", file, problems, 120),
          summary,
          minutes,
          draft: lh.draft === "true",
          chapterId: chapter.id,
          courseId: course.id,
          number: chapter.lessons.length + 1,
          parts: splitLesson(parsed.body, file, problems),
          file,
        };
        const clash = lessons.get(lesson.id);
        if (clash) problems.push(`${file}: the id "${lesson.id}" is also used by ${clash.file}`);
        lessons.set(lesson.id, lesson);
        chapter.lessons.push(lesson);
      }

      chapters.set(chapter.id, chapter);
      course.chapters.push(chapter);
    }
    courses.push(course);
  }

  for (const chapter of chapters.values()) {
    for (const [index, question] of (chapter.checkpoint?.questions ?? []).entries()) {
      if (question.reread && !lessons.has(question.reread)) {
        problems.push(
          `the checkpoint of chapter "${chapter.id}", question ${index + 1}: "Reread: ${question.reread}" is not a lesson id`,
        );
      }
    }
  }

  if (problems.length > 0) throw new ContentError(problems);
  return { courses, chapters, lessons };
}

/** The lessons a member can open: written, and not in a course that is coming soon. */
export function isOpen(catalog: Catalog, lesson: Lesson): boolean {
  const course = catalog.courses.find((candidate) => candidate.id === lesson.courseId);
  return !lesson.draft && course !== undefined && !course.comingSoon;
}
