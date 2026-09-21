import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/app/profile-form";
import { Unavailable } from "@/components/site/unavailable";
import { ButtonLink } from "@/components/ui/button";
import { db } from "@/db/client";
import { getSessionState } from "@/lib/auth/session";
import { nextUsernameChangeAt } from "@/lib/auth/username-claim";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false },
};

/**
 * Settings, for now only the profile: the username and the display name. Milestone 4 adds
 * the rest (password, sessions, and later the phone and Discord).
 *
 * The date shown here is a courtesy. Whether a name may change is judged again when it is
 * saved, under a lock, whatever this page said.
 */
export default async function SettingsPage() {
  const state = await getSessionState();
  if (state.status === "unavailable") return <Unavailable />;
  if (state.status === "signed-out") redirect("/sign-in?next=/settings");
  if (!state.user.username) redirect("/onboarding");

  let changeAvailableAt: Date | null;
  try {
    changeAvailableAt = await nextUsernameChangeAt(db, state.user.id, new Date());
  } catch {
    return <Unavailable />;
  }

  return (
    <div className="relative mx-auto w-full max-w-xl px-6 py-12 lg:py-16">
      <h1 className="text-3xl font-light tracking-[0.22em] uppercase">Settings</h1>
      <div aria-hidden="true" className="mt-5 h-px w-16 bg-accent" />

      <section
        aria-labelledby="profile-heading"
        className="mt-10 rounded-2xl border border-line bg-surface p-8"
      >
        <h2 id="profile-heading" className="text-lg font-semibold tracking-tight">
          Profile
        </h2>
        <p className="mt-1 font-mono text-xs tracking-[0.12em] text-subtle">
          Signed in as <span className="text-muted">@{state.user.username}</span>
        </p>
        <ProfileForm
          mode="settings"
          initialUsername={state.user.username}
          initialDisplayName={state.user.displayName}
          changeAvailableOn={changeAvailableAt?.toISOString().slice(0, 10) ?? null}
        />
      </section>

      <div className="mt-8">
        <ButtonLink href="/dashboard" variant="secondary">
          Back to the dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
