"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormMessage } from "@/components/ui/field";
import { celebrated } from "@/lib/academy/ranks";
import { authFetch } from "@/lib/auth/auth-fetch";

/**
 * The end of a lesson: "Mark complete", then the way on. Completing is saved on the
 * server for the member in the session; this only asks, and shows what the server says.
 */
export function LessonActions({
  lessonId,
  done: initiallyDone,
  next,
  previous,
  claimed,
}: {
  lessonId: string;
  done: boolean;
  /** Where the button leads once the lesson is done, and a line saying so before. */
  next: { href: Route; label: string; hint: string };
  previous: { href: Route; label: string } | null;
  /** Whether a newly earned rank shows as the member's: only once Discord is linked. */
  claimed: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(initiallyDone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [earned, setEarned] = useState<ReturnType<typeof celebrated>>(null);

  async function complete() {
    setBusy(true);
    setError(null);
    const result = await authFetch<{ ok: true; newSteps: string[] }>("/academy/complete", {
      lessonId,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDone(true);
    const steps = result.data.newSteps;
    setEarned(celebrated(steps));
    // The rail, the chapter and the Academy's home read progress on the server.
    router.refresh();
  }

  return (
    <div className="mt-12 flex flex-col gap-6 border-t border-line pt-8">
      {earned ? (
        <div
          role="status"
          className="bg-black relative overflow-hidden border border-line-strong p-8 text-center"
          data-theme="dark"
        >
          <div aria-hidden="true" className="void-glow pointer-events-none absolute inset-0" />
          <p className="relative font-mono text-xs tracking-[0.42em] text-accent">
            {earned.kind === "rank" ? "RANK EARNED" : "LEVEL COMPLETE"}
          </p>
          <p className="relative mt-3 text-3xl font-light tracking-[0.24em] text-fg uppercase">
            {earned.title}
          </p>
          <Link
            href={earned.kind === "rank" && !claimed ? "/settings#connections" : "/academy/ranks"}
            prefetch={false}
            className="relative mt-4 inline-block text-sm text-accent hover:text-accent/80"
          >
            {earned.kind === "rank" && !claimed ? "Link Discord to claim it" : "See your rank"}
          </Link>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        {done ? (
          <>
            <span className="inline-flex h-12 items-center gap-2.5 border border-success/50 px-5 font-medium text-success">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="size-4"
              >
                <path d="M5 12.5l4.2 4.2L19 7" />
              </svg>
              Completed
            </span>
            <Link
              href={next.href}
              prefetch={false}
              className="inline-flex h-12 items-center gap-2.5 bg-accent px-6 font-semibold text-accent-fg transition-colors hover:bg-accent/90"
            >
              {next.label}
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
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={complete}
              disabled={busy}
              className="inline-flex h-12 items-center bg-accent px-6 font-semibold text-accent-fg transition-colors hover:bg-accent/90 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Mark complete"}
            </button>
            <span className="text-sm text-subtle">{next.hint}</span>
          </>
        )}
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}
      {previous ? (
        <Link
          href={previous.href}
          prefetch={false}
          className="inline-flex min-h-11 items-center gap-2 self-start text-sm text-muted hover:text-fg"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="size-4"
          >
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          Previous: {previous.label}
        </Link>
      ) : null}
    </div>
  );
}
