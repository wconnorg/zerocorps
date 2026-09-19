import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Wordmark } from "./wordmark";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Wordmark />
        <ThemeToggle />
      </div>
    </header>
  );
}
