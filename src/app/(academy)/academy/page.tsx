import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AcademyHome } from "@/components/academy/academy-home";
import { AcademyTabs } from "@/components/academy/academy-tabs";
import { AcademyProblems } from "@/components/academy/ui";
import { AppShell } from "@/components/app/app-shell";
import { Unavailable } from "@/components/site/unavailable";
import { site } from "@/config/site";
import { loadAcademy } from "@/lib/academy/load";
import { getSessionState } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Academy",
  description: `${site.academy}: free trading education, from your first order to a tested process.`,
  robots: { index: false },
};

/**
 * The Academy's home, for members. Anyone else goes to sign in and comes back here
 * (owner, 2026-09-29: "open for all users", with every /academy address leading in). The
 * sign-in page offers "Create an account", and the sign-up page itself says whether
 * sign-ups are open or invite-only, from `SIGNUP_MODE`, so no wording here can drift from
 * it.
 */
export default async function AcademyPage() {
  const state = await getSessionState();
  if (state.status === "signed-out") redirect("/sign-in?next=/academy");
  if (state.status === "unavailable") {
    return (
      <AppShell>
        <Unavailable />
      </AppShell>
    );
  }
  if (!state.user.username) redirect("/onboarding");

  const loaded = await loadAcademy({ id: state.user.id, username: state.user.username });
  if (loaded.status !== "ready") {
    return (
      <AppShell>
        {loaded.status === "broken" ? (
          <AcademyProblems problems={loaded.problems} />
        ) : (
          <Unavailable />
        )}
      </AppShell>
    );
  }
  return (
    <AppShell>
      <AcademyTabs current="learn" />
      <AcademyHome academy={loaded.academy} />
    </AppShell>
  );
}
