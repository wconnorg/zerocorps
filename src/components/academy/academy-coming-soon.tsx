import { site } from "@/config/site";

/**
 * What a visitor who is not signed in sees at `/academy`: the owner's words (2026-09-21),
 * pitch black, a red glow, and small text in the middle that says coming soon. Dark in
 * BOTH themes: the section carries its own `data-theme`, which switches the colour tokens
 * for everything inside it. The header and the footer keep the visitor's theme.
 *
 * Members see the Academy itself at the same address. Every lesson is still being written,
 * so "coming soon" is true for visitors too.
 */
export function AcademyComingSoon() {
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
