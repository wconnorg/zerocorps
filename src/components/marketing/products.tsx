import type { Route } from "next";
import Link from "next/link";
import { ZeroMark } from "@/components/site/wordmark";
import { buttonClasses } from "@/components/ui/button";

/**
 * The three ZeroCorps products, and the face of a product tile on the dashboard. The home
 * page's list of divisions draws from the same list, so the two cannot drift apart.
 *
 * Each product has its own tone (owner, 2026-09-21): ZeroBot is blue, ZeroCharts is
 * purple, the Academy keeps the brand red. An element carries `product-tile` and
 * `data-tone`, and `globals.css` turns that into the `--tone` colour the `tone-*` classes
 * paint with: no inline styles.
 *
 * ZeroBot and ZeroCharts cannot be used yet, so they say "COMING SOON" and link nowhere.
 *
 * **Where the Academy leads depends on who is looking** (owner, 2026-09-21). To a visitor
 * on the home page it is the way IN: `/dashboard`, which sends a signed-out visitor to
 * sign-in (offering "Create an account") and brings them back. A member who is already
 * signed in is past that door, so the dashboard passes `/academy` instead.
 */

// Placeholder copy: edit freely. The ZeroCharts line is the owner's pitch, cut down.
export const PRODUCTS = [
  {
    id: "zerobot",
    tone: "bot",
    rest: "Bot",
    line: "",
    blurb: "Automated execution, built on your rules.",
    href: null,
  },
  {
    id: "zerocharts",
    tone: "charts",
    rest: "Charts",
    line: "",
    blurb: "Order flow and market depth, decoded in real time.",
    href: null,
  },
  { id: "academy", tone: "academy", rest: "Corps", line: "Academy", blurb: "", href: "/dashboard" },
] as const;

export type Product = (typeof PRODUCTS)[number];

export const nameOf = (product: Product) =>
  `Zero${product.rest}${product.line ? ` ${product.line}` : ""}`;

/** The products in the order they are shown everywhere: the Academy first. */
export const PRODUCTS_IN_ORDER: readonly Product[] = [
  ...PRODUCTS.filter((product) => product.id === "academy"),
  ...PRODUCTS.filter((product) => product.id !== "academy"),
];

/** The arrow on every way in. Decorative: the words beside it say where it leads. */
export function Arrow({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

/**
 * Everything inside a product tile on the dashboard. The tile itself is the caller's: it
 * must be `relative`, clip its overflow, and carry `product-tile` and `data-tone`. Its
 * outline is a plain border: the corner brackets were removed at the owner's request.
 *
 * The words are on the left and ONE action sits at the middle right: the red "Enter here"
 * button, or "COMING SOON", drawn as a button that cannot be pressed, in the very same
 * place. `heading` keeps the page's outline right.
 */
export function ProductFace({
  product,
  heading: Heading,
  href,
}: {
  product: Product;
  heading: "h2" | "h3";
  /**
   * Where "Enter here" leads, when the product's own road is not the right one. The
   * dashboard passes `/academy` here: a member is already through the door that the
   * product's own `/dashboard` opens.
   */
  href?: Route;
}) {
  const goesTo = href ?? product.href;

  return (
    <>
      {/* A faint grid, scanlines and a wash of the tone, behind the words. */}
      <span aria-hidden="true" className="product-surface">
        <span className="absolute inset-0 grid-fade opacity-70" />
        <span className="absolute inset-0 scanlines" />
        <span className="tone-glow absolute inset-0" />
      </span>
      <div className="flex w-full flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <ZeroMark className="tone-text size-7 sm:size-9" />
          <Heading className="product-name mt-4 text-2xl/none font-semibold uppercase sm:text-4xl/none">
            <span className="text-fg">Zero</span>
            <span className="tone-text">{product.rest}</span>
            {product.line ? (
              <span className="product-name-line text-muted">{product.line}</span>
            ) : null}
          </Heading>
          {product.blurb ? (
            <p className="mt-3 max-w-64 text-sm/6 text-muted">{product.blurb}</p>
          ) : null}
        </div>
        <div className="shrink-0">
          {goesTo ? (
            // A red button (owner). Its ::after covers the whole tile, so the tile is the
            // target. It is never pre-loaded: a protected page would redirect a signed-out
            // visitor's browser and abort, a wasted request.
            <Link
              href={goesTo}
              prefetch={false}
              className={buttonClasses({ className: "after:absolute after:inset-0" })}
            >
              Enter here
              <Arrow />
              <span className="sr-only">: {nameOf(product)}</span>
            </Link>
          ) : (
            <span className="tone-border tone-text inline-flex h-10 items-center gap-2 border px-4 font-mono text-xs tracking-[0.2em]">
              <span className="tone-bg size-1.5 animate-pulse motion-reduce:animate-none" />
              COMING SOON
            </span>
          )}
        </div>
      </div>
    </>
  );
}
