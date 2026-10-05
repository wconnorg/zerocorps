/**
 * The Academy's ranks and levels by name and key (owner, 2026-10-05). Constants only and
 * no imports, so the browser's pieces (a lesson's "complete" button, a checkpoint) can use
 * them too; the rules that award them are in `standing.ts`.
 */

export const LEVEL_NAMES: Readonly<Record<number, string>> = {
  1: "Fundamentals",
  2: "Order Flow Software",
};

/** The levels Bronze needs, all of them finished. */
export const BRONZE_LEVELS = [1, 2] as const;

export const RANK_TITLE = "Bronze";

/** The key stored in `rank_history` for the Bronze rank itself. */
export const BRONZE_KEY = "bronze";

/** The key stored in `rank_history` when a level is finished. */
export const levelStepKey = (level: number) => `level-${level}`;

const LEVEL_STEP = /^level-(\d+)$/;

/** The level a step stands for, or null for a step that is not a level. */
export const levelOfStep = (step: string): number | null => {
  const level = LEVEL_STEP.exec(step)?.[1];
  return level === undefined ? null : Number(level);
};

export const levelName = (level: number) => LEVEL_NAMES[level] ?? `Level ${level}`;

/**
 * What a moment of progress celebrates: the rank, or else the level just finished. Null
 * when the new steps hold neither.
 */
export function celebrated(
  newSteps: readonly string[],
): { kind: "rank" | "level"; title: string } | null {
  if (newSteps.includes(BRONZE_KEY)) return { kind: "rank", title: RANK_TITLE };
  const level = newSteps.map(levelOfStep).find((value) => value !== null);
  return level === undefined || level === null ? null : { kind: "level", title: levelName(level) };
}
