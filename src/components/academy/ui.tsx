import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The Academy's small building blocks, in the look the owner approved from the prototype:
 * black and red, thin lines, square corners, mono labels with wide spacing. Colours are
 * the site's semantic tokens only, so every piece works in both themes.
 */

export type LessonState = "done" | "current" | "todo" | "locked";

/** A lesson's or a chapter's state as an icon. The words beside it carry the meaning too. */
export function StatusIcon({ state, className }: { state: LessonState; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: cn("size-5 shrink-0", className),
  };
  if (state === "done") {
    return (
      <svg {...common} stroke="currentColor" className={cn(common.className, "text-success")}>
        <circle cx="12" cy="12" r="10" />
        <path d="M7.5 12.5l3 3 6-6.5" />
      </svg>
    );
  }
  if (state === "current") {
    return (
      <svg {...common} stroke="currentColor" className={cn(common.className, "text-accent")}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (state === "locked") {
    return (
      <svg {...common} stroke="currentColor" className={cn(common.className, "text-subtle")}>
        <rect x="5" y="11" width="14" height="9" rx="1.5" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    );
  }
  return (
    <svg {...common} stroke="currentColor" className={cn(common.className, "text-line-strong")}>
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

/** A row of segments, `filled` of them lit: the rank meter, and a checkpoint's progress. */
export function SegmentMeter({
  total,
  filled,
  className,
  segmentClassName,
}: {
  total: number;
  filled: number;
  className?: string;
  segmentClassName?: string;
}) {
  return (
    // No inline styles anywhere in the Academy, so a stricter CSP later costs nothing.
    <div aria-hidden="true" className={cn("flex gap-1.5", className)}>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn("h-1.5 flex-1", index < filled ? "bg-accent" : "bg-line", segmentClassName)}
        />
      ))}
    </div>
  );
}

/** The small red label above a heading. */
export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("font-mono text-xs tracking-[0.26em] text-accent uppercase", className)}>
      {children}
    </p>
  );
}

/** A small grey label, for "CURRENT RANK" and the like. */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "font-mono text-[0.6875rem] tracking-[0.22em] text-subtle uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** The thin red rule under a page title. */
export function Rule({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("h-px w-16 bg-accent", className)} />;
}

/** A thin progress bar. */
export function Bar({ value, tone = "accent" }: { value: number; tone?: "accent" | "success" }) {
  const width = Math.round(Math.max(0, Math.min(1, value)) * 100);
  // An SVG attribute, not a style, carries the width.
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 1"
      preserveAspectRatio="none"
      className="block h-0.5 w-full"
    >
      <rect width="100" height="1" className="fill-line" />
      <rect
        width={width}
        height="1"
        className={tone === "success" ? "fill-success" : "fill-accent"}
      />
    </svg>
  );
}

/** The arrow on a way forward: "Resume", "How ranks work". */
export function Arrow() {
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

export function ComingSoonTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "border border-line-strong px-2 py-1 font-mono text-[0.625rem] tracking-[0.2em] text-subtle",
        className,
      )}
    >
      COMING SOON
    </span>
  );
}

/**
 * When the lesson folder has a mistake in it. On the laptop the owner sees every problem
 * with its file, to fix in Obsidian; on the live site the list is empty and only the
 * calm message shows.
 */
export function AcademyProblems({ problems }: { problems: string[] }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-24">
      <Label>ACADEMY · TEMPORARILY UNAVAILABLE</Label>
      <h1 className="text-2xl font-semibold tracking-tight">
        The lessons can&apos;t be shown right now
      </h1>
      <p className="text-sm/6 text-muted">Nothing is lost. Please try again in a few minutes.</p>
      {problems.length > 0 ? (
        <div className="mt-4 border border-line-strong bg-surface p-5">
          <p className="font-mono text-xs tracking-[0.18em] text-warning">
            ONLY ON THE LAPTOP: WHAT TO FIX IN THE LESSON FOLDER
          </p>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm/6 text-fg">
            {problems.map((problem) => (
              <li key={problem} className="break-words">
                {problem}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
