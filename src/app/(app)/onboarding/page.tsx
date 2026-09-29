import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/app/profile-form";
import { Unavailable } from "@/components/site/unavailable";
import { getSessionState } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Choose your username",
  robots: { index: false },
};

/**
 * The one step between a verified sign-up and the dashboard: a username, and a display
 * name if the member wants one. The dashboard sends everybody without a username here,
 * and this page sends everybody who has one back, so it cannot be used to skip the wait
 * between name changes: that is judged on the server however the request arrives.
 */
export default async function OnboardingPage() {
  const state = await getSessionState();
  if (state.status === "unavailable") return <Unavailable />;
  if (state.status === "signed-out") redirect("/sign-in?next=/onboarding");
  if (state.user.username) redirect("/dashboard");

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Choose your username</h1>
        <p className="mt-2 text-sm/6 text-muted">
          One last step. Your username is how you appear on ZeroCorps. You can change it later in
          settings.
        </p>
        <ProfileForm mode="onboarding" initialDisplayName={state.user.displayName} />
      </div>
    </div>
  );
}
