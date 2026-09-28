import { type MemberAcademy } from "@/lib/academy/member";
import { LEVEL_NAMES, levelStepKey, RANK_TITLE, ROOKIE_LEVELS } from "@/lib/academy/standing";
import { cn } from "@/lib/cn";
import { Kicker, Label, Rule, SegmentMeter, StatusIcon } from "./ui";

/**
 * How ranks work, and where this member is. Today there is one stage, Rookie, made of
 * three steps: finishing Level 1, Level 2 and Level 3 (owner, 2026-09-28). What comes
 * after Rookie is not defined yet, and the page says so rather than inventing it.
 */

const two = (n: number) => String(n).padStart(2, "0");
const dateOf = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export function RanksView({ academy }: { academy: MemberAcademy }) {
  const done = ROOKIE_LEVELS.filter((level) => academy.steps.has(levelStepKey(level))).length;
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] hero-glow"
      />
      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 py-12 lg:grid-cols-12 lg:py-16">
        <div className="flex flex-col gap-10 lg:col-span-8">
          <header className="flex flex-col gap-5">
            <Kicker>ZeroCorps Academy</Kicker>
            <h1 className="text-4xl font-light tracking-[0.2em] uppercase sm:text-5xl">Ranks</h1>
            <Rule />
            <p className="max-w-xl text-base/7 text-muted sm:text-lg/8">
              You are a <strong className="font-semibold text-fg">{RANK_TITLE}</strong>. Every level
              you finish is a step, and a step is never taken away.
            </p>
          </header>

          <section
            aria-labelledby="rookie"
            className="flex flex-col border border-line-strong bg-surface"
          >
            <div className="flex flex-col gap-5 border-b border-line p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
              <div className="flex flex-col gap-3">
                <Label>Stage 1 · Levels 1 to 3</Label>
                <h2
                  id="rookie"
                  className="text-3xl leading-none font-light tracking-[0.22em] uppercase"
                >
                  {RANK_TITLE}
                </h2>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-56">
                <SegmentMeter total={3} filled={done} />
                <p className="text-right font-mono text-xs tracking-[0.16em] text-subtle">
                  {done} OF 3 LEVELS
                </p>
              </div>
            </div>
            <ol>
              {ROOKIE_LEVELS.map((number) => {
                const level = academy.standing.levels.find(
                  (candidate) => candidate.level === number,
                );
                const stepAt = academy.steps.get(levelStepKey(number));
                const earned = academy.steps.has(levelStepKey(number));
                const counted = level?.courses.filter((course) => !course.comingSoon) ?? [];
                const total = counted.reduce((sum, course) => sum + course.chapters.length, 0);
                return (
                  <li
                    key={number}
                    className="flex min-h-20 items-center gap-5 border-b border-line/60 px-6 py-5 last:border-b-0 sm:px-8"
                  >
                    <StatusIcon
                      state={earned ? "done" : level ? "todo" : "locked"}
                      className="size-6"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="font-mono text-[0.6875rem] tracking-[0.2em] text-subtle">
                        LEVEL {two(number)}
                      </span>
                      <span className={cn("text-lg font-medium", !level && "text-muted")}>
                        {level?.name ?? LEVEL_NAMES[number] ?? `Level ${number}`}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "text-right font-mono text-xs tracking-[0.14em]",
                        earned ? "text-success" : "text-subtle",
                      )}
                    >
                      {earned
                        ? stepAt
                          ? `COMPLETE · ${dateOf(stepAt).toUpperCase()}`
                          : "COMPLETE"
                        : level
                          ? `${level.chaptersComplete} OF ${total} CHAPTERS`
                          : "TO BE WRITTEN"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="flex flex-col gap-3 border border-dashed border-line-strong p-6 sm:p-8">
            <Label>Stage 2</Label>
            <p className="text-2xl font-light tracking-[0.2em] text-muted uppercase">Reserved</p>
            <p className="max-w-xl text-sm/6 text-muted">
              For verified trading records. It will be defined once there are records to verify.
            </p>
          </section>
        </div>

        <aside className="flex flex-col self-start border border-line-strong bg-surface lg:col-span-4 lg:mt-56">
          <h2 className="border-b border-line p-6 font-mono text-xs font-medium tracking-[0.22em]">
            HOW RANKS WORK
          </h2>
          {[
            [
              "Chapters make up a level",
              "A chapter is complete when its lessons are done and its checkpoint, if it has one, is passed.",
            ],
            [
              "Levels make you a Rookie",
              "Finish every chapter of a level for a step. The Platform is open from the start, so the order is yours.",
            ],
            [
              "Nothing is taken away",
              "New lessons can be added to a level you have finished. Your step stays.",
            ],
            ["On Discord", "Linking Discord gives you the Rookie role there. That is coming soon."],
          ].map(([title, text]) => (
            <div
              key={title}
              className="flex flex-col gap-2 border-b border-line p-6 last:border-b-0"
            >
              <p className="font-medium">{title}</p>
              <p className="text-sm/6 text-muted">{text}</p>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
