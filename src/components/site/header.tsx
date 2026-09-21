import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Wordmark } from "./wordmark";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      {/* The wordmark sits at the true centre (owner, 2026-09-21): the empty first column
          balances the controls in the last one. */}
      <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-6">
        <span aria-hidden="true" />
        <Wordmark markClassName="text-fg" />
        <div className="flex items-center justify-end gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
