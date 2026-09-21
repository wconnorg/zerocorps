import { AccountMenu } from "@/components/app/profile-menu";
import { Wordmark } from "@/components/site/wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/**
 * The signed-in area: the wordmark in the middle, a bar under it as on the home page, the
 * theme switch and the profile button with its menu. Milestone 4 adds the menu's other
 * entries (profile, settings).
 *
 * The session is NOT checked here: a layout is not re-rendered on every navigation, so
 * each protected page checks for itself with `getSessionState()`. The profile menu needs
 * nothing from the session yet: everyone has the grey default picture, and signing out
 * is safe to offer to anybody.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-line/70">
        <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-6">
          <span aria-hidden="true" />
          <Wordmark markClassName="text-fg" />
          <div className="flex items-center justify-end gap-2">
            <ThemeToggle />
            <AccountMenu />
          </div>
        </div>
      </header>
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
    </>
  );
}
