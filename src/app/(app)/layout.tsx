import { Wordmark } from "@/components/site/wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/**
 * The signed-in area. Milestone 4 gives it its real shape (the profile menu, settings).
 *
 * The session is NOT checked here: a layout is not re-rendered on every navigation, so
 * each protected page checks for itself with `getSessionState()`.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Wordmark />
        <ThemeToggle />
      </header>
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
    </>
  );
}
