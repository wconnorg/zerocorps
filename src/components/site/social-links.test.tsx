import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { site } from "../../config/site";
import { SocialIconLink, SocialLinks } from "./social-links";
import { Wordmark } from "./wordmark";

/** The header's ways to ZeroCorps elsewhere, and its wordmark, drawn as text. */

describe("the header's ways to ZeroCorps elsewhere", () => {
  it("each is one named link, its mark hidden from screen readers", () => {
    for (const [network, href, name] of [
      ["discord", "https://discord.gg/example", "Discord"],
      ["youtube", "https://www.youtube.com/@example", "YouTube"],
      ["x", "https://x.com/example", "X"],
    ] as const) {
      const html = renderToStaticMarkup(<SocialIconLink network={network} href={href} />);
      expect(html).toMatch(new RegExp(`^<a [^>]*href="${href.replaceAll(".", "\\.")}"`));
      expect(html).toContain(`aria-label="ZeroCorps on ${name}"`);
      expect(html).toContain('rel="noopener noreferrer"');
      expect(html).toMatch(/<svg [^>]*aria-hidden="true"/);
      // The theme switch's own colours: muted, brighter under the pointer.
      expect(html).toContain("text-muted");
      expect(html).toContain("hover:text-fg");
    }
  });

  it("is not there at all without an address", () => {
    expect(renderToStaticMarkup(<SocialIconLink network="discord" href={undefined} />)).toBe("");
    expect(renderToStaticMarkup(<SocialIconLink network="youtube" href="" />)).toBe("");
  });

  it("keeps a phone's header to Discord: YouTube and X show from 640 pixels up", () => {
    const youtube = renderToStaticMarkup(
      <SocialIconLink network="youtube" href="https://www.youtube.com/@example" onPhones={false} />,
    );
    expect(youtube).toContain("hidden sm:inline-flex");
    const discord = renderToStaticMarkup(
      <SocialIconLink network="discord" href="https://discord.gg/example" />,
    );
    const discordClasses = discord.match(/^<a [^>]*class="([^"]*)"/)?.[1] ?? "";
    expect(discordClasses).toContain("inline-flex");
    expect(discordClasses.split(" ")).not.toContain("hidden");
  });

  it("draws YouTube, X and Discord in that order, each only once it has an address", () => {
    const html = renderToStaticMarkup(<SocialLinks discord="https://discord.gg/example" />);
    const youtube: string = site.youtube;
    const x: string = site.x;
    expect(html.includes("ZeroCorps on YouTube")).toBe(youtube !== "");
    expect(html.includes("ZeroCorps on X")).toBe(x !== "");
    expect(html).toContain("ZeroCorps on Discord");
    const order = ["YouTube", "X", "Discord"]
      .map((name) => html.indexOf(`ZeroCorps on ${name}"`))
      .filter((at) => at !== -1);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("always has the owner's permanent Discord invite to fall back on, written as a real invite", () => {
    expect(site.discordInvite).toMatch(
      /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+$/,
    );
  });

  it("the YouTube and X addresses, once given, are the networks' own", () => {
    const youtube: string = site.youtube;
    const x: string = site.x;
    if (youtube) {
      expect(youtube).toMatch(/^https:\/\/(www\.)?youtube\.com\/(@[\w.-]+|channel\/[\w-]+)$/);
    }
    if (x) expect(x).toMatch(/^https:\/\/x\.com\/\w{1,15}$/);
  });
});

describe("the header's wordmark", () => {
  it("leads to the dashboard, on every page that uses it", () => {
    const html = renderToStaticMarkup(<Wordmark />);
    expect(html).toMatch(/^<a [^>]*href="\/dashboard"/);
    expect(html).toContain('aria-label="ZeroCorps dashboard"');
  });
});
