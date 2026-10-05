import { env } from "@/env";
import { DiscordIconLink } from "./discord-icon-link";
import { Wordmark } from "./wordmark";

/**
 * The public pages' header. It runs the full width of the window, with the same side
 * padding as the landing page's panels, so its hairline meets theirs (owner, 2026-10-02).
 * At the right, the way to Discord (owner, 2026-10-04: the site is dark only, so the theme
 * switch that stood there is gone).
 */
export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
      {/* The wordmark sits at the true centre (owner, 2026-09-21): the empty first column
          balances the controls in the last one. */}
      <div className="grid h-16 w-full grid-cols-[1fr_auto_1fr] items-center px-5 sm:px-10">
        <span aria-hidden="true" />
        <Wordmark markClassName="text-fg" />
        <div className="flex items-center justify-end gap-2">
          <DiscordIconLink href={env.DISCORD_INVITE_URL} />
        </div>
      </div>
    </header>
  );
}
