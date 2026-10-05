import type { Metadata } from "next";
import { AcademyTabs } from "@/components/academy/academy-tabs";
import { PROGRESS_WEEKS, ProgressView } from "@/components/academy/progress-view";
import { AcademyProblems } from "@/components/academy/ui";
import { AppShell } from "@/components/app/app-shell";
import { Unavailable } from "@/components/site/unavailable";
import { loadAcademy, loadActivity, requireMember } from "@/lib/academy/load";

export const metadata: Metadata = { title: "Progress", robots: { index: false } };

/** The Academy's Progress tab (owner, 2026-10-05): the rank, progress and activity. */
export default async function ProgressPage() {
  const member = await requireMember("/academy/progress");
  if (!member) {
    return (
      <AppShell>
        <Unavailable />
      </AppShell>
    );
  }
  const loaded = await loadAcademy(member);
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
  const activity = await loadActivity(member.id, PROGRESS_WEEKS);
  return (
    <AppShell>
      <AcademyTabs current="progress" />
      <ProgressView academy={loaded.academy} activity={activity} />
    </AppShell>
  );
}
