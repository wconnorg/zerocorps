import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardView } from "./dashboard-view";
import { ProfileMenu } from "./profile-menu";

/**
 * The dashboard shell, drawn from plain values. No session, no database and no browser:
 * the page decides who may see it, and these check what is drawn.
 */

describe("the dashboard", () => {
  const html = renderToStaticMarkup(<DashboardView email="member@example.com" />);

  it("has one heading and shows which account is signed in", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("member@example.com");
  });

  it("shows the ZeroCorps Academy tile, marked as coming soon", () => {
    expect(html).toMatch(/<h2[^>]*id="tile-academy"[^>]*>.*Zero.*Corps.* Academy<\/h2>/);
    expect(html).toContain("COMING SOON");
    expect(html).toContain('aria-labelledby="tile-academy"');
  });

  it("does not make the tile clickable: nothing on the dashboard links anywhere yet", () => {
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("<button");
  });

  it("escapes whatever it is given", () => {
    const hostile = renderToStaticMarkup(
      <DashboardView email={'"><img src=x onerror=alert(1)>'} />,
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
