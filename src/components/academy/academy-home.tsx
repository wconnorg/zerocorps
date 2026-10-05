import Link from "next/link";
import type { Course } from "@/lib/academy/content";
import { checkpointHref, chapterHref, lessonHref, type MemberAcademy } from "@/lib/academy/member";
import type { ChapterStanding, LevelStanding } from "@/lib/academy/standing";
import { cn } from "@/lib/cn";
import { Arrow, Bar, ComingSoonTag, Kicker, Label, type LessonState, Rule, StatusIcon } from "./ui";

/**
 * The Academy's home for a signed-in member, its Learn tab: where to go next, and the
 * whole map of levels and chapters. The design is the prototype the owner approved
 * (DECISIONS.md, 2026-09-28). The rank, the member's progress and the activity heatmap
 * moved to the Progress tab (owner, 2026-10-05); "Resume" stays here.
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

export function AcademyHome({ academy }: { academy: MemberAcademy }) {
  const { standing } = academy;

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] hero-glow"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-12 lg:py-16">
        <section className="grid grid-cols-1 items-end gap-8 lg:grid-cols-12">
          <div className="flex flex-col gap-5 lg:col-span-6">
            <Kicker>ZeroCorps Academy · Free</Kicker>
            <h1 className="text-4xl font-light tracking-[0.2em] uppercase sm:text-5xl">Academy</h1>
            <Rule />
            <p className="max-w-xl text-base/7 text-muted sm:text-lg/8">
              From your first order to a process you have tested yourself. Finish a chapter, pass
              its checkpoint, and your rank follows.
            </p>
          </div>
          <div className="lg:col-span-6">
            <ContinueCard academy={academy} />
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
