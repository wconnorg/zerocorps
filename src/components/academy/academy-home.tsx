import Link from "next/link";
import type { Course } from "@/lib/academy/content";
import {
  checkpointHref,
  chapterHref,
  lessonHref,
  type MemberAcademy,
  rankClaimed,
} from "@/lib/academy/member";
import {
  BRONZE_KEY,
  BRONZE_LEVELS,
  type ChapterStanding,
  type LevelStanding,
  levelStepKey,
  RANK_TITLE,
  rankKeyOf,
} from "@/lib/academy/standing";
import { cn } from "@/lib/cn";
import {
  Bar,
  ComingSoonTag,
  Kicker,
  Label,
  type LessonState,
  Rule,
  SegmentMeter,
  StatusIcon,
} from "./ui";

/**
 * The Academy's home for a signed-in member: where they are, where to go next, what they
 * have done, and the whole map of levels and chapters. The design is the prototype the
 * owner approved (DECISIONS.md, 2026-09-28), with the ranks of 2026-10-05: Bronze for
 * finishing Levels 1 and 2.
 *
 * It draws what it is given and reads nothing itself, so it can be rendered in a test.
 */

const two = (n: number) => String(n).padStart(2, "0");

export function chapterStatus(entry: ChapterStanding): {
  state: LessonState;
  label: string;
  meta: string;
} {
  const { openLessons: open, doneLessons: done } = entry;
  if (!entry.open) {
    return {
      state: "locked",
      label: "COMING SOON",
      meta: `${entry.chapter.lessons.length} lessons on the way`,
    };
  }
  if (entry.complete) {
    return {
      state: "done",
      label: "COMPLETE",
      meta: `${open} lessons${entry.hasCheckpoint ? " · checkpoint passed" : ""}`,
    };
  }
  if (entry.lessonsDone && entry.hasCheckpoint) {
    return {
      state: "current",
      label: "CHECKPOINT READY",
      meta: `${open} lessons · checkpoint ready`,
    };
  }
  if (done > 0)
    return { state: "current", label: "IN PROGRESS", meta: `${done} of ${open} lessons` };
  return { state: "todo", label: "NOT STARTED", meta: `${open} lessons` };
}

const labelTone: Record<LessonState, string> = {
  done: "text-success",
  current: "text-accent",
  todo: "text-subtle",
  locked: "text-subtle",
};

export function AcademyHome({
  academy,
  activity,
}: {
  academy: MemberAcademy;
  activity: ReadonlyMap<string, number>;
}) {
  const { standing, steps } = academy;
  const levelsDone = BRONZE_LEVELS.filter((level) => steps.has(levelStepKey(level))).length;

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] hero-glow"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-12 lg:py-16">
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="flex flex-col justify-between gap-10 lg:col-span-7">
            <div className="flex flex-col gap-5">
              <Kicker>ZeroCorps Academy · Free</Kicker>
              <h1 className="text-4xl font-light tracking-[0.2em] uppercase sm:text-5xl">
                Academy
              </h1>
              <Rule />
              <p className="max-w-xl text-base/7 text-muted sm:text-lg/8">
                From your first order to a process you have tested yourself. Finish a chapter, pass
                its checkpoint, and your rank follows.
              </p>
            </div>
            <ContinueCard academy={academy} />
          </div>
          <RankCard academy={academy} levelsDone={levelsDone} />
        </section>

        <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="flex flex-col gap-5 border border-line bg-surface p-6 sm:p-8 lg:col-span-8">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-mono text-xs font-medium tracking-[0.22em]">ACTIVITY</h2>
              <span className="text-sm text-subtle">Last 26 weeks</span>
            </div>
            <Heatmap activity={activity} />
          </div>
          <div className="flex flex-col border border-line bg-surface p-6 sm:p-8 lg:col-span-4">
            <h2 className="mb-2 font-mono text-xs font-medium tracking-[0.22em]">YOUR RECORD</h2>
            <Stat
              label="Lessons completed"
              value={standing.lessonsDone}
              of={standing.lessonsOpen}
            />
            <Stat label="Checkpoints passed" value={standing.checkpointsPassed} />
            <Stat label="Active days, last 30" value={activeDays(activity, 30)} last />
          </div>
        </section>

        {standing.levels.map((level) => (
          <LevelSection key={level.level} level={level} academy={academy} />
        ))}

        <p className="border-t border-line pt-6 text-sm text-subtle">
          Education only. Nothing in the Academy is financial advice.
        </p>
      </div>
    </div>
  );
}

function ContinueCard({ academy }: { academy: MemberAcademy }) {
  const next = academy.standing.next;
  if (!next) {
    const nothingYet = academy.standing.lessonsOpen === 0;
    return (
      <div className="flex flex-col gap-2 border border-line-strong bg-surface p-6">
        <Label className={nothingYet ? "text-accent" : "text-success"}>
          {nothingYet ? "First lessons on the way" : "Everything open is done"}
        </Label>
        <p className="text-lg font-medium">
          {nothingYet
            ? "The first lessons are being written. They appear here as soon as they are published."
            : "New lessons appear here as they are written."}
        </p>
      </div>
    );
  }
  const { chapter, lesson } = next;
  const href = lesson ? lessonHref(lesson) : checkpointHref(chapter);
  return (
    <Link
      href={href}
      prefetch={false}
      className="group flex flex-col gap-5 border border-line-strong bg-surface p-6 transition-colors hover:border-accent sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Label>
          {lesson
            ? `Continue · Chapter ${two(chapter.number)} · Lesson ${lesson.number} of ${chapter.lessons.length}`
            : `Checkpoint ready · Chapter ${two(chapter.number)}`}
        </Label>
        <span className="text-xl font-medium tracking-tight sm:text-2xl">
          {lesson ? lesson.title : "Take the checkpoint"}
        </span>
        <span className="text-sm text-muted">{chapter.title}</span>
      </div>
      <span className="inline-flex h-12 shrink-0 items-center justify-center gap-2.5 bg-accent px-6 text-base font-semibold text-accent-fg transition-colors group-hover:bg-accent/90">
        {lesson ? "Resume" : "Start"}
        <Arrow />
      </span>
    </Link>
  );
}

function RankCard({ academy, levelsDone }: { academy: MemberAcademy; levelsDone: number }) {
  const levels = academy.standing.levels.filter((level) =>
    (BRONZE_LEVELS as readonly number[]).includes(level.level),
  );
  const isBronze = rankKeyOf(academy.steps) === BRONZE_KEY;
  // Earned in the Academy, claimed by linking Discord (owner, 2026-09-29).
  const claimed = isBronze && rankClaimed(academy);
  // How far along both levels the member is, chapter by chapter, before Bronze.
  const chaptersTotal = levels.reduce(
    (sum, level) =>
      sum +
      level.courses
        .filter((course) => !course.comingSoon)
        .reduce((n, course) => n + course.chapters.length, 0),
    0,
  );
  const chaptersDone = levels.reduce((sum, level) => sum + level.chaptersComplete, 0);
  return (
    <aside
      aria-label="Your rank"
      className="relative flex flex-col gap-6 overflow-hidden border border-line-strong bg-surface p-6 sm:p-8 lg:col-span-5"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -bottom-40 size-[26rem] rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative flex items-center justify-between">
        <Label>{claimed ? "Current rank" : isBronze ? "Rank earned" : "No rank yet"}</Label>
        <Label>
          Levels {levelsDone} of {BRONZE_LEVELS.length}
        </Label>
      </div>
      <p
        className={cn(
          "relative text-4xl leading-none font-light tracking-[0.2em] uppercase sm:text-5xl",
          !isBronze && "text-subtle",
        )}
      >
        {RANK_TITLE}
      </p>
      {claimed ? (
        <SegmentMeter total={BRONZE_LEVELS.length} filled={levelsDone} className="relative" />
      ) : isBronze ? (
        <p className="relative text-sm/6 text-muted">
          {academy.discord.available ? (
            <>
              <Link
                href="/settings#connections"
                prefetch={false}
                className="text-accent underline-offset-4 hover:underline"
              >
                Link Discord
              </Link>{" "}
              to claim it. Your rank shows here and in the ZeroCorps server once you do.
            </>
          ) : (
            "Link Discord to claim it, once Discord linking opens. Your rank is kept for you."
          )}
        </p>
      ) : chaptersTotal > 0 ? (
        <div className="relative flex flex-col gap-2.5">
          <Bar value={chaptersDone / chaptersTotal} />
          <p className="text-sm text-muted">
            Finish both levels below, every chapter and its checkpoint, to earn it.
          </p>
        </div>
      ) : null}
      <ul className="relative flex flex-col gap-2.5 text-sm">
        {BRONZE_LEVELS.map((number) => {
          const level = levels.find((candidate) => candidate.level === number);
          const earned = academy.steps.has(levelStepKey(number));
          return (
            <li key={number} className="flex items-center justify-between gap-4">
              <span className={earned ? "text-fg" : "text-muted"}>
                Level {number}
                {level ? ` · ${level.name}` : ""}
              </span>
              <span
                className={cn(
                  "shrink-0 font-mono text-xs tracking-[0.14em]",
                  earned ? "text-success" : "text-subtle",
                )}
              >
                {earned
                  ? "COMPLETE"
                  : level
                    ? `${level.chaptersComplete} / ${level.courses
                        .filter((course) => !course.comingSoon)
                        .reduce((sum, course) => sum + course.chapters.length, 0)} CHAPTERS`
                    : "TO COME"}
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        href="/academy/ranks"
        prefetch={false}
        className="relative inline-flex min-h-11 items-center gap-2 self-start text-sm text-accent hover:text-accent/80"
      >
        How ranks work
        <Arrow />
      </Link>
    </aside>
  );
}

function Stat({
  label,
  value,
  of,
  last,
}: {
  label: string;
  value: number;
  of?: number;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-4",
        !last && "border-b border-line",
      )}
    >
      <span className="text-sm text-muted">{label}</span>
      <span className="text-2xl font-light tabular-nums">
        {value}
        {of !== undefined ? <span className="text-sm text-subtle"> / {of}</span> : null}
      </span>
    </div>
  );
}

function LevelSection({ level, academy }: { level: LevelStanding; academy: MemberAcademy }) {
  const counted = level.courses.filter((course) => !course.comingSoon);
  const lessonCount = level.courses.reduce(
    (sum, course) => sum + course.chapters.reduce((n, chapter) => n + chapter.lessons.length, 0),
    0,
  );
  const chapterCount = level.courses.reduce((sum, course) => sum + course.chapters.length, 0);
  return (
    <section aria-labelledby={`level-${level.level}`} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <Kicker>Level {two(level.level)}</Kicker>
          <h2
            id={`level-${level.level}`}
            className="text-2xl leading-none font-light tracking-[0.18em] uppercase sm:text-3xl"
          >
            {level.name}
          </h2>
        </div>
        <p className="text-sm text-muted">
          {level.courses.length > 1
            ? `${level.courses.length} platforms · `
            : "Open to everyone · "}
          {chapterCount} chapters · {lessonCount} lessons
        </p>
      </div>
      {level.courses.length === 1 && counted.length === 1 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {level.courses[0]!.chapters.map((chapter) => (
            <li key={chapter.id}>
              <ChapterCard entry={academy.standing.chapters.get(chapter.id)!} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {level.courses.map((course) => (
            <CoursePanel key={course.id} course={course} academy={academy} />
          ))}
        </div>
      )}
    </section>
  );
}

function ChapterCard({ entry }: { entry: ChapterStanding }) {
  const status = chapterStatus(entry);
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs tracking-[0.18em] text-subtle">
          CH {two(entry.chapter.number)}
        </span>
        <span
          className={cn("font-mono text-[0.625rem] tracking-[0.18em]", labelTone[status.state])}
        >
          {status.label}
        </span>
      </div>
      <span className="flex-1 text-lg leading-snug font-medium">{entry.chapter.title}</span>
      <div className="flex flex-col gap-2.5">
        <Bar
          value={entry.openLessons ? entry.doneLessons / entry.openLessons : 0}
          tone={entry.complete ? "success" : "accent"}
        />
        <span className="text-sm text-subtle">{status.meta}</span>
      </div>
    </>
  );
  const frame = cn(
    "flex h-full min-h-44 flex-col gap-4 border bg-surface p-5",
    status.state === "current" ? "border-accent" : "border-line",
  );
  return entry.open ? (
    <Link
      href={chapterHref(entry.chapter)}
      prefetch={false}
      className={cn(frame, "transition-colors hover:border-line-strong hover:bg-raised")}
    >
      {body}
    </Link>
  ) : (
    <div className={cn(frame, "opacity-80")}>{body}</div>
  );
}

function CoursePanel({ course, academy }: { course: Course; academy: MemberAcademy }) {
  return (
    <div
      className={cn(
        "flex flex-col border border-line bg-surface",
        course.comingSoon && "opacity-90",
      )}
    >
      <div className="flex items-start justify-between gap-5 border-b border-line p-6">
        <div className="flex flex-col gap-2">
          <h3 className="text-xl font-medium">{course.platform ?? course.title}</h3>
          {course.platform ? (
            <p className="font-mono text-xs tracking-[0.16em] text-subtle uppercase">
              {course.title}
            </p>
          ) : null}
          <p className="text-sm/6 text-muted">{course.summary}</p>
        </div>
        {course.comingSoon ? <ComingSoonTag className="shrink-0" /> : null}
      </div>
      <ul>
        {course.chapters.map((chapter) => {
          const entry = academy.standing.chapters.get(chapter.id)!;
          const status = chapterStatus(entry);
          const row = (
            <>
              <StatusIcon state={status.state} />
              <span className="w-12 shrink-0 font-mono text-xs tracking-[0.16em] text-subtle">
                CH {two(chapter.number)}
              </span>
              <span className="min-w-0 flex-1 text-base">{chapter.title}</span>
              <span className="hidden text-sm text-subtle sm:inline">{status.meta}</span>
            </>
          );
          const rowClass =
            "flex min-h-16 items-center gap-4 border-b border-line/60 px-6 py-4 last:border-b-0";
          return (
            <li key={chapter.id}>
              {entry.open ? (
                <Link
                  href={chapterHref(chapter)}
                  prefetch={false}
                  className={cn(rowClass, "transition-colors hover:bg-raised")}
                >
                  {row}
                  <Chevron />
                </Link>
              ) : (
                <div className={cn(rowClass, "text-muted")}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── The activity heatmap ────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

function activeDays(activity: ReadonlyMap<string, number>, days: number): number {
  const today = new Date();
  let active = 0;
  for (let i = 0; i < days; i++) {
    if ((activity.get(isoDay(new Date(today.getTime() - i * DAY_MS))) ?? 0) > 0) active += 1;
  }
  return active;
}

const LEVEL_CLASS = ["bg-raised", "bg-accent/25", "bg-accent/50", "bg-accent/75", "bg-accent"];
const levelOf = (lessons: number) =>
  lessons === 0 ? 0 : lessons === 1 ? 1 : lessons === 2 ? 2 : lessons <= 4 ? 3 : 4;

/** 26 columns of weeks, Monday at the top, ending with this week. Days are UTC days. */
export function Heatmap({
  activity,
  weeks = 26,
}: {
  activity: ReadonlyMap<string, number>;
  weeks?: number;
}) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const start = new Date(today.getTime() - (mondayOffset + (weeks - 1) * 7) * DAY_MS);
  const columns = Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const date = new Date(start.getTime() + (week * 7 + weekday) * DAY_MS);
      if (date > today) return null;
      return { key: isoDay(date), lessons: activity.get(isoDay(date)) ?? 0 };
    }),
  );
  const cells = columns.flat().filter((cell) => cell !== null);
  const total = cells.reduce((sum, cell) => sum + cell.lessons, 0);
  const days = cells.filter((cell) => cell.lessons > 0).length;
  return (
    <div className="flex flex-col gap-4">
      <div
        role="img"
        aria-label={`${total} lessons completed on ${days} days in the last ${weeks} weeks`}
        // Reversed, so a phone too narrow for 26 weeks starts at this week and scrolls back.
        className="-mx-1 flex flex-row-reverse overflow-x-auto px-1 pb-1"
      >
        <div className="mr-auto flex w-max gap-1">
          {columns.map((column, index) => (
            <div key={index} className="flex flex-col gap-1">
              {column.map((cell, weekday) =>
                cell ? (
                  <span
                    key={cell.key}
                    title={`${cell.key}: ${cell.lessons} lesson${cell.lessons === 1 ? "" : "s"}`}
                    className={cn("size-3.5 sm:size-4", LEVEL_CLASS[levelOf(cell.lessons)])}
                  />
                ) : (
                  <span key={`empty-${weekday}`} className="size-3.5 sm:size-4" />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
      <div
        aria-hidden="true"
        className="flex items-center gap-1.5 font-mono text-[0.625rem] tracking-[0.14em] text-subtle"
      >
        <span className="mr-1">LESS</span>
        {LEVEL_CLASS.map((className) => (
          <span key={className} className={cn("size-3", className)} />
        ))}
        <span className="ml-1">MORE</span>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4 shrink-0 text-subtle"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
