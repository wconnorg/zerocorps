import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardView } from "@/components/app/dashboard-view";
import { Unavailable } from "@/components/site/unavailable";
import { db } from "@/db/client";
import { discordEnabled } from "@/lib/auth";
import { getSessionState } from "@/lib/auth/session";
import { getDiscordLink } from "@/lib/discord/links";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false },
};

/**
 * The dashboard shell: the first slice after the milestone 2 release. The session is
 * checked here, on every request, and the view below only draws what it is given.
 * A member who has no username yet goes through `/onboarding` first.
 */
export default async function DashboardPage() {
  const state = await getSessionState();
  if (state.status === "unavailable") return <Unavailable />;
  if (state.status === "signed-out") redirect("/sign-in?next=/dashboard");
  if (!state.user.username) redirect("/onboarding");

  // The "link Discord" card, while linking is on and this member has not linked. A
  // courtesy: if it cannot be read, the dashboard shows without it.
  let linkDiscord = false;
  if (discordEnabled) {
    try {
      linkDiscord = (await getDiscordLink(db, state.user.id)) === null;
    } catch {
      linkDiscord = false;
    }
  }

  return <DashboardView signedInAs={`@${state.user.username}`} linkDiscord={linkDiscord} />;
}
