import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardView } from "./dashboard-view";
import { ProfileMenu } from "./profile-menu";

/**
 * The dashboard shell, drawn from plain values. No session, no database and no browser:
 * the page decides who may see it, and these check what is drawn.
 */

describe("the dashboard", () => {
  const html = renderToStaticMarkup(<DashboardView signedInAs="member@example.com" />);
  const tiles = html.split("<article").slice(1);

  it("has ONE heading that says Dashboard, and says who is signed in", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    // The owner saw "Dashboard" twice (a label above the heading). Once is enough.
    expect(html.match(/dashboard/gi)).toHaveLength(1);
    expect(html).toContain("Signed in as");
    expect(html).toContain("member@example.com");
  });

  it("stacks the three products in their tones, the Academy first", () => {
    expect(tiles.map((tile) => /data-tone="([^"]+)"/.exec(tile)?.[1])).toEqual([
      "academy",
      "bot",
      "charts",
    ]);
    expect(html.match(/<h2/g)).toHaveLength(3);
    for (const word of [">Zero<", ">Corps<", ">Academy<", ">Bot<", ">Charts<"]) {
      expect(html).toContain(word);
    }
    // One column: the list never splits into two.
    expect(html).not.toMatch(/grid-cols-2|col-span-2/);
  });

  it("gives every tile ONE action: Enter here on the Academy, COMING SOON on the others", () => {
    const [academy, bot, charts] = tiles;
    expect(academy).toContain("Enter here");
    expect(academy).toContain('href="/academy"');
    expect(academy).not.toContain("COMING SOON");
    for (const tile of [bot, charts]) {
      expect(tile).toContain("COMING SOON");
      expect(tile).not.toContain("href=");
      expect(tile).not.toContain("Enter here");
    }
  });

  it("links nowhere but the Academy's page, and has no real button that does nothing", () => {
    expect([...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1])).toEqual(["/academy"]);
    expect(html).not.toContain("<button");
  });

  it("escapes whatever it is given", () => {
    const hostile = renderToStaticMarkup(
      <DashboardView signedInAs={'"><img src=x onerror=alert(1)>'} />,
    );
    expect(hostile).not.toContain("<img");
    expect(hostile).toContain("&lt;img");
  });
});

describe("the profile menu", () => {
  it("is a closed menu button with the grey default picture", () => {
    const html = renderToStaticMarkup(<ProfileMenu onSignOut={() => {}} />);
    expect(html).toContain('aria-label="Account menu"');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="menu"');
    expect(html).not.toContain("Sign out");
    expect(html).toContain("<svg");
  });

  it("holds exactly one entry when open: Sign out", () => {
    const html = renderToStaticMarkup(<ProfileMenu onSignOut={() => {}} defaultOpen />);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('role="menu"');
    expect(html.match(/role="menuitem"/g)).toHaveLength(1);
    expect(html).toMatch(/role="menuitem"[^>]*>Sign out</);
    // The button points at the very menu it opened.
    const controls = /aria-controls="([^"]+)"/.exec(html)?.[1];
    const menuId = /<div id="([^"]+)" role="menu"/.exec(html)?.[1];
    expect(controls).toBeTruthy();
    expect(controls).toBe(menuId);
  });

  it("cannot be pressed twice while signing out", () => {
    const html = renderToStaticMarkup(<ProfileMenu onSignOut={() => {}} pending defaultOpen />);
    expect(html).toMatch(/role="menuitem"[^>]*disabled=""[^>]*>Signing out…</);
  });
});
