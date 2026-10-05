import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * The Academy's tabs, under the header on its top-level pages (owner, 2026-10-05): Learn
 * (the Academy's home, with "Resume") and Progress (the rank, the member's progress and the
 * activity heatmap). Ranks left the tabs the same day ("remove the ranks header"): its page
 * is reached from the rank card on Progress, and marks Progress as its section. The owner
 * has named a Backtest, a Journal and a Calculator as tabs to come; they join this list
 * when they are built.
 */

export const ACADEMY_TABS = [
  { key: "learn", label: "Learn", href: "/academy" },
  { key: "progress", label: "Progress", href: "/academy/progress" },
] as const satisfies readonly { key: string; label: string; href: Route }[];

export type AcademyTab = (typeof ACADEMY_TABS)[number]["key"];

/**
 * `onPage={false}` for a page inside a tab's section, such as Ranks under Progress: the tab
 * is then marked as the current section, not as the page itself.
 */
export function AcademyTabs({ current, onPage = true }: { current: AcademyTab; onPage?: boolean }) {
  return (
    <nav aria-label="Academy" className="border-b border-line/70">
      {/* A phone too narrow for every tab scrolls them sideways rather than the page. */}
      <ul className="mx-auto flex w-full max-w-6xl gap-2 overflow-x-auto px-3 sm:gap-4">
        {ACADEMY_TABS.map((tab) => {
          const active = tab.key === current;
          return (
            <li key={tab.key} className="shrink-0">
              <Link
                href={tab.href}
                prefetch={false}
                aria-current={active ? (onPage ? "page" : "true") : undefined}
                className={cn(
                  "relative inline-flex min-h-12 items-center px-3 font-mono text-xs tracking-[0.22em] uppercase transition-colors",
                  active ? "text-fg" : "text-subtle hover:text-fg",
                )}
              >
                {tab.label}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 -bottom-px h-0.5 bg-accent"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
