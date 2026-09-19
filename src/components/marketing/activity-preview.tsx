/**
 * Illustration of the activity calendar that arrives with the academy milestone.
 *
 * This is decoration, not data, so it is hidden from assistive technology. It
 * does establish the visual contract the real calendar will reuse: one hue, five
 * steps from the `--heat-*` tokens, an "empty" cell that is neutral rather than
 * tinted, and a Less/More legend.
 */

import { cn } from "@/lib/cn";

// These two must match the `sm:grid-cols-26` and `grid-cols-18` classes below.
const WEEKS = 26;
const MOBILE_WEEKS = 18;
const DAYS = 7;

const HEAT_CLASSES = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"] as const;

/** Small seeded generator so the pattern is identical on every build and render. */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function buildWeeks(): number[][] {
  const random = createRandom(20260919);
  return Array.from({ length: WEEKS }, (_, week) =>
    Array.from({ length: DAYS }, (_, day) => {
      const isWeekend = day === 0 || day === 6;
      // Consistency builds: later weeks are busier than earlier ones.
      const momentum = 0.35 + (week / WEEKS) * 0.5;
      const score = random() * momentum * (isWeekend ? 0.55 : 1);
      if (score < 0.12) return 0;
      if (score < 0.28) return 1;
      if (score < 0.45) return 2;
      if (score < 0.62) return 3;
      return 4;
    }),
  );
}

const WEEK_LEVELS = buildWeeks();

export function ActivityPreview() {
  return (
    <div
      aria-hidden="true"
      className="min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <div className="mb-5 flex items-center justify-between font-mono text-[11px] tracking-[0.18em] text-subtle">
        <span>ACTIVITY</span>
        <span>PREVIEW</span>
      </div>

      {/*
        One fluid grid: columns are weeks, rows are days, and cells are square
        fractions of the card's width, so it fills the card and cannot overflow.
        Small screens show the most recent weeks only, to keep cells legible.
      */}
      <div className="grid grid-flow-col grid-cols-18 grid-rows-7 gap-1 sm:grid-cols-26">
        {WEEK_LEVELS.flatMap((week, weekIndex) =>
          week.map((level, dayIndex) => (
            <span
              key={`${weekIndex}-${dayIndex}`}
              className={cn(
                "aspect-square rounded-[2px] sm:rounded-[3px]",
                HEAT_CLASSES[level] ?? HEAT_CLASSES[0],
                weekIndex < WEEKS - MOBILE_WEEKS && "hidden sm:block",
              )}
            />
          )),
        )}
      </div>

      <div className="mt-4 flex items-center justify-end gap-1.5 text-[11px] text-subtle">
        <span>Less</span>
        {HEAT_CLASSES.map((heatClass) => (
          <span key={heatClass} className={`size-3 rounded-[3px] ${heatClass}`} />
        ))}
        <span>More</span>
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">Progress to next rank</span>
          <span className="font-mono text-fg">68%</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-heat-0">
          <div className="h-full w-[68%] rounded-full bg-accent" />
        </div>
      </div>
    </div>
  );
}
