import type { Route } from "next";
import Link from "next/link";
import { ZeroMark } from "@/components/site/wordmark";
import { buttonClasses } from "@/components/ui/button";

/**
 * The three ZeroCorps products, and the face of a product tile. The turning wheel in the
 * hero and the products section below it both draw from here, so they cannot drift apart.
 *
 * Each product has its own tone (owner, 2026-09-21): ZeroBot is blue, ZeroCharts is
 * purple, the Academy keeps the brand red. A tile carries `data-tone`, and `globals.css`
 * turns that into the `--tone` colour the `tone-*` classes paint with: no inline styles.
 *
 * ZeroBot and ZeroCharts cannot be used yet, so they say "COMING SOON" and link nowhere.
 * The Academy tile says nothing on top: it is the way in.
 *
 * **Where "Enter here" leads depends on who is looking** (owner, 2026-09-21). To a visitor
 * on the home page it is the way IN: `/dashboard`, which sends a signed-out visitor to
 * sign-in (offering "Create an account") and brings them back. A member who is already
 * signed in is past that door, so the dashboard passes `/academy` instead, which says the
 * Academy is coming.
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

function Arrow() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

/**
 * Everything inside a product tile except its bottom edge. The tile itself is the
 * caller's: it must be `relative`, clip its overflow, lay its children out as a column
 * with space between, and carry `product-tile` and `data-tone`. The tile's outline is a
 * plain border: the corner brackets were removed at the owner's request.
 *
 * `heading` keeps the page's outline right: the wheel's tiles sit under the page's `h1`,
 * the section's tiles under its `h2`. `linked` is false for a wheel tile that is not in
 * front: a dimmed tile at the side is scenery, not a link.
 */
export function ProductFace({
  product,
  heading: Heading,
  linked = true,
  watermark = true,
  comingSoon,
  layout = "column",
  href,
}: {
  product: Product;
  heading: "h2" | "h3";
  linked?: boolean;
  /**
   * Where "Enter here" leads, when the product's own road is not the right one. The
   * dashboard passes `/academy` here: a member is already through the door that the
   * product's own `/dashboard` opens.
   */
  href?: Route;
  /** The large faint mark behind the content. The wheel's tiles have it; the section's do not. */
  watermark?: boolean;
  /**
   * Whether the tile says "COMING SOON". By default a product says it unless it leads
   * somewhere. The dashboard says it for all three: a member cannot use any of them yet.
   */
  comingSoon?: boolean;
  /**
   * "column" (the narrow tiles of the wheel and of the home page): the status on top, the
   * way in under the name. "row" (the dashboard's wide tiles, owner): the words on the left
   * and ONE action at the middle right, which is either "COMING SOON", drawn as a button
   * that cannot be pressed, or the red "Enter here" button, in the very same place.
   */
  layout?: "column" | "row";
}) {
  const soon = comingSoon ?? !product.href;
  const goesTo = href ?? product.href;

  const surface = (
    // A faint grid, scanlines, a wash of the tone, and the mark as a watermark.
    <span aria-hidden="true" className="product-surface">
      <span className="absolute inset-0 grid-fade opacity-70" />
      <span className="absolute inset-0 scanlines" />
      <span className="tone-glow absolute inset-0" />
      {watermark ? <ZeroMark className="wheel-watermark tone-text absolute opacity-10" /> : null}
    </span>
  );

  const words = (
    <>
      <ZeroMark className="tone-text size-7 sm:size-9" />
      <Heading className="wheel-name mt-4 text-2xl/none font-semibold uppercase sm:text-4xl/none">
        <span className="text-fg">Zero</span>
        <span className="tone-text">{product.rest}</span>
        {product.line ? <span className="wheel-name-line text-muted">{product.line}</span> : null}
      </Heading>
      {product.blurb ? <p className="mt-3 max-w-64 text-sm/6 text-muted">{product.blurb}</p> : null}
    </>
  );

  // A red button (owner). Its ::after covers the whole tile, so the tile is the target.
  // It is never pre-loaded: /dashboard would redirect a signed-out visitor's browser and
  // abort, a wasted request on every visit to the home page.
  const enter =
    goesTo && linked ? (
      <Link
        href={goesTo}
        prefetch={false}
        className={buttonClasses({ className: "after:absolute after:inset-0" })}
      >
        Enter here
        <Arrow />
        <span className="sr-only">: {nameOf(product)}</span>
      </Link>
    ) : null;

  const pulse = <span className="tone-bg size-1.5 animate-pulse motion-reduce:animate-none" />;

  if (layout === "row") {
    return (
      <>
        {surface}
        <div className="product-content flex w-full flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>{words}</div>
          <div className="shrink-0">
            {enter ??
              (soon ? (
                <span className="tone-border tone-text inline-flex h-10 items-center gap-2 border px-4 font-mono text-xs tracking-[0.2em]">
                  {pulse}
                  COMING SOON
                </span>
              ) : null)}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {surface}
      <div className="product-content tone-text flex h-4 items-center gap-2 font-mono text-[10px] tracking-[0.2em] sm:text-[11px]">
        {soon ? (
          <>
            {pulse}
            COMING SOON
          </>
        ) : null}
      </div>

      <div className="product-content">
        {words}
        {enter ? <div className="mt-5">{enter}</div> : null}
      </div>
    </>
  );
}
