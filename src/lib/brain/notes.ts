import type { Catalog, Chapter, Course, Lesson } from "../academy/content.ts";
import { LEVEL_NAMES, RANK_TITLE, rankKeyOf, ROOKIE_KEY } from "../academy/standing.ts";
import { codeSpan, fileBase, plainTitle, wikilink, yamlOptional, yamlString } from "./markdown.ts";
import type { BrainData, BrainMember } from "./read.ts";

/**
 * The brain's notes (milestone 9), built from what `brain_reader` may read and from the
 * Academy's own lesson files. Pure: no database, no files, no clock (the time comes in),
 * so every note can be tested as text.
 *
 * One note per member, one per lesson, chapter, course and rank, a hub note and a
 * leaderboard. Members link to every lesson they completed, so members with more progress
 * gain more links in the graph; every other link points up the Academy's structure.
 *
 * This module imports nothing from the app beyond the Academy's own modules, so
 * `npm run brain:export` can load it.
 */

export const BRAIN_FOLDER = "ZeroCorps";
export const GENERATED_BY = "zerocorps brain:export";
/** The leaderboard's window, in UTC days, today included. */
export const PACE_DAYS = 30;

const HUB = `${BRAIN_FOLDER}/ZeroCorps Brain`;
const LEADERBOARD = `${BRAIN_FOLDER}/Leaderboard`;
/** The rank note of members without a rank. No rank key can be this: it is not an id. */
const NO_RANK = "no-rank";
const LEVEL_STEP = /^rookie-level-(\d+)$/;

const memberPath = (base: string) => `${BRAIN_FOLDER}/Members/${base}`;
const lessonPath = (id: string) => `${BRAIN_FOLDER}/Lessons/${fileBase(id)}`;
const chapterPath = (id: string) => `${BRAIN_FOLDER}/Chapters/${fileBase(id)}`;
const coursePath = (id: string) => `${BRAIN_FOLDER}/Courses/${fileBase(id)}`;
const rankPath = (key: string | null) => `${BRAIN_FOLDER}/Ranks/${fileBase(key ?? NO_RANK)}`;

export type ColorGroup = { query: string; color: { a: 1; rgb: number } };

export type BuiltBrain = {
  /** Vault-relative paths with forward slashes, each ending in .md, to their text. */
  files: Map<string, string>;
  /** Graph colour groups, keyed on the rank tags first. */
  colorGroups: ColorGroup[];
  counts: { members: number; lessonNotes: number; completions: number };
};

type MemberView = BrainMember & {
  /** The file's base name: the username, or member-<number> before one is chosen. */
  base: string;
  /** How the member is named in lists: the same, without the reserved-name hyphen. */
  label: string;
  rank: string | null;
  completions: { lessonId: string; completedOn: string }[];
  steps: { step: string; achievedOn: string }[];
  pace: number;
  lastActiveOn: string | null;
};

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const shiftDay = (day: string, days: number) =>
  isoDay(new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000));
const two = (value: number) => String(value).padStart(2, "0");

/** `rookie` is "Rookie"; a key added later reads as words until it gets a proper title. */
export function rankTitle(key: string | null): string {
  if (key === null) return "No rank yet";
  if (key === ROOKIE_KEY) return RANK_TITLE;
  const words = key.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const rankTag = (key: string | null) => `zc/rank/${key ?? "none"}`;
const chapterTitle = (chapter: Chapter) =>
  `Chapter ${two(chapter.number)} · ${plainTitle(chapter.title)}`;
const courseTitle = (course: Course) => `Level ${course.level} · ${plainTitle(course.title)}`;

/** A note's frontmatter: our marker first, then the fields, then the tags. */
function frontmatter(fields: [string, string][], tags: string[], aliases: string[] = []) {
  for (const tag of tags) {
    if (!/^zc\/[a-z0-9_/-]+$/.test(tag)) throw new Error("A tag held unexpected characters.");
  }
  return [
    "---",
    `generated_by: ${yamlString(GENERATED_BY)}`,
    ...fields.map(([key, value]) => `${key}:${value}`),
    ...(aliases.length > 0
      ? ["aliases:", ...aliases.map((alias) => `  - ${yamlString(alias)}`)]
      : []),
    "tags:",
    ...tags.map((tag) => `  - ${tag}`),
    "---",
  ];
}

const num = (value: number) => ` ${value}`;
const date = (value: string | null) => (value === null ? "" : ` ${value}`);
const bool = (value: boolean) => ` ${value}`;
const text = (value: string) => ` ${yamlString(value)}`;

const note = (lines: string[]) => `${lines.join("\n")}\n`;
/** Plain code-unit order, the same on every machine: a note's text must not depend on its locale. */
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

export function buildBrain(input: { data: BrainData; catalog: Catalog; now: Date }): BuiltBrain {
  const { data, catalog, now } = input;
  const today = isoDay(now);
  const windowStart = shiftDay(today, -(PACE_DAYS - 1));
  const files = new Map<string, string>();
  const put = (path: string, lines: string[]) => {
    const key = `${path}.md`;
    if (files.has(key)) throw new Error("Two notes would share one file name.");
    files.set(key, note(lines));
  };

  // ── Who did what ────────────────────────────────────────────────────────────
  const completionsBy = new Map<string, { lessonId: string; completedOn: string }[]>();
  for (const completion of data.completions) {
    const list = completionsBy.get(completion.userId) ?? [];
    list.push({ lessonId: completion.lessonId, completedOn: completion.completedOn });
    completionsBy.set(completion.userId, list);
  }
  const stepsBy = new Map<string, { step: string; achievedOn: string }[]>();
  for (const step of data.steps) {
    const list = stepsBy.get(step.userId) ?? [];
    list.push({ step: step.step, achievedOn: step.achievedOn });
    stepsBy.set(step.userId, list);
  }
  const members: MemberView[] = [...data.members]
    .sort((a, b) => a.memberNumber - b.memberNumber)
    .map((member) => {
      // Oldest first, so a member's note reads as a timeline.
      const completions = [...(completionsBy.get(member.userId) ?? [])].sort(
        (a, b) => compare(a.completedOn, b.completedOn) || compare(a.lessonId, b.lessonId),
      );
      const steps = [...(stepsBy.get(member.userId) ?? [])].sort(
        (a, b) => compare(a.achievedOn, b.achievedOn) || compare(a.step, b.step),
      );
      const label = member.username ?? `member-${member.memberNumber}`;
      const days = [
        ...completions.map((entry) => entry.completedOn),
        ...steps.map((entry) => entry.achievedOn),
      ].sort();
      return {
        ...member,
        base: fileBase(label),
        label,
        rank: rankKeyOf(new Set(steps.map((entry) => entry.step))),
        completions,
        steps,
        pace: completions.filter(
          (entry) => entry.completedOn >= windowStart && entry.completedOn <= today,
        ).length,
        lastActiveOn: days.at(-1) ?? null,
      };
    });

  const completedBy = new Map<string, number>();
  for (const member of members) {
    for (const lessonId of new Set(member.completions.map((entry) => entry.lessonId))) {
      completedBy.set(lessonId, (completedBy.get(lessonId) ?? 0) + 1);
    }
  }
  const lessonTitle = (id: string) => {
    const lesson = catalog.lessons.get(id);
    return lesson ? plainTitle(lesson.title) : `${id} (no longer in the Academy)`;
  };
  const rankKeys = [...new Set([ROOKIE_KEY, ...members.flatMap((m) => (m.rank ? [m.rank] : []))])];
  const memberLink = (member: MemberView, inTable = false) =>
    wikilink(memberPath(member.base), member.label, { inTable });

  // ── Members ─────────────────────────────────────────────────────────────────
  for (const member of members) {
    const levels = member.steps.flatMap((entry) => {
      const level = LEVEL_STEP.exec(entry.step)?.[1];
      return level === undefined
        ? []
        : [`${LEVEL_NAMES[Number(level)] ?? `Level ${level}`} (${entry.achievedOn})`];
    });
    const heading = member.username ?? `Member #${member.memberNumber} (no username yet)`;
    put(memberPath(member.base), [
      ...frontmatter(
        [
          ["type", " member"],
          ["member_number", num(member.memberNumber)],
          ["user_id", text(member.userId)],
          ["username", yamlOptional(member.username)],
          ["display_name", yamlOptional(member.displayName)],
          ["rank", yamlOptional(member.rank)],
          ["joined_on", date(member.joinedOn)],
          ["last_active_on", date(member.lastActiveOn)],
          ["lessons_completed", num(member.completions.length)],
          ["pace_30d", num(member.pace)],
          ["discord_username", yamlOptional(member.discordUsername)],
        ],
        ["zc/member", rankTag(member.rank)],
      ),
      `# ${heading}`,
      "",
      `Member **#${member.memberNumber}** · joined ${member.joinedOn} · ${wikilink(rankPath(member.rank), rankTitle(member.rank))}`,
      "",
      `- Display name: ${member.displayName === null ? "none" : codeSpan(member.displayName)}`,
      `- Discord: ${member.discordUsername === null ? "not linked" : codeSpan(member.discordUsername)}`,
      `- Lessons completed: **${member.completions.length}**, ${member.pace} of them in the last ${PACE_DAYS} days`,
      `- Last Academy activity: ${member.lastActiveOn ?? "none yet"}`,
      `- Levels finished: ${levels.length > 0 ? levels.join(", ") : "none yet"}`,
      "",
      "## Lessons completed",
      "",
      ...(member.completions.length === 0
        ? ["None yet."]
        : member.completions.map(
            (entry) =>
              `- ${entry.completedOn} · ${wikilink(lessonPath(entry.lessonId), lessonTitle(entry.lessonId))}`,
          )),
    ]);
  }

  // ── The Academy: courses, chapters, lessons ─────────────────────────────────
  const lessonNote = (lesson: Lesson | null, id: string, chapter: Chapter | null) => {
    const count = completedBy.get(id) ?? 0;
    const where = chapter
      ? `Lesson ${lesson?.number ?? "?"} of ${wikilink(chapterPath(chapter.id), chapterTitle(chapter))}.`
      : "This lesson is no longer in the Academy's files; its completions are kept.";
    put(lessonPath(id), [
      ...frontmatter(
        [
          ["type", " lesson"],
          ["lesson_id", text(id)],
          ["chapter", yamlOptional(chapter?.id ?? null)],
          ["course", yamlOptional(chapter?.courseId ?? null)],
          ["in_academy", bool(lesson !== null)],
          ["draft", bool(lesson?.draft ?? false)],
          ["completed_by", num(count)],
        ],
        ["zc/lesson"],
        [lessonTitle(id)],
      ),
      `# ${lessonTitle(id)}`,
      "",
      where,
      ...(lesson?.draft ? ["", "Not written yet (a draft): nobody can open or complete it."] : []),
      "",
      `Completed by **${plural(count, "member")}**; they are listed under Backlinks.`,
    ]);
  };

  let lessonNotes = 0;
  for (const course of catalog.courses) {
    const lessonCount = course.chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0);
    put(coursePath(course.id), [
      ...frontmatter(
        [
          ["type", " course"],
          ["course_id", text(course.id)],
          ["level", num(course.level)],
          ["coming_soon", bool(course.comingSoon)],
          ["chapters", num(course.chapters.length)],
          ["lessons", num(lessonCount)],
        ],
        ["zc/course"],
        [courseTitle(course)],
      ),
      `# ${courseTitle(course)}`,
      "",
      `Part of the ${wikilink(HUB, "ZeroCorps Brain")}.${course.comingSoon ? " Coming soon: nothing in it can be completed yet." : ""}`,
      "",
      "## Chapters",
      "",
      ...(course.chapters.length === 0
        ? ["None yet."]
        : course.chapters.map(
            (chapter) =>
              `- ${wikilink(chapterPath(chapter.id), chapterTitle(chapter))}: ${plural(chapter.lessons.length, "lesson")}`,
          )),
    ]);
    for (const chapter of course.chapters) {
      put(chapterPath(chapter.id), [
        ...frontmatter(
          [
            ["type", " chapter"],
            ["chapter_id", text(chapter.id)],
            ["course", text(course.id)],
            ["number", num(chapter.number)],
            ["lessons", num(chapter.lessons.length)],
          ],
          ["zc/chapter"],
          [chapterTitle(chapter)],
        ),
        `# ${chapterTitle(chapter)}`,
        "",
        `Part of ${wikilink(coursePath(course.id), courseTitle(course))}.`,
        "",
        "## Lessons",
        "",
        ...(chapter.lessons.length === 0
          ? ["None yet."]
          : chapter.lessons.map(
              (lesson) =>
                `${lesson.number}. ${wikilink(lessonPath(lesson.id), plainTitle(lesson.title))}: completed by ${completedBy.get(lesson.id) ?? 0}${lesson.draft ? " (draft)" : ""}`,
            )),
      ]);
      for (const lesson of chapter.lessons) {
        lessonNote(lesson, lesson.id, chapter);
        lessonNotes++;
      }
    }
  }
  // Lessons someone completed that the Academy's files no longer have.
  for (const id of [...completedBy.keys()].sort()) {
    if (catalog.lessons.has(id)) continue;
    lessonNote(null, id, null);
    lessonNotes++;
  }

  // ── Ranks ───────────────────────────────────────────────────────────────────
  const holders = (key: string | null) => members.filter((member) => member.rank === key).length;
  for (const key of [...rankKeys, null]) {
    put(rankPath(key), [
      ...frontmatter(
        [
          ["type", " rank"],
          ["rank", yamlOptional(key)],
          ["members", num(holders(key))],
        ],
        ["zc/rank-note", rankTag(key)],
      ),
      `# ${rankTitle(key)}`,
      "",
      key === ROOKIE_KEY
        ? "Earned by completing Chapter 1 of the Academy: its lessons and its checkpoint. Its Discord role follows once the member links Discord."
        : key === null
          ? "Members who have not earned a rank yet."
          : "A rank the site awards; its description is not written here yet.",
      "",
      `**${plural(holders(key), "member")}**; they are listed under Backlinks. Back to the ${wikilink(HUB, "ZeroCorps Brain")}.`,
    ]);
  }

  // ── The leaderboard: pace over the last 30 days ─────────────────────────────
  const board = members
    .filter((member) => member.pace > 0)
    .sort(
      (a, b) =>
        b.pace - a.pace ||
        b.completions.length - a.completions.length ||
        a.memberNumber - b.memberNumber,
    );
  let place = 0;
  const boardRows = board.map((member, index) => {
    // Ties share a place: 1, 2, 2, 4.
    if (index === 0 || (board[index - 1]?.pace ?? 0) !== member.pace) place = index + 1;
    return `| ${place} | ${memberLink(member, true)} | ${member.pace} | ${member.completions.length} | ${rankTitle(member.rank)} | ${member.lastActiveOn ?? ""} |`;
  });
  const idle = members.length - board.length;
  put(LEADERBOARD, [
    ...frontmatter(
      [
        ["type", " leaderboard"],
        ["window_start", date(windowStart)],
        ["window_end", date(today)],
      ],
      ["zc/hub"],
    ),
    `# Leaderboard: pace over the last ${PACE_DAYS} days`,
    "",
    `Lessons completed from ${windowStart} to ${today} (UTC days), beside the all-time total. Ties share a place. Back to the ${wikilink(HUB, "ZeroCorps Brain")}.`,
    "",
    ...(board.length === 0
      ? [`Nobody completed a lesson in the last ${PACE_DAYS} days.`]
      : [
          "| Place | Member | Last 30 days | All time | Rank | Last active |",
          "| ---: | --- | ---: | ---: | --- | --- |",
          ...boardRows,
        ]),
    ...(idle > 0 && board.length > 0
      ? [
          "",
          `Not on the board: ${plural(idle, "member")} with no lesson in the last ${PACE_DAYS} days.`,
        ]
      : []),
  ]);

  // ── The hub ─────────────────────────────────────────────────────────────────
  const inWindow = members.reduce((sum, member) => sum + member.pace, 0);
  const linked = members.filter((member) => member.discordUsername !== null).length;
  put(HUB, [
    ...frontmatter(
      [
        ["type", " hub"],
        ["generated_at", text(now.toISOString())],
        ["members", num(members.length)],
      ],
      ["zc/hub"],
    ),
    "# ZeroCorps Brain",
    "",
    `Rebuilt from the database by \`npm run brain:export\` on ${today} at ${now.toISOString().slice(11, 16)} UTC. Every note in the ${BRAIN_FOLDER} folder is replaced on each run, so keep your own notes outside it.`,
    "",
    "## At a glance",
    "",
    `- Members: **${members.length}**, of whom **${linked}** linked Discord`,
    `- Lessons completed: **${data.completions.length}** in all, **${inWindow}** in the last ${PACE_DAYS} days`,
    `- Ranks: ${[...rankKeys, null].map((key) => `${wikilink(rankPath(key), rankTitle(key))} ${holders(key)}`).join(" · ")}`,
    `- ${wikilink(LEADERBOARD, `Leaderboard: pace over the last ${PACE_DAYS} days`)}`,
    "",
    "## The Academy",
    "",
    ...(catalog.courses.length === 0
      ? ["No courses in the Academy's files."]
      : catalog.courses.map((course) => {
          const lessons = course.chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0);
          return `- ${wikilink(coursePath(course.id), courseTitle(course))}: ${plural(course.chapters.length, "chapter")}, ${plural(lessons, "lesson")}${course.comingSoon ? " (coming soon)" : ""}`;
        })),
    "",
    "## Members",
    "",
    ...(members.length === 0
      ? ["No accounts yet."]
      : [
          "| # | Member | Joined | Rank | Lessons | Last 30 days | Last active |",
          "| ---: | --- | --- | --- | ---: | ---: | --- |",
          ...members.map(
            (member) =>
              `| ${member.memberNumber} | ${memberLink(member, true)} | ${member.joinedOn} | ${rankTitle(member.rank)} | ${member.completions.length} | ${member.pace} | ${member.lastActiveOn ?? ""} |`,
          ),
        ]),
  ]);

  // ── Graph colours, keyed on the rank tags first ─────────────────────────────
  const rgb = (hex: string) => ({ a: 1 as const, rgb: Number.parseInt(hex.slice(1), 16) });
  const colorGroups: ColorGroup[] = [
    ...rankKeys.map((key) => ({
      query: `tag:#${rankTag(key)}`,
      color: rgb(key === ROOKIE_KEY ? "#ff3b47" : "#3dd68c"),
    })),
    { query: `tag:#${rankTag(null)}`, color: rgb("#918385") },
    { query: "tag:#zc/lesson", color: rgb("#4da3ff") },
    { query: "tag:#zc/chapter", color: rgb("#b18cff") },
    { query: "tag:#zc/course", color: rgb("#f5c542") },
    { query: "tag:#zc/hub", color: rgb("#f2eded") },
  ];

  return {
    files,
    colorGroups,
    counts: { members: members.length, lessonNotes, completions: data.completions.length },
  };
}
