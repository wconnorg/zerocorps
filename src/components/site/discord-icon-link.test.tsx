import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DiscordIconLink } from "./discord-icon-link";

/** The header's way to Discord, drawn as text. */

describe("the Discord link in the header", () => {
  it("is one named link to the invite, its mark hidden from screen readers", () => {
    const html = renderToStaticMarkup(<DiscordIconLink href="https://discord.gg/example" />);
    expect(html).toMatch(/^<a [^>]*href="https:\/\/discord\.gg\/example"/);
    expect(html).toContain('aria-label="ZeroCorps on Discord"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toMatch(/<svg [^>]*aria-hidden="true"/);
    // The theme switch's own colours: muted, brighter under the pointer.
    expect(html).toContain("text-muted");
    expect(html).toContain("hover:text-fg");
  });

  it("is not there at all without an invite", () => {
    expect(renderToStaticMarkup(<DiscordIconLink href={undefined} />)).toBe("");
  });
});
