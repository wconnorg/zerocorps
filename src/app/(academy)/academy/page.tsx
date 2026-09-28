import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AcademyComingSoon } from "@/components/academy/academy-coming-soon";
import { AcademyHome } from "@/components/academy/academy-home";
import { AcademyProblems } from "@/components/academy/ui";
import { AppShell } from "@/components/app/app-shell";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { Unavailable } from "@/components/site/unavailable";
import { site } from "@/config/site";
import { loadAcademy, loadActivity } from "@/lib/academy/load";
import { getSessionState } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Academy",
  description: `${site.academy}: free trading education, from your first order to a tested process.`,
  openGraph: { title: site.academy, url: "/academy" },
};

/**
 * `/academy` serves two audiences (DECISIONS.md, "Pages"): a visitor sees the public page,
 * a member sees the Academy. The session is read here, on every request.
 */
export default async function AcademyPage() {
  const state = await getSessionState();

  if (state.status === "signed-out") {
    return (
      <>
        <Header />
        <main id="main" className="flex-1">
          <AcademyComingSoon />
        </main>
        <Footer />
      </>
    );
  }
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
  const activity = await loadActivity(state.user.id);
  return (
    <AppShell>
      <AcademyHome academy={loaded.academy} activity={activity} />
    </AppShell>
  );
}
