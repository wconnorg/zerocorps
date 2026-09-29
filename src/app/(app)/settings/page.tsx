import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DiscordConnection } from "@/components/app/discord-connection";
import { ProfileForm } from "@/components/app/profile-form";
import { Unavailable } from "@/components/site/unavailable";
import { ButtonLink } from "@/components/ui/button";
import { db } from "@/db/client";
import { discordEnabled } from "@/lib/auth";
import { getSessionState } from "@/lib/auth/session";
import { nextUsernameChangeAt } from "@/lib/auth/username-claim";
import { getDiscordLink } from "@/lib/discord/links";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false },
};

/**
 * Settings: the profile (username and display name) and connections (Discord). Milestone 4
 * adds the rest (password, sessions, deleting the account).
 *
 * The date shown here is a courtesy. Whether a name may change is judged again when it is
 * saved, under a lock, whatever this page said.
 */
export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
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

  // Discord is a courtesy on this page: if it cannot be read, the rest still works.
  let linkedAs: string | null = null;
  let discordReadable = true;
  try {
    linkedAs = (await getDiscordLink(db, state.user.id))?.discordUsername ?? null;
  } catch {
    discordReadable = false;
  }
  const outcome = (await searchParams).discord;

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

      <section
        id="connections"
        aria-labelledby="connections-heading"
        className="mt-6 rounded-2xl border border-line bg-surface p-8"
      >
        <h2 id="connections-heading" className="mb-5 text-lg font-semibold tracking-tight">
          Connections
        </h2>
        <DiscordConnection
          available={discordEnabled && discordReadable}
          linkedAs={linkedAs}
          outcome={typeof outcome === "string" ? outcome : null}
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
