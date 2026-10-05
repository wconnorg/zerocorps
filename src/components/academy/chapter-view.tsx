import Link from "next/link";
import { isOpen } from "@/lib/academy/content";
import { checkpointHref, lessonHref, type MemberAcademy } from "@/lib/academy/member";
import { RANK_TITLE } from "@/lib/academy/ranks";
import { cn } from "@/lib/cn";
import { chapterStatus } from "./academy-home";
import { Bar, ComingSoonTag, Kicker, Label, StatusIcon } from "./ui";

/** One chapter: its lessons in order, and its checkpoint. */

const two = (n: number) => String(n).padStart(2, "0");

export function ChapterView({ academy, chapterId }: { academy: MemberAcademy; chapterId: string }) {
  const entry = academy.standing.chapters.get(chapterId)!;
  const { chapter, course } = entry;
  const level = academy.standing.levels.find((candidate) => candidate.level === course.level);
  const minutes = chapter.lessons
    .filter((lesson) => isOpen(academy.catalog, lesson))
    .reduce((sum, lesson) => sum + lesson.minutes, 0);
  const status = chapterStatus(entry);
  const remaining = entry.openLessons - entry.doneLessons;

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] hero-glow"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 lg:py-16">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.6875rem] tracking-[0.2em] text-subtle uppercase">
            <li>
              <Link href="/academy" prefetch={false} className="hover:text-fg">
                Academy
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              Level {two(course.level)} · {level?.name}
            </li>
            {course.platform ? (
              <>
                <li aria-hidden="true">/</li>
                <li>{course.platform}</li>
              </>
            ) : null}
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-accent">
              Chapter {two(chapter.number)}
            </li>
          </ol>
        </nav>

        <header className="flex max-w-3xl flex-col gap-5">
          <h1 className="text-4xl leading-tight font-light tracking-[0.04em] sm:text-5xl">
            {chapter.title}
          </h1>
          {chapter.summary ? <p className="text-lg/8 text-muted">{chapter.summary}</p> : null}
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span>{chapter.lessons.length} lessons</span>
            {minutes > 0 ? <span>About {minutes} minutes</span> : null}
            {entry.hasCheckpoint ? (
              <span>Checkpoint: {chapter.checkpoint!.questions.length} questions</span>
            ) : null}
            {course.comingSoon ? <ComingSoonTag /> : null}
          </p>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-8">
            <ol className="flex flex-col border border-line bg-surface">
              {chapter.lessons.map((lesson) => {
                const open = isOpen(academy.catalog, lesson);
                const done = academy.completed.has(lesson.id) && open;
                const current = open && !done && entry.nextLesson?.id === lesson.id;
                const row = (
                  <>
                    <StatusIcon
                      state={!open ? "locked" : done ? "done" : current ? "current" : "todo"}
                      className="size-6"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="font-mono text-[0.6875rem] tracking-[0.2em] text-subtle">
                        LESSON {lesson.number}
                        {open ? ` · ${lesson.minutes} MIN` : " · COMING SOON"}
                      </span>
                      <span className="text-lg font-medium">{lesson.title}</span>
                      <span className="text-sm text-muted">{lesson.summary}</span>
                    </div>
                  </>
                );
                const rowClass =
                  "flex min-h-24 items-center gap-5 border-b border-line/60 px-6 py-5 last:border-b-0";
                return (
                  <li key={lesson.id}>
                    {open ? (
                      <Link
                        href={lessonHref(lesson)}
                        prefetch={false}
                        className={cn(rowClass, "transition-colors hover:bg-raised")}
                      >
                        {row}
                        <span
                          className={cn(
                            "hidden shrink-0 text-sm sm:inline",
                            done ? "text-subtle" : "text-accent",
                          )}
                        >
                          {done ? "Review" : current ? "Continue" : "Start"}
                        </span>
                      </Link>
                    ) : (
                      <div className={cn(rowClass, "text-muted")}>{row}</div>
                    )}
                  </li>
                );
              })}
            </ol>

            {entry.hasCheckpoint ? (
              <CheckpointCard
                href={checkpointHref(chapter)}
                questions={chapter.checkpoint!.questions.length}
                pass={chapter.checkpoint!.pass}
                ready={entry.lessonsDone}
                passed={entry.checkpointPassed}
                remaining={remaining}
              />
            ) : null}
          </div>

          <aside className="flex flex-col gap-4 lg:col-span-4">
            <div className="flex flex-col gap-4 border border-line-strong bg-surface p-6">
              <Label>This chapter</Label>
              <p
                className={cn(
                  "font-mono text-xs tracking-[0.18em]",
                  status.state === "done" ? "text-success" : "text-accent",
                )}
              >
                {status.label}
              </p>
              <Bar
                value={entry.openLessons ? entry.doneLessons / entry.openLessons : 0}
                tone={entry.complete ? "success" : "accent"}
              />
              <p className="text-sm text-muted">{status.meta}</p>
            </div>
            {level ? (
              <div className="flex flex-col gap-3 border border-line bg-surface p-6">
                <Label>
                  Level {two(level.level)} · {level.name}
                </Label>
                <p className="text-sm/6 text-muted">
                  {level.finished
                    ? `Level complete: a step towards ${RANK_TITLE}.`
                    : `${level.chaptersComplete} of ${level.courses.filter((c) => !c.comingSoon).reduce((n, c) => n + c.chapters.length, 0)} chapters complete. Finish them all for a step towards ${RANK_TITLE}.`}
                </p>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

function CheckpointCard({
  href,
  questions,
  pass,
  ready,
  passed,
  remaining,
}: {
  href: ReturnType<typeof checkpointHref>;
  questions: number;
  pass: number;
  ready: boolean;
  passed: boolean;
  remaining: number;
}) {
  const body = (
    <>
      <div
        className={cn(
          "flex size-13 shrink-0 items-center justify-center border",
          passed
            ? "border-success/50 text-success"
            : ready
              ? "border-accent text-accent"
              : "border-line-strong text-subtle",
        )}
      >
        <StatusIcon state={passed ? "done" : ready ? "current" : "locked"} className="size-6" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Kicker>Checkpoint</Kicker>
        <span className="text-lg font-medium">
          {questions} questions · pass with {pass} correct
        </span>
        <span className="text-sm/6 text-muted">
          {passed
            ? "Passed. You can take it again at any time; your pass is kept."
            : ready
              ? "Ready when you are. A wrong answer points you back to the lesson that covers it, and you can retake it."
              : "Opens when every lesson in this chapter is complete."}
        </span>
      </div>
      <span
        className={cn(
          "shrink-0 font-mono text-[0.6875rem] tracking-[0.2em]",
          passed ? "text-success" : ready ? "text-accent" : "text-subtle",
        )}
      >
        {passed
          ? "PASSED"
          : ready
            ? "TAKE IT"
            : `${remaining} LESSON${remaining === 1 ? "" : "S"} TO GO`}
      </span>
    </>
  );
  const frame = "flex flex-col gap-5 border p-6 sm:flex-row sm:items-center";
  return ready ? (
    <Link
      href={href}
      prefetch={false}
      className={cn(frame, "border-line-strong bg-surface transition-colors hover:border-accent")}
    >
      {body}
    </Link>
  ) : (
    <div className={cn(frame, "border-dashed border-line-strong bg-bg")}>{body}</div>
  );
}
