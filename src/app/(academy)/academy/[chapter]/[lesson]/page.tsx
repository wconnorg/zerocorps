import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonView } from "@/components/academy/lesson-view";
import { AcademyProblems } from "@/components/academy/ui";
import { AppShell } from "@/components/app/app-shell";
import { Unavailable } from "@/components/site/unavailable";
import { isOpen } from "@/lib/academy/content";
import { loadAcademy, requireMember } from "@/lib/academy/load";

export const metadata: Metadata = { title: "Lesson", robots: { index: false } };

/**
 * One lesson. A lesson that does not exist, is still a draft, sits in a course that is
 * coming soon, or is asked for under the wrong chapter is "not found": one answer for all.
 */
export default async function LessonPage({ params }: PageProps<"/academy/[chapter]/[lesson]">) {
  const { chapter: chapterId, lesson: lessonId } = await params;
  const member = await requireMember(`/academy/${chapterId}/${lessonId}`);
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
  const lesson = loaded.academy.catalog.lessons.get(lessonId);
  if (!lesson || lesson.chapterId !== chapterId || !isOpen(loaded.academy.catalog, lesson))
    notFound();
  return (
    <AppShell>
      <LessonView academy={loaded.academy} lesson={lesson} />
    </AppShell>
  );
}
