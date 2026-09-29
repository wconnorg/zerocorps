import type { Route } from "next";
import Link from "next/link";
import { isOpen, type Lesson } from "@/lib/academy/content";
import {
  checkpointHref,
  chapterHref,
  lessonHref,
  type MemberAcademy,
  rankClaimed,
} from "@/lib/academy/member";
import { renderInline, renderMarkdown } from "@/lib/academy/markdown";
import { cn } from "@/lib/cn";
import { LessonActions } from "./lesson-actions";
import { QuickCheck } from "./quick-check";
import { Label, StatusIcon } from "./ui";

/**
 * A lesson: the chapter's contents down the side, the owner's writing in the middle, and
 * "Mark complete" at the end. The Markdown is rendered here, on the server, with raw HTML
 * switched off; the browser only ever receives the result.
 */

const two = (n: number) => String(n).padStart(2, "0");

export function LessonView({ academy, lesson }: { academy: MemberAcademy; lesson: Lesson }) {
  const entry = academy.standing.chapters.get(lesson.chapterId)!;
  const { chapter, course } = entry;
  const open = chapter.lessons.filter((candidate) => isOpen(academy.catalog, candidate));
  const index = open.findIndex((candidate) => candidate.id === lesson.id);
  const previousLesson = index > 0 ? open[index - 1]! : null;
  const nextLesson = open[index + 1] ?? null;
  const done = academy.completed.has(lesson.id);

  const next: { href: Route; label: string; hint: string } = nextLesson
    ? { href: lessonHref(nextLesson), label: "Next lesson", hint: `Next: ${nextLesson.title}` }
    : entry.hasCheckpoint && !entry.checkpointPassed
      ? {
          href: checkpointHref(chapter),
          label: "Take the checkpoint",
          hint: "The last lesson in this chapter. The checkpoint opens next.",
        }
      : {
          href: "/academy",
          label: "Back to the Academy",
          hint: "The last lesson in this chapter.",
        };

  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <nav
        aria-label="This chapter"
        className="flex flex-col gap-5 border-b border-line/70 px-6 py-8 lg:border-r lg:border-b-0 lg:py-14 lg:pr-8"
      >
        <div className="flex flex-col gap-2">
          <Label>
            Chapter {two(chapter.number)}
            {course.platform ? ` · ${course.platform}` : ""}
          </Label>
          <Link
            href={chapterHref(chapter)}
            prefetch={false}
            className="text-base font-medium hover:text-accent"
          >
            {chapter.title}
          </Link>
        </div>
        <ol className="flex flex-col gap-1">
          {chapter.lessons.map((candidate) => {
            const candidateOpen = isOpen(academy.catalog, candidate);
            const current = candidate.id === lesson.id;
            const candidateDone = academy.completed.has(candidate.id);
            const content = (
              <>
                <StatusIcon
                  state={
                    !candidateOpen
                      ? "locked"
                      : candidateDone
                        ? "done"
                        : current
                          ? "current"
                          : "todo"
                  }
                  className="size-4.5"
                />
                <span className="min-w-0">{candidate.title}</span>
              </>
            );
            const rowClass = cn(
              "flex min-h-11 items-center gap-3 text-sm",
              current ? "font-medium text-fg" : "text-muted",
            );
            return (
              <li key={candidate.id}>
                {candidateOpen ? (
                  <Link
                    href={lessonHref(candidate)}
                    prefetch={false}
                    aria-current={current ? "page" : undefined}
                    className={cn(rowClass, !current && "hover:text-fg")}
                  >
                    {content}
                  </Link>
                ) : (
                  <span className={cn(rowClass, "text-subtle")}>{content}</span>
                )}
              </li>
            );
          })}
          {entry.hasCheckpoint ? (
            <li>
              {entry.lessonsDone ? (
                <Link
                  href={checkpointHref(chapter)}
                  prefetch={false}
                  className="flex min-h-11 items-center gap-3 text-sm text-muted hover:text-fg"
                >
                  <StatusIcon
                    state={entry.checkpointPassed ? "done" : "current"}
                    className="size-4.5"
                  />
                  Checkpoint
                </Link>
              ) : (
                <span className="flex min-h-11 items-center gap-3 text-sm text-subtle">
                  <StatusIcon state="locked" className="size-4.5" />
                  Checkpoint
                </span>
              )}
            </li>
          ) : null}
        </ol>
      </nav>

      <article className="flex w-full max-w-3xl flex-col px-6 py-10 lg:py-16 lg:pl-16">
        <header className="flex flex-col gap-5">
          <p className="font-mono text-xs tracking-[0.22em] text-accent">
            LESSON {lesson.number} OF {chapter.lessons.length} · {lesson.minutes} MIN READ
          </p>
          <h1 className="text-3xl leading-tight font-medium tracking-tight sm:text-5xl">
            {lesson.title}
          </h1>
          <p className="text-lg/8 text-muted sm:text-xl/9">{lesson.summary}</p>
        </header>
        <div aria-hidden="true" className="my-8 h-px bg-line" />

        {lesson.parts.map((part, partIndex) =>
          part.kind === "markdown" ? (
            <div
              key={partIndex}
              className="lesson-prose"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(part.source) }}
            />
          ) : (
            <QuickCheck
              key={partIndex}
              questionHtml={renderInline(part.question)}
              optionsHtml={part.options.map((option) => renderInline(option))}
              correct={part.correct}
              explanationHtml={part.explanation ? renderMarkdown(part.explanation) : ""}
            />
          ),
        )}

        <LessonActions
          claimed={rankClaimed(academy)}
          lessonId={lesson.id}
          done={done}
          next={next}
          previous={
            previousLesson
              ? { href: lessonHref(previousLesson), label: previousLesson.title }
              : null
          }
        />
        <p className="mt-10 text-sm text-subtle">
          Education only. Nothing in the Academy is financial advice.
        </p>
      </article>
    </div>
  );
}
