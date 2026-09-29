import type { Metadata } from "next";
import { RanksView } from "@/components/academy/ranks-view";
import { AcademyProblems } from "@/components/academy/ui";
import { AppShell } from "@/components/app/app-shell";
import { Unavailable } from "@/components/site/unavailable";
import { loadAcademy, requireMember } from "@/lib/academy/load";

export const metadata: Metadata = { title: "Ranks", robots: { index: false } };

export default async function RanksPage() {
  const member = await requireMember("/academy/ranks");
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
  return (
    <AppShell>
      <RanksView academy={loaded.academy} />
    </AppShell>
  );
}
