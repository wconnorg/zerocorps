import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardView } from "@/components/app/dashboard-view";
import { Unavailable } from "@/components/site/unavailable";
import { getSessionState } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false },
};

/**
 * The dashboard shell: the first slice after the milestone 2 release. The session is
 * checked here, on every request, and the view below only draws what it is given.
 * Milestone 3 will send a member who has no username yet through onboarding first.
 */
export default async function DashboardPage() {
  const state = await getSessionState();
  if (state.status === "unavailable") return <Unavailable />;
  if (state.status === "signed-out") redirect("/sign-in?next=/dashboard");

  return <DashboardView email={state.user.email} />;
}
