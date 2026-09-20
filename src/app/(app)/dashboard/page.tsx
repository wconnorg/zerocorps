import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Unavailable } from "@/components/site/unavailable";
import { getSessionState } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false },
};

/**
 * A placeholder that proves the protected route works. Milestone 3 sends new members
 * through onboarding first, and milestone 4 builds the real dashboard here.
 */
export default async function DashboardPage() {
  const state = await getSessionState();
  if (state.status === "unavailable") return <Unavailable />;
  if (state.status === "signed-out") redirect("/sign-in?next=/dashboard");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-6 py-16">
      <p className="font-mono text-xs tracking-[0.22em] text-subtle">SIGNED IN</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">You&apos;re in</h1>
      <p className="mt-3 text-sm/6 text-muted">
        Signed in as <span className="text-fg">{state.user.email}</span>. Your email address is
        verified.
      </p>
      <p className="mt-3 text-sm/6 text-muted">
        This page is a placeholder. Choosing a username comes next, and the Academy follows.
      </p>
      <div className="mt-8">
        <SignOutButton />
      </div>
    </div>
  );
}
