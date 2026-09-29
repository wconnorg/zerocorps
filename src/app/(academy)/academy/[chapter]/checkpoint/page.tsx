import type { Route } from "next";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckpointForm } from "@/components/academy/checkpoint-form";
import { AcademyProblems, Kicker } from "@/components/academy/ui";
import { AppShell } from "@/components/app/app-shell";
import { Unavailable } from "@/components/site/unavailable";
import { isOpen } from "@/lib/academy/content";
import { chapterHref, lessonHref, loadAcademy, requireMember } from "@/lib/academy/load";
import { rankClaimed } from "@/lib/academy/member";
import { publicQuestions } from "@/lib/academy/views";

export const metadata: Metadata = { title: "Checkpoint", robots: { index: false } };

const two = (n: number) => String(n).padStart(2, "0");

/**
 * A chapter's checkpoint. The questions and options are rendered here; the right answers
 * never leave the server. It opens once every lesson in the chapter is complete.
 */
export default async function CheckpointPage({
  params,
}: PageProps<"/academy/[chapter]/checkpoint">) {
  const { chapter: chapterId } = await params;
  const member = await requireMember(`/academy/${chapterId}/checkpoint`);
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
  const { academy } = loaded;
  const entry = academy.standing.chapters.get(chapterId);
  if (!entry || !entry.hasCheckpoint || !entry.chapter.checkpoint) notFound();
  const { chapter } = entry;
  const checkpoint = chapter.checkpoint!;

  const rereadLinks: Record<string, { href: Route; title: string }> = {};
  for (const question of checkpoint.questions) {
    const lesson = question.reread ? academy.catalog.lessons.get(question.reread) : undefined;
    if (lesson && isOpen(academy.catalog, lesson)) {
      rereadLinks[lesson.id] = { href: lessonHref(lesson), title: lesson.title };
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12 lg:py-16">
        <header className="flex flex-col gap-4">
          <Kicker>Checkpoint · Chapter {two(chapter.number)}</Kicker>
          <h1 className="text-4xl leading-tight font-light tracking-[0.04em] sm:text-5xl">
            {chapter.title}
          </h1>
          {entry.checkpointPassed ? (
            <p className="text-sm text-success">
              You passed this checkpoint. Taking it again keeps your pass.
            </p>
          ) : null}
        </header>
        {entry.lessonsDone ? (
          <CheckpointForm
            claimed={rankClaimed(academy)}
            chapterId={chapter.id}
            pass={checkpoint.pass}
            chapterHref={chapterHref(chapter)}
            rereadLinks={rereadLinks}
            questions={publicQuestions(checkpoint)}
          />
        ) : (
          <div className="flex flex-col gap-4 border border-dashed border-line-strong p-6">
            <p className="text-base/7 text-muted">
              This checkpoint opens when every lesson in the chapter is complete.{" "}
              {entry.openLessons - entry.doneLessons} to go.
            </p>
            <Link
              href={chapterHref(chapter)}
              prefetch={false}
              className="self-start text-sm text-accent hover:text-accent/80"
            >
              Back to the chapter
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
