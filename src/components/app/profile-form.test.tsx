import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProfileFields } from "./profile-form";

/**
 * The username and display-name form as it is first drawn. What it does when it is used
 * (the hint, the save, the refusals) is the server's to decide, and is tested there, in
 * `profile-plugin.test.ts`.
 */

describe("choosing a username at onboarding", () => {
  const html = renderToStaticMarkup(<ProfileFields mode="onboarding" onSaved={() => {}} />);

  it("asks for a username and offers a display name, and nothing else", () => {
    expect(html.match(/<input/g)).toHaveLength(2);
    expect(html).toContain("Username");
    expect(html).toContain("Display name (optional)");
    // Hard rule 3, and the owner's fourth priority: nothing personal is asked for here.
    expect(html).not.toMatch(/phone|birthday|country/i);
  });

  it("cannot be sent while the name is empty", () => {
    expect(html).toMatch(/<button[^>]* disabled=""[^>]*>Continue to the dashboard</);
  });

  it("keeps the browser from 'correcting' a name as it is typed", () => {
    expect(html).toMatch(/<input[^>]*name="username"[^>]*>/);
    const input = /<input[^>]*name="username"[^>]*>/.exec(html)?.[0] ?? "";
    expect(input).toContain('autoCapitalize="none"');
    expect(input).toContain('spellCheck="false"');
    expect(input).toContain('maxLength="20"');
  });
});

describe("changing them in settings", () => {
  it("shows what the member has, ready to save", () => {
    const html = renderToStaticMarkup(
      <ProfileFields
        mode="settings"
        initialUsername="trader_99"
        initialDisplayName="Jane Doe"
        onSaved={() => {}}
      />,
    );
    expect(html).toContain('value="trader_99"');
    expect(html).toContain('value="Jane Doe"');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Save changes</);
    expect(html).not.toContain(' disabled=""');
    expect(html).not.toContain("readOnly");
  });

  it("locks the username while the wait is on, and says until when", () => {
    const html = renderToStaticMarkup(
      <ProfileFields
        mode="settings"
        initialUsername="trader_99"
        changeAvailableOn="2026-10-21"
        onSaved={() => {}}
      />,
    );
    const input = /<input[^>]*name="username"[^>]*>/.exec(html)?.[0] ?? "";
    expect(input).toContain("readOnly");
    expect(html).toContain("You can change it again after 2026-10-21.");
    // The display name can still be changed, so the form can still be saved.
    expect(html).not.toContain(' disabled=""');
  });

  it("escapes whatever it is given", () => {
    const html = renderToStaticMarkup(
      <ProfileFields
        mode="settings"
        initialUsername="trader_99"
        initialDisplayName={'"><img src=x onerror=alert(1)>'}
        onSaved={() => {}}
      />,
    );
    expect(html).not.toContain("<img");
  });
});
