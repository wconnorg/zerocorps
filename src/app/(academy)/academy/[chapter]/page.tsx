import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChapterView } from "@/components/academy/chapter-view";
import { AcademyProblems } from "@/components/academy/ui";
import { AppShell } from "@/components/app/app-shell";
import { Unavailable } from "@/components/site/unavailable";
import { loadAcademy, requireMember } from "@/lib/academy/load";

export const metadata: Metadata = { title: "Academy", robots: { index: false } };

export default async function ChapterPage({ params }: PageProps<"/academy/[chapter]">) {
  const { chapter: chapterId } = await params;
  const member = await requireMember(`/academy/${chapterId}`);
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
  if (!loaded.academy.catalog.chapters.has(chapterId)) notFound();
  return (
    <AppShell>
      <ChapterView academy={loaded.academy} chapterId={chapterId} />
    </AppShell>
  );
}
