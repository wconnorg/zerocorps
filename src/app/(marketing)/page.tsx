import Link from "next/link";
import { Arrow, nameOf, PRODUCTS_IN_ORDER } from "@/components/marketing/products";
import { BrandName } from "@/components/site/wordmark";

// Placeholder copy throughout: edit freely.

/** A division's row: the same spacing whether it is a link or not. */
const ROW = "flex min-h-32 w-full items-center px-5 py-6 sm:px-10";

/**
 * A way in's arrow leans forward under the pointer or the keyboard's focus. The link is
 * the `group`. A visitor who asked for reduced motion gets no movement at all.
 */
const LEAN =
  "motion-safe:transition-transform motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1";

/**
 * The landing page (owner, 2026-10-02: "B · Directive", chosen from three drawn
 * directions): ONE screen, drawn as a frame of hairlines. On the left the name, the
 * quotation and the one way in; on the right the three divisions, ONCE, as a list with
 * their status, the Academy first as on the dashboard. Nothing else: the owner asked for
 * sleek and sparse.
 *
 * Every hairline is a border, the one between the panels too (under the name when they
 * stack on a phone, at its right when they stand side by side): a browser draws every
 * border the same thickness, which a gap between two panels is not at 125% scaling.
 *
 * Every link in the page's body is a way IN, to `/dashboard`, which sends a signed-out
 * visitor to sign-in (offering "Create an account") and brings them back. None is
 * pre-loaded: `/dashboard` would redirect a signed-out visitor's browser and abort, a
 * wasted request on every visit.
 */
export default function HomePage() {
  return (
    <div className="grid flex-1 lg:grid-cols-2">
      <section className="flex flex-col justify-center gap-9 border-b border-line px-5 py-16 sm:px-10 lg:border-r lg:border-b-0 lg:py-24">
        {/* The name is one word that cannot wrap, so its size follows the width it has:
            the whole window on a phone, half of it once the panels stand side by side.
            No smallest size: a floor would push it out of a very narrow window. */}
        <h1 className="text-[length:min(13.5vw,6.75rem)]/[0.92] font-semibold tracking-[-0.035em] lg:text-[length:min(6.6vw,6.75rem)]/[0.92]">
          <BrandName uppercase />
        </h1>
        <figure className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <blockquote className="text-[length:clamp(1.25rem,1.9vw,1.75rem)]/[1.2] text-muted">
            <span aria-hidden="true">&ldquo;</span>
            Forced evolution.
            <span aria-hidden="true">&rdquo;</span>
          </blockquote>
          <figcaption className="font-mono text-sm tracking-[0.22em] text-subtle">
            &mdash; J.B.
          </figcaption>
        </figure>
        <div>
          <Link
            href="/dashboard"
            prefetch={false}
            className="group inline-flex h-13 items-center gap-3 bg-accent px-7 text-base font-semibold text-accent-fg transition-colors hover:bg-accent/90"
          >
            Enter the dashboard
            <Arrow className={`size-4 ${LEAN}`} />
          </Link>
        </div>
      </section>

      <section aria-labelledby="divisions" className="flex flex-col">
        <h2
          id="divisions"
          className="flex min-h-14 items-center gap-3 px-5 font-mono text-[0.6875rem] font-normal tracking-[0.24em] text-subtle sm:px-10"
        >
          <span aria-hidden="true" className="size-1.5 bg-accent" />
          DIVISIONS
        </h2>
        <ul className="flex flex-1 flex-col">
          {PRODUCTS_IN_ORDER.map((product, index) => {
            // The number stands on the name's own baseline. The status sits at the right of
            // the name, and where there is no room (a phone) it drops under the name, in
            // line with it. Side by side it never drops: there the room is so close to
            // what "COMING SOON" needs that a scrollbar would move two rows and not the third.
            const face = (
              <div className="flex w-full items-baseline gap-x-4 sm:gap-x-6">
                <div
                  aria-hidden="true"
                  className="w-8 shrink-0 font-mono text-xs tracking-[0.2em] text-subtle"
                >
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-4 lg:flex-nowrap">
                  <div className="flex min-w-0 flex-[1_1_13.75rem] flex-col gap-2.5">
                    {/* The second line is part of the name ("ZeroCorps Academy"), so it is
                        part of the heading: the space keeps the two words apart when read out. */}
                    <h3 className="text-[length:clamp(1.5rem,2.4vw,2.125rem)]/none font-semibold tracking-[-0.01em] uppercase">
                      <span className="text-fg">Zero</span>
                      <span className="tone-text">{product.rest}</span>
                      {product.line ? (
                        <>
                          {" "}
                          <span className="mt-3 block font-mono text-[0.6875rem] font-normal tracking-[0.34em] text-muted">
                            {product.line}
                          </span>
                        </>
                      ) : null}
                    </h3>
                    {product.blurb ? <p className="text-sm/6 text-muted">{product.blurb}</p> : null}
                  </div>
                  {product.href ? (
                    <span className="inline-flex h-11 shrink-0 items-center gap-2.5 bg-accent px-[1.125rem] font-mono text-xs font-semibold tracking-[0.18em] text-accent-fg transition-colors group-hover:bg-accent/90">
                      ENTER
                      <Arrow className={`size-3.5 ${LEAN}`} />
                    </span>
                  ) : (
                    <span className="tone-border tone-text inline-flex h-11 shrink-0 items-center border px-4 font-mono text-[0.6875rem] tracking-[0.2em]">
                      COMING SOON
                    </span>
                  )}
                </div>
              </div>
            );
            return (
              // `product-tile` and `data-tone` give the row its tone colour (globals.css).
              <li
                key={product.id}
                data-tone={product.tone}
                className="product-tile flex flex-1 border-t border-line"
              >
                {product.href ? (
                  <Link
                    href={product.href}
                    prefetch={false}
                    aria-label={`Enter ${nameOf(product)}`}
                    className={`${ROW} group transition-colors hover:bg-surface focus-visible:-outline-offset-2`}
                  >
                    {face}
                  </Link>
                ) : (
                  <div className={ROW}>{face}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
