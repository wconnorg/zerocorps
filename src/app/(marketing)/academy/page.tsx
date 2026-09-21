import type { Metadata } from "next";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Academy",
  description: `${site.academy} is coming soon.`,
  openGraph: { title: site.academy, url: "/academy" },
};

/**
 * Where "Enter here" on the Academy tile leads, until the lessons exist (milestone 7).
 *
 * The owner's words (2026-09-21): pitch black, a red glow, and small text in the middle
 * that says coming soon. So this part of the page is dark in BOTH themes: it carries its
 * own `data-theme`, which switches the colour tokens for everything inside it. The header
 * and the footer keep the visitor's theme.
 *
 * The earlier landing content (the features, the calendar preview, the sign-up and sign-in
 * buttons) is gone from here. An account is still reached through "Enter the dashboard",
 * and the sign-in page offers "Create an account".
 */
export default function AcademyPage() {
  return (
    <section
      data-theme="dark"
      className="void relative flex items-center justify-center overflow-hidden px-6"
    >
      <div aria-hidden="true" className="void-glow pointer-events-none absolute inset-0" />
      <div className="relative text-center">
        <h1 className="sr-only">{site.academy}</h1>
        <p className="void-text inline-flex items-center gap-3 font-mono text-xs text-muted">
          <span
            aria-hidden="true"
            className="size-1.5 animate-pulse bg-accent motion-reduce:animate-none"
          />
          COMING SOON
        </p>
      </div>
    </section>
  );
}
