"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { authFetch } from "@/lib/auth/auth-fetch";

/**
 * The Discord line in settings: "Link Discord", or the linked Discord username with
 * "Unlink". Linking is an ordinary link to the server, which sends the browser to Discord
 * and back; unlinking asks the server and then shows what it says.
 */

/** What each `?discord=` word the server sends back means, in a sentence. */
export const DISCORD_OUTCOMES: Record<
  string,
  { tone: "success" | "error" | "info"; text: string }
> = {
  linked: {
    tone: "success",
    text: "Discord linked. Your Bronze role is on its way in the ZeroCorps server.",
  },
  "linked-no-rank": {
    tone: "success",
    text: "Discord linked. Finish Fundamentals and Order Flow Software in the Academy to earn Bronze, and the role follows in the ZeroCorps server.",
  },
  "linked-join": {
    tone: "info",
    text: "Discord linked. Join the ZeroCorps server and your rank role follows.",
  },
  unlinked: { tone: "success", text: "Discord unlinked, and your rank role was removed." },
  taken: {
    tone: "error",
    text: "That Discord account is already linked to another ZeroCorps account.",
  },
  cancelled: { tone: "info", text: "Linking was cancelled on Discord. Nothing changed." },
  expired: {
    tone: "error",
    text: "That link had expired or did not start here. Please try again.",
  },
  failed: {
    tone: "error",
    text: "Discord did not answer as expected. Nothing changed. Please try again.",
  },
  unavailable: { tone: "info", text: "Discord linking is not switched on yet." },
  "too-many": { tone: "error", text: "Too many attempts. Please wait a while and try again." },
};

export function DiscordConnection({
  available,
  linkedAs,
  outcome,
}: {
  /** Whether the site has a Discord application set up. */
  available: boolean;
  linkedAs: string | null;
  outcome: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const message = outcome ? DISCORD_OUTCOMES[outcome] : undefined;

  async function unlink() {
    setBusy(true);
    setError(null);
    const result = await authFetch("/discord/unlink");
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace("/settings?discord=unlinked");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-6 text-muted"
            fill="currentColor"
          >
            <path d="M19.6 5.6A16.4 16.4 0 0 0 15.5 4.3l-.5 1A15.2 15.2 0 0 0 9 5.3l-.5-1a16.4 16.4 0 0 0-4.1 1.3C1.8 9.5 1.1 13.3 1.4 17a16.6 16.6 0 0 0 5 2.5l1.1-1.7a10.7 10.7 0 0 1-1.7-.8l.4-.3a11.8 11.8 0 0 0 11.6 0l.4.3a10.7 10.7 0 0 1-1.7.8l1.1 1.7a16.5 16.5 0 0 0 5-2.5c.4-4.3-.7-8.1-2.9-11.4ZM8.5 14.7c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
          </svg>
          <div className="flex flex-col">
            <span className="font-medium">Discord</span>
            <span className="text-sm text-muted">
              {linkedAs ? (
                <>
                  Linked as <span className="text-fg">{linkedAs}</span>
                </>
              ) : available ? (
                "Link your Discord account and your Academy rank follows you to the ZeroCorps server as a role."
              ) : (
                "Coming soon."
              )}
            </span>
          </div>
        </div>
        {linkedAs ? (
          <Button variant="secondary" onClick={unlink} disabled={busy}>
            {busy ? "Unlinking…" : "Unlink"}
          </Button>
        ) : available ? (
          // A plain link on purpose: this is a full navigation to the server, which answers
          // with a redirect to Discord. next/link would try a client-side page load instead.
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- see above
          <a
            href="/api/auth/discord/link"
            className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent/90"
          >
            Link Discord
          </a>
        ) : null}
      </div>
      <p className="text-xs/5 text-subtle">
        We keep only your Discord id and username, never your email or any access token. Discord is
        never a way to sign in.
      </p>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}
