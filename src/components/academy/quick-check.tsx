"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * A quick check inside a lesson: one question, answered in the page, never graded and
 * never stored. The right answer is in the page on purpose; it is there to help, not to
 * test. (The chapter's checkpoint is the test, and it is graded on the server.)
 *
 * The question, options and explanation arrive as HTML the server rendered from the
 * owner's Markdown with raw HTML switched off (`markdown.ts`).
 */
export function QuickCheck({
  questionHtml,
  optionsHtml,
  correct,
  explanationHtml,
}: {
  questionHtml: string;
  optionsHtml: string[];
  correct: number;
  explanationHtml: string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const id = useId();
  const right = picked === correct;

  return (
    <section
      aria-labelledby={`${id}-q`}
      className="not-prose my-10 flex flex-col gap-5 border border-line-strong bg-surface p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-xs tracking-[0.22em] text-accent">QUICK CHECK</p>
        <p className="font-mono text-[0.6875rem] tracking-[0.16em] text-subtle">NOT GRADED</p>
      </div>
      <p id={`${id}-q`} className="text-lg/7" dangerouslySetInnerHTML={{ __html: questionHtml }} />
      <div className="grid gap-3 sm:grid-cols-2">
        {optionsHtml.map((html, index) => {
          const chosen = picked === index;
          return (
            <button
              key={index}
              type="button"
              aria-pressed={chosen}
              onClick={() => setPicked(index)}
              className={cn(
                "min-h-12 border px-4 py-3 text-left text-base transition-colors",
                !chosen && "border-line-strong bg-bg hover:border-muted",
                chosen && right && "border-success bg-success/10",
                chosen && !right && "border-danger bg-danger/10",
              )}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        })}
      </div>
      {picked !== null ? (
        <div role="status" className={cn("text-sm/6", right ? "text-success" : "text-danger")}>
          <p className="font-medium">{right ? "Right." : "Not quite. Have another look."}</p>
          {right && explanationHtml ? (
            <div
              className="mt-1 text-muted"
              dangerouslySetInnerHTML={{ __html: explanationHtml }}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
