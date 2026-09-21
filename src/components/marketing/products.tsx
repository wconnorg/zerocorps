import Link from "next/link";
import { ZeroMark } from "@/components/site/wordmark";

/**
 * The three ZeroCorps products, and the face of a product tile. The turning wheel in the
 * hero and the products section below it both draw from here, so they cannot drift apart.
 *
 * Each product has its own tone (owner, 2026-09-21): ZeroBot is blue, ZeroCharts is
 * purple, the Academy keeps the brand red. A tile carries `data-tone`, and `globals.css`
 * turns that into the `--tone` colour the `tone-*` classes paint with: no inline styles.
 *
 * ZeroBot and ZeroCharts cannot be used yet, so they say "COMING SOON" and link nowhere.
 * The Academy tile says nothing on top: it leads to the Academy's public page.
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
  { id: "academy", tone: "academy", rest: "Corps", line: "Academy", blurb: "", href: "/academy" },
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
}: {
  product: Product;
  heading: "h2" | "h3";
  linked?: boolean;
  /** The large faint mark behind the content. The wheel's tiles have it; the section's do not. */
  watermark?: boolean;
  /**
   * Whether the tile says "COMING SOON". By default a product says it unless it leads
   * somewhere. The dashboard says it for all three: a member cannot use any of them yet.
   */
  comingSoon?: boolean;
}) {
  return (
    <>
      {/* The surface: a faint grid, scanlines, a wash of the tone, and the mark as a watermark. */}
      <span aria-hidden="true" className="product-surface">
        <span className="absolute inset-0 grid-fade opacity-70" />
        <span className="absolute inset-0 scanlines" />
        <span className="tone-glow absolute inset-0" />
        {watermark ? <ZeroMark className="wheel-watermark tone-text absolute opacity-10" /> : null}
      </span>

      <div className="product-content tone-text flex h-4 items-center gap-2 font-mono text-[10px] tracking-[0.2em] sm:text-[11px]">
        {(comingSoon ?? !product.href) ? (
          <>
            <span className="tone-bg size-1.5 animate-pulse motion-reduce:animate-none" />
            COMING SOON
          </>
        ) : null}
      </div>

      <div className="product-content">
        <ZeroMark className="tone-text size-7 sm:size-9" />
        <Heading className="wheel-name mt-4 text-2xl/none font-semibold uppercase sm:text-4xl/none">
          <span className="text-fg">Zero</span>
          <span className="tone-text">{product.rest}</span>
          {product.line ? <span className="wheel-name-line text-muted">{product.line}</span> : null}
        </Heading>
        {product.blurb ? (
          <p className="mt-3 max-w-64 text-sm/6 text-muted">{product.blurb}</p>
        ) : null}
        {product.href && linked ? (
          <Link
            href={product.href}
            className="tone-text mt-4 inline-flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase after:absolute after:inset-0"
          >
            Enter
            <Arrow />
            <span className="sr-only"> the {nameOf(product)} page</span>
          </Link>
        ) : null}
      </div>
    </>
  );
}
