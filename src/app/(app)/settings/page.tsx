import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AvatarForm } from "@/components/app/avatar-form";
import { DeleteAccount } from "@/components/app/delete-account";
import { DevicesList } from "@/components/app/devices-list";
import { DiscordConnection } from "@/components/app/discord-connection";
import { PasswordForm } from "@/components/app/password-form";
import { ProfileForm } from "@/components/app/profile-form";
import { Unavailable } from "@/components/site/unavailable";
import { db } from "@/db/client";
import { discordEnabled } from "@/lib/auth";
import { ACTIVITY_WORDS, listDevices, recentActivity } from "@/lib/auth/account-data";
import { getSessionState } from "@/lib/auth/session";
import { nextUsernameChangeAt } from "@/lib/auth/username-claim";
import { getDiscordLink } from "@/lib/discord/links";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false },
};

const SECTIONS = [
  ["profile", "Profile"],
  ["connections", "Connections"],
  ["password", "Password"],
  ["devices", "Devices"],
  ["activity", "Security activity"],
  ["two-factor", "Two-factor"],
  ["delete", "Delete account"],
] as const;

const DAY = 24 * 60 * 60 * 1000;

/** "just now", "3 hours ago", "yesterday", "12 Sep 2026". Server time, UTC dates. */
function when(date: Date, now: Date): string {
  const ms = now.getTime() - date.getTime();
  if (ms < 2 * 60 * 1000) return "just now";
  if (ms < 60 * 60 * 1000) return `${Math.round(ms / 60000)} minutes ago`;
  if (ms < DAY) return `${Math.round(ms / 3600000)} hours ago`;
  if (ms < 2 * DAY) return "yesterday";
  if (ms < 7 * DAY) return `${Math.floor(ms / DAY)} days ago`;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Settings (milestone 4): the profile, connections, the password, the devices signed in,
 * recent security activity, and deleting the account. Every check that matters happens
 * on the server when a form is sent, whatever this page shows.
 */
export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const state = await getSessionState();
  if (state.status === "unavailable") return <Unavailable />;
  if (state.status === "signed-out") redirect("/sign-in?next=/settings");
  if (!state.user.username) redirect("/onboarding");

  const now = new Date();
  let changeAvailableAt: Date | null;
  let devices: Awaited<ReturnType<typeof listDevices>>;
  let activity: Awaited<ReturnType<typeof recentActivity>>;
  try {
    [changeAvailableAt, devices, activity] = await Promise.all([
      nextUsernameChangeAt(db, state.user.id, now),
      listDevices(db, state.user.id, state.sessionId, now),
      recentActivity(db, state.user.id),
    ]);
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
    <div className="relative mx-auto grid w-full max-w-5xl gap-10 px-6 py-12 lg:grid-cols-[13rem_minmax(0,1fr)] lg:py-16">
      <div className="flex flex-col gap-6 lg:sticky lg:top-8 lg:self-start">
        <div>
          <h1 className="text-3xl font-light tracking-[0.22em] uppercase">Settings</h1>
          <div aria-hidden="true" className="mt-5 h-px w-16 bg-accent" />
          <p className="mt-5 font-mono text-xs tracking-[0.12em] text-subtle">
            @{state.user.username}
          </p>
        </div>
        <nav aria-label="Settings sections">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm lg:flex-col lg:gap-0">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="inline-flex min-h-9 items-center text-muted transition-colors hover:text-fg"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="flex flex-col gap-6">
        <Section id="profile" title="Profile">
          <div className="flex flex-col gap-8">
            <AvatarForm version={state.user.avatar} />
            <ProfileForm
              mode="settings"
              initialUsername={state.user.username}
              initialDisplayName={state.user.displayName}
              changeAvailableOn={changeAvailableAt?.toISOString().slice(0, 10) ?? null}
            />
          </div>
        </Section>

        <Section id="connections" title="Connections">
          <DiscordConnection
            available={discordEnabled && discordReadable}
            linkedAs={linkedAs}
            outcome={typeof outcome === "string" ? outcome : null}
          />
        </Section>

        <Section
          id="password"
          title="Password"
          intro="Changing it signs out every other device, and we email you that it changed."
        >
          <PasswordForm />
        </Section>

        <Section id="devices" title="Devices" intro="Where your account is signed in right now.">
          <DevicesList
            devices={devices.map((device) => ({
              id: device.id,
              device: device.device,
              network: device.network,
              signedIn: when(device.signedInAt, now),
              lastActive: when(device.lastActiveAt, now),
              current: device.current,
            }))}
          />
        </Section>

        <Section
          id="activity"
          title="Security activity"
          intro="Your account's recent sign-ins and changes. If one was not you, change your password."
        >
          {activity.filter((entry) => ACTIVITY_WORDS[entry.type]).length === 0 ? (
            <p className="text-sm text-muted">Nothing yet.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-line rounded-xl border border-line">
              {activity
                .filter((entry) => ACTIVITY_WORDS[entry.type])
                .map((entry, index) => (
                  <li
                    key={index}
                    className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
                  >
                    <span className="text-sm font-medium">{ACTIVITY_WORDS[entry.type]}</span>
                    <span className="text-xs text-muted">
                      {when(entry.at, now)}
                      {entry.device ? ` · ${entry.device}` : ""}
                      {entry.network ? ` · ${entry.network}` : ""}
                    </span>
                  </li>
                ))}
            </ol>
          )}
        </Section>

        <Section id="two-factor" title="Two-factor authentication">
          <p className="text-sm/6 text-muted">
            Coming soon: a code from an authenticator app, on top of your password.
          </p>
        </Section>

        <Section id="delete" title="Delete account" danger>
          <DeleteAccount />
        </Section>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  intro,
  danger,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={
        danger
          ? "scroll-mt-8 rounded-2xl border border-danger/40 bg-surface p-6 sm:p-8"
          : "scroll-mt-8 rounded-2xl border border-line bg-surface p-6 sm:p-8"
      }
    >
      <h2
        id={`${id}-heading`}
        className={
          danger
            ? "text-lg font-semibold tracking-tight text-danger"
            : "text-lg font-semibold tracking-tight"
        }
      >
        {title}
      </h2>
      {intro ? <p className="mt-1 text-sm/6 text-muted">{intro}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}
