"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormMessage } from "@/components/ui/field";
import { authFetch } from "@/lib/auth/auth-fetch";
import { cn } from "@/lib/cn";

/**
 * A chapter's checkpoint. The page is given the questions and the options, and NOTHING
 * about which option is right: the answers go to the server, which grades them and says
 * which questions were right, and never which option was.
 */

export type CheckpointQuestionView = { questionHtml: string; optionsHtml: string[] };

type Result = {
  score: number;
  outOf: number;
  pass: number;
  passed: boolean;
  results: { right: boolean; reread: string | null }[];
  newSteps: string[];
};

export function CheckpointForm({
  chapterId,
  questions,
  pass,
  rereadLinks,
  chapterHref,
  claimed,
}: {
  chapterId: string;
  questions: CheckpointQuestionView[];
  pass: number;
  /** Lesson id → where it is and what it is called, for "Reread" after a wrong answer. */
  rereadLinks: Record<string, { href: Route; title: string }>;
  chapterHref: Route;
  /** Whether a newly earned rank shows as the member's: only once Discord is linked. */
  claimed: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answered = answers.filter((answer) => answer !== null).length;
  const ready = answered === questions.length;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    const response = await authFetch<Result>("/academy/checkpoint", {
      chapterId,
      answers: answers as number[],
    });
    setBusy(false);
    if (!response.ok) {
      setError(response.message);
      return;
    }
    setResult(response.data);
    if (response.data.passed) router.refresh();
  }

  function retry() {
    setResult(null);
    setAnswers(questions.map(() => null));
    setError(null);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted">
            {questions.length} questions. Pass with {pass} correct. No time limit.
          </span>
          <span className="font-mono text-xs tracking-[0.18em] text-subtle">
            {answered} / {questions.length} ANSWERED
          </span>
        </div>
        <div aria-hidden="true" className="flex gap-1.5">
          {questions.map((_, index) => {
            const outcome = result?.results[index];
            return (
              <span
                key={index}
                className={cn(
                  "h-1 flex-1",
                  outcome
                    ? outcome.right
                      ? "bg-success"
                      : "bg-danger"
                    : answers[index] !== null
                      ? "bg-accent"
                      : "bg-line",
                )}
              />
            );
          })}
        </div>
      </div>

      <ol className="flex flex-col gap-4">
        {questions.map((question, qIndex) => {
          const outcome = result?.results[qIndex];
          const reread =
            outcome && !outcome.right && outcome.reread ? rereadLinks[outcome.reread] : undefined;
          return (
            <li
              key={qIndex}
              className={cn(
                "flex flex-col gap-5 border bg-surface p-6",
                outcome
                  ? outcome.right
                    ? "border-success/40"
                    : "border-danger/50"
                  : "border-line",
              )}
            >
              <fieldset className="flex flex-col gap-5" disabled={result !== null || busy}>
                <legend className="flex gap-4 text-lg/7 font-medium">
                  <span className="shrink-0 pt-0.5 font-mono text-xs tracking-[0.18em] text-subtle">
                    Q{qIndex + 1}
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: question.questionHtml }} />
                </legend>
                <div className="flex flex-col gap-2.5 sm:pl-10">
                  {question.optionsHtml.map((html, oIndex) => {
                    const chosen = answers[qIndex] === oIndex;
                    return (
                      <label
                        key={oIndex}
                        className={cn(
                          "flex min-h-12 cursor-pointer items-center gap-4 border px-4 py-3 text-base transition-colors",
                          chosen
                            ? "border-accent bg-accent/5"
                            : "border-line-strong bg-bg hover:border-muted",
                          chosen &&
                            outcome &&
                            (outcome.right
                              ? "border-success bg-success/10"
                              : "border-danger bg-danger/10"),
                        )}
                      >
                        <input
                          type="radio"
                          name={`q${qIndex}`}
                          checked={chosen}
                          onChange={() =>
                            setAnswers((current) =>
                              current.map((value, i) => (i === qIndex ? oIndex : value)),
                            )
                          }
                          className="size-4 accent-accent"
                        />
                        <span className="flex-1" dangerouslySetInnerHTML={{ __html: html }} />
                        {chosen && outcome ? (
                          <span
                            className={cn(
                              "font-mono text-[0.625rem] tracking-[0.16em]",
                              outcome.right ? "text-success" : "text-danger",
                            )}
                          >
                            {outcome.right ? "RIGHT" : "YOUR ANSWER"}
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {reread ? (
                <Link
                  href={reread.href}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center gap-2 self-start text-sm text-accent hover:text-accent/80 sm:ml-10"
                >
                  Reread: {reread.title}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>

      {error ? <FormMessage>{error}</FormMessage> : null}

      {!result ? (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={submit}
            disabled={!ready || busy}
            className="inline-flex h-12 items-center bg-accent px-7 font-semibold text-accent-fg transition-colors hover:bg-accent/90 disabled:bg-line disabled:text-subtle"
          >
            {busy ? "Checking…" : "Submit answers"}
          </button>
          <span className="text-sm text-subtle">
            {ready
              ? "You can change an answer until you submit."
              : `Answer all ${questions.length} to submit.`}
          </span>
        </div>
      ) : result.passed ? (
        <section
          role="status"
          aria-label="Result"
          data-theme="dark"
          className="bg-black relative flex flex-col items-center gap-4 overflow-hidden border border-line-strong px-6 py-14 text-center"
        >
          <div aria-hidden="true" className="void-glow pointer-events-none absolute inset-0" />
          <p className="relative font-mono text-xs tracking-[0.3em] text-success">
            PASSED · {result.score} OF {result.outOf} · CHAPTER COMPLETE
          </p>
          {result.newSteps.length > 0 ? (
            <>
              <p className="relative font-mono text-xs tracking-[0.42em] text-accent">
                {result.newSteps.includes("rookie") ? "RANK EARNED" : "LEVEL COMPLETE"}
              </p>
              <p className="relative text-5xl font-light tracking-[0.24em] text-fg sm:text-6xl">
                ROOKIE
              </p>
            </>
          ) : (
            <p className="relative text-2xl font-light tracking-[0.12em] text-fg">Well done.</p>
          )}
          <div className="relative mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/academy"
              prefetch={false}
              className="inline-flex h-12 items-center bg-accent px-6 font-semibold text-accent-fg hover:bg-accent/90"
            >
              Back to the Academy
            </Link>
            {result.newSteps.length > 0 ? (
              <Link
                href={
                  result.newSteps.includes("rookie") && !claimed
                    ? "/settings#connections"
                    : "/academy/ranks"
                }
                prefetch={false}
                className="inline-flex h-12 items-center border border-line-strong px-6 text-fg hover:bg-raised"
              >
                {result.newSteps.includes("rookie") && !claimed
                  ? "Link Discord to claim it"
                  : "See your rank"}
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <section
          role="status"
          aria-label="Result"
          className="flex flex-col gap-5 border border-danger/50 bg-surface p-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-2">
            <p className="font-mono text-xs tracking-[0.22em] text-danger">
              {result.score} OF {result.outOf} CORRECT · NOT YET
            </p>
            <p className="text-base/7 text-muted">
              You need {result.pass} to pass. Each question you missed shows the lesson that covers
              it.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={retry}
              className="inline-flex h-12 items-center bg-accent px-6 font-semibold text-accent-fg hover:bg-accent/90"
            >
              Try again
            </button>
            <Link
              href={chapterHref}
              prefetch={false}
              className="inline-flex h-12 items-center border border-line-strong px-6 text-fg hover:bg-raised"
            >
              Back to the chapter
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
