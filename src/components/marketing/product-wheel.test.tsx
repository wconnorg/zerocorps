import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductWheel } from "./product-wheel";
import { nameOf, ProductFace, PRODUCTS } from "./products";

/** What the server sends for the wheel, before any script runs. It must always be the same. */
describe("the product wheel", () => {
  const html = renderToStaticMarkup(<ProductWheel />);
  const slides = [...html.matchAll(/<article[^>]*>/g)].map((match) => match[0]);

  it("is a labelled carousel of exactly three slides, each named and toned", () => {
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html).toContain('aria-label="ZeroCorps products"');
    expect(slides).toHaveLength(3);
    expect(slides.map((slide) => /aria-label="([^"]+)"/.exec(slide)?.[1])).toEqual([
      "1 of 3: ZeroBot",
      "2 of 3: ZeroCharts",
      "3 of 3: ZeroCorps Academy",
    ]);
    expect(slides.map((slide) => /data-tone="([^"]+)"/.exec(slide)?.[1])).toEqual([
      "bot",
      "charts",
      "academy",
    ]);
  });

  it("starts with the Academy in front, the others to its right and left", () => {
    expect(slides.map((slide) => /data-pos="(\d)"/.exec(slide)?.[1])).toEqual(["1", "2", "0"]);
  });

  it("says coming soon on the two that lead nowhere, and links only the Academy", () => {
    expect(html.match(/COMING SOON/g)).toHaveLength(2);
    // To a visitor the Academy tile is the way IN, not a page about the Academy.
    expect([...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1])).toEqual(["/dashboard"]);
    expect(html).not.toContain("ZC /");
  });

  // That the way in is never PRE-loaded cannot be seen here: Next renders no attribute for
  // `prefetch={false}`. A real browser is what proves it, and `npm run verify` fails on the
  // aborted request a pre-load would make. It caught exactly that bug once already.

  it("can be turned and paused from the keyboard, with named controls", () => {
    for (const name of [
      "Previous product",
      "Next product",
      "Pause the wheel",
      "Show ZeroBot",
      "Show ZeroCharts",
      "Show ZeroCorps Academy",
    ]) {
      expect(html, name).toContain(`aria-label="${name}"`);
    }
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toContain('aria-pressed="false"');
  });

  it("keeps the pointer-only click zones away from the keyboard and screen readers", () => {
    const zones = [...html.matchAll(/<button[^>]*class="wheel-hit[^"]*"[^>]*>/g)].map((m) => m[0]);
    expect(zones).toHaveLength(2);
    for (const zone of zones) {
      expect(zone).toContain('tabindex="-1"');
      expect(zone).toContain('aria-hidden="true"');
    }
  });

  it("has a timer element, and uses no inline styles (so it works under a strict CSP)", () => {
    expect(html.match(/class="wheel-timer"/g)).toHaveLength(1);
    expect(html).not.toContain("style=");
  });
});

describe("a product tile's face", () => {
  it("shows the two short lines the owner asked for, and none for the Academy", () => {
    expect(PRODUCTS.map((product) => [nameOf(product), product.blurb.length > 0])).toEqual([
      ["ZeroBot", true],
      ["ZeroCharts", true],
      ["ZeroCorps Academy", false],
    ]);
    for (const product of PRODUCTS) expect(product.blurb.length).toBeLessThanOrEqual(60);
  });

  it("is a link only when it is allowed to be, and never for a product that is not ready", () => {
    const [bot, , academy] = PRODUCTS;
    const face = (product: (typeof PRODUCTS)[number], linked: boolean) =>
      renderToStaticMarkup(<ProductFace product={product} heading="h3" linked={linked} />);
    expect(face(academy, true)).toContain('href="/dashboard"');
    expect(face(academy, false)).not.toContain("href=");
    expect(face(bot, true)).not.toContain("href=");
  });

  it("can be sent somewhere else, as the dashboard sends a member who is already in", () => {
    const [bot, , academy] = PRODUCTS;
    const sent = renderToStaticMarkup(
      <ProductFace product={academy} heading="h3" href="/academy" />,
    );
    expect(sent).toContain('href="/academy"');
    expect(sent).not.toContain('href="/dashboard"');
    // A product with no road of its own stays unlinked, wherever it is drawn.
    expect(renderToStaticMarkup(<ProductFace product={bot} heading="h3" />)).not.toContain("href=");
  });

  it("can go without the watermark, as the products section does", () => {
    const [bot] = PRODUCTS;
    const withMark = renderToStaticMarkup(<ProductFace product={bot} heading="h3" />);
    const without = renderToStaticMarkup(
      <ProductFace product={bot} heading="h3" watermark={false} />,
    );
    expect(withMark).toContain("wheel-watermark");
    expect(without).not.toContain("wheel-watermark");
  });
});
