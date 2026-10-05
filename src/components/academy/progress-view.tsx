import Link from "next/link";
import { type MemberAcademy, rankClaimed } from "@/lib/academy/member";
import {
  BRONZE_KEY,
  BRONZE_LEVELS,
  levelStepKey,
  RANK_TITLE,
  rankKeyOf,
} from "@/lib/academy/standing";
import { cn } from "@/lib/cn";
import { Arrow, Bar, Kicker, Label, Rule, SegmentMeter } from "./ui";

/**
 * The Academy's Progress tab: the member's rank, what they have finished, and when they
 * studied. These three stood on the Academy's home until the owner moved them to a page
 * of their own (2026-10-05), and "Your record" became "Your progress".
 *
 * It draws what it is given and reads nothing itself, so it can be rendered in a test.
 */

/** A year of weeks: the page has the width for it. */
export const PROGRESS_WEEKS = 52;

export function ProgressView({
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
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 lg:py-16">
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="flex flex-col justify-between gap-10 lg:col-span-7">
            <header className="flex flex-col gap-5">
              <Kicker>ZeroCorps Academy</Kicker>
              <h1 className="text-4xl font-light tracking-[0.2em] uppercase sm:text-5xl">
                Progress
              </h1>
              <Rule />
              <p className="max-w-xl text-base/7 text-muted sm:text-lg/8">
                Your rank, what you have finished, and when you studied. Every lesson you complete
                and every checkpoint you pass counts here.
              </p>
            </header>
            <div className="flex flex-col border border-line bg-surface p-6 sm:p-8">
              <h2 className="mb-2 font-mono text-xs font-medium tracking-[0.22em]">
                YOUR PROGRESS
              </h2>
              <Stat
                label="Lessons completed"
                value={standing.lessonsDone}
                of={standing.lessonsOpen}
              />
              <Stat label="Checkpoints passed" value={standing.checkpointsPassed} />
              <Stat label="Active days, last 30" value={activeDays(activity, 30)} last />
            </div>
          </div>
          <RankCard academy={academy} levelsDone={levelsDone} />
        </section>

        <section className="flex flex-col gap-5 border border-line bg-surface p-6 sm:p-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-mono text-xs font-medium tracking-[0.22em]">ACTIVITY</h2>
            <span className="text-sm text-subtle">Past year</span>
          </div>
          <Heatmap activity={activity} weeks={PROGRESS_WEEKS} />
        </section>

        <p className="border-t border-line pt-6 text-sm text-subtle">
          Education only. Nothing in the Academy is financial advice.
        </p>
      </div>
    </div>
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
            Finish both levels, every chapter and its checkpoint, to earn it.
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

/** Columns of weeks, Monday at the top, ending with this week. Days are UTC days. */
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
        // Reversed, so a screen too narrow for every week starts at this week and scrolls back.
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
