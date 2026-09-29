import type { Route } from "next";
import type { Catalog, Chapter, Lesson } from "./content";
import type { Standing } from "./standing";

/**
 * What an Academy page draws from, and the addresses of its pages. Kept apart from
 * `load.ts`, which reads the database, so the components can be rendered in tests without
 * it.
 */

export type MemberAcademy = {
  userId: string;
  username: string;
  catalog: Catalog;
  standing: Standing;
  completed: ReadonlySet<string>;
  passed: ReadonlySet<string>;
  /** Every step earned, with when it was stored (null: earned, not yet stored). */
  steps: ReadonlyMap<string, Date | null>;
  /**
   * A rank is earned in the Academy and CLAIMED by linking Discord (owner, 2026-09-29):
   * until then the page says "link Discord to claim it". `available` is false while the
   * site's Discord application is not set up.
   */
  discord: { linked: boolean; available: boolean };
};

/** The member's rank shows as theirs only once claimed: earned AND Discord linked. */
export const rankClaimed = (academy: Pick<MemberAcademy, "discord">) => academy.discord.linked;

export const chapterHref = (chapter: Chapter) => `/academy/${chapter.id}` as Route;
export const lessonHref = (lesson: Lesson) => `/academy/${lesson.chapterId}/${lesson.id}` as Route;
export const checkpointHref = (chapter: Chapter) => `/academy/${chapter.id}/checkpoint` as Route;
