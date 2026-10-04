import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

/**
 * The landing page ("B · Directive", owner, 2026-10-02), drawn as text: one screen, the
 * name and the one way in on the left, the three divisions ONCE on the right.
 */

describe("the landing page", () => {
  const html = renderToStaticMarkup(<HomePage />);
  // The tag itself, not "<link" or "<line".
  const rows = html.split(/<li(?=[\s>])/).slice(1);

  it("has one heading that is the name, the quotation, and one button", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*><span[^>]*>ZERO<\/span><span[^>]*>CORPS<\/span><\/h1>/);
    expect(html).toContain("Forced evolution.");
    expect(html).toContain("J.B.");
    expect(html).toMatch(/<a [^>]*href="\/dashboard"[^>]*>Enter the dashboard</);
  });

  it("lists the three divisions once, the Academy first, each in its tone", () => {
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => /data-tone="([^"]+)"/.exec(row)?.[1])).toEqual([
      "academy",
      "bot",
      "charts",
    ]);
    // Each name is one heading, read out whole: "ZeroCorps Academy", not "ZeroCorps".
    const headings = [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)].map((match) =>
      match[1]?.replace(/<[^>]+>/g, ""),
    );
    expect(headings).toEqual(["ZeroCorps Academy", "ZeroBot", "ZeroCharts"]);
    for (const word of [">Corps<", ">Academy<", ">Bot<", ">Charts<"]) {
      expect(html.split(word)).toHaveLength(2);
    }
    expect(rows.map((row) => /aria-hidden="true"[^>]*>(\d\d)</.exec(row)?.[1])).toEqual([
      "01",
      "02",
      "03",
    ]);
  });

  it("opens the Academy's row as a way in, and says COMING SOON on the other two", () => {
    const [academy, bot, charts] = rows;
    expect(academy).toContain('aria-label="Enter ZeroCorps Academy"');
    expect(academy).toContain('href="/dashboard"');
    expect(academy).toContain("ENTER");
    expect(academy).not.toContain("COMING SOON");
    for (const row of [bot, charts]) {
      expect(row).toContain("COMING SOON");
      expect(row).not.toContain("href=");
    }
    expect(bot).toContain("Automated execution, built on your rules.");
    expect(charts).toContain("Order flow and market depth, decoded in real time.");
  });

  it("links nowhere but the way in, and has no button that does nothing", () => {
    expect([...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((match) => match[1])).toEqual([
      "/dashboard",
      "/dashboard",
    ]);
    expect(html).not.toContain("<button");
  });

  it("stays one screen: no second section of products, no wheel", () => {
    expect(html.match(/<section/g)).toHaveLength(2);
    expect(html).not.toMatch(/wheel|PRODUCTS/);
  });
});
