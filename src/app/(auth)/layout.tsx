import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Wordmark } from "@/components/site/wordmark";

/** Centred single-card layout shared by sign in, sign up and, later, the other auth screens. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Wordmark />
        <ThemeToggle />
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8">
          {children}
        </div>
      </main>
    </>
  );
}
