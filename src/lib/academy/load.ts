import type { Route } from "next";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { discordEnabled } from "@/lib/auth";
import { getSessionState } from "@/lib/auth/session";
import { getDiscordLink } from "@/lib/discord/links";
import { readCatalog } from "./catalog";
import type { MemberAcademy } from "./member";
import { activityByDay, readProgress } from "./progress";
import { standing } from "./standing";

export { chapterHref, checkpointHref, lessonHref, type MemberAcademy } from "./member";

/**
 * What an Academy page needs, loaded in one place. Server-only.
 *
 * Every Academy page below `/academy` is for signed-in members with a username, and each
 * page checks that for itself (a layout is not re-rendered on every navigation). A page
 * gets back one of three things: the member's Academy, a broken lesson folder (with the
 * problems, on the laptop only), or "unavailable" when the database cannot be reached.
 */

export type AcademyLoad =
  | { status: "ready"; academy: MemberAcademy }
  | { status: "broken"; problems: string[] }
  | { status: "unavailable" };

/** Sends anyone who is not a member with a username to where they belong. */
export async function requireMember(here: string) {
  const state = await getSessionState();
  if (state.status === "signed-out") {
    redirect(`/sign-in?next=${encodeURIComponent(here)}` as Route);
  }
  if (state.status === "unavailable") return null;
  if (!state.user.username) redirect("/onboarding");
  return { id: state.user.id, username: state.user.username };
}

export async function loadAcademy(member: { id: string; username: string }): Promise<AcademyLoad> {
  const content = readCatalog();
  if (content.status === "broken") return { status: "broken", problems: content.problems };
  try {
    const [progress, link] = await Promise.all([
      readProgress(db, member.id),
      getDiscordLink(db, member.id),
    ]);
    const current = standing(content.catalog, progress.completed, progress.passed);
    const steps = new Map<string, Date | null>(progress.steps);
    for (const step of current.earnedSteps) if (!steps.has(step)) steps.set(step, null);
    return {
      status: "ready",
      academy: {
        userId: member.id,
        username: member.username,
        catalog: content.catalog,
        standing: current,
        completed: progress.completed,
        passed: progress.passed,
        steps,
        discord: { linked: link !== null, available: discordEnabled },
      },
    };
  } catch (error) {
    console.error(
      `[academy] progress could not be read: ${error instanceof Error ? error.name : "error"}`,
    );
    return { status: "unavailable" };
  }
}

/** The last 26 weeks of lessons completed, for the heatmap. Empty if it cannot be read. */
export async function loadActivity(userId: string, weeks = 26): Promise<Map<string, number>> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - weeks * 7);
  try {
    return await activityByDay(db, userId, since);
  } catch {
    return new Map();
  }
}
