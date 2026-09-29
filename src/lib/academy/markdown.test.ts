import { describe, expect, it } from "vitest";
import { renderInline, renderMarkdown } from "./markdown.ts";

/**
 * The lesson page shows this HTML as it is, so what matters most is what it refuses:
 * nothing a lesson says can put a script, a frame or a dangerous link on the page.
 */

describe("what a lesson can never put on the page", () => {
  it("raw HTML is shown as text, not run", () => {
    const html = renderMarkdown(
      '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n<iframe src="https://evil.example"></iframe>',
    );
    expect(html).not.toMatch(/<script|<img|<iframe/i);
    expect(html).toContain("&lt;script&gt;");
  });

  it("links to javascript:, vbscript:, file: and data: are not made into links", () => {
    for (const href of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "vbscript:msgbox(1)",
      "file:///c:/windows",
      "data:text/html;base64,PHNjcmlwdD4=",
    ]) {
      const html = renderMarkdown(`[click](${href})`);
      expect(html, href).not.toContain("<a ");
    }
  });

  it("an attribute cannot be smuggled in through a link or an image", () => {
    const html = renderMarkdown(
      '[x](https://example.com/" onmouseover="alert(1))\n\n![x" onerror="alert(1)](a.png)',
    );
    // Escaped text, even inside an attribute's value, is fine; an on...= attribute is not.
    // So look at each tag with its quoted values emptied out.
    const tags = html.match(/<[^>]+>/g) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) expect(tag.replace(/"[^"]*"/g, '""')).not.toMatch(/\son[a-z]+=/i);
    expect(html).toContain('alt="x&quot; onerror=&quot;alert(1)"');
  });

  it("a callout's title is escaped like any other text", () => {
    const html = renderMarkdown("> [!note] <b>bold</b><script>x</script>\n> Body");
    expect(html).not.toMatch(/<b>|<script/);
    expect(html).toContain("&lt;b&gt;");
  });
});

describe("what a lesson can use", () => {
  it("headings, with a stray # turned into ## so the title stays the page's only h1", () => {
    const html = renderMarkdown("# Oops\n\n## Fine\n\nText");
    expect(html).not.toContain("<h1");
    expect(html.match(/<h2>/g)).toHaveLength(2);
    expect(html).toContain("</h2>");
    expect(html).not.toContain("</h1>");
  });

  it("a < or { in a sentence is just text", () => {
    const html = renderMarkdown("If price < VWAP and {x} holds, then 1 > 0.");
    expect(html).toContain("price &lt; VWAP and {x} holds, then 1 &gt; 0.");
  });

  it("links to other sites get noopener and noreferrer; links on this site do not need them", () => {
    const outside = renderMarkdown("[docs](https://example.com/docs)");
    expect(outside).toContain('href="https://example.com/docs"');
    expect(outside).toContain('rel="noopener noreferrer"');
    const inside = renderMarkdown("[next](/academy/orders-and-fills)");
    expect(inside).not.toContain("rel=");
  });

  it("a table sits in a box of its own, so a wide one scrolls instead of widening the page", () => {
    const html = renderMarkdown("| a | b |\n| - | - |\n| 1 | 2 |");
    expect(html).toMatch(/^<div class="lesson-table"><table>/);
    expect(html).toContain("</table></div>");
  });
});

describe("Obsidian callouts", () => {
  it("> [!note] Title, then the body", () => {
    const html = renderMarkdown("> [!note] Why R, not dollars\n> Because sizes differ.");
    expect(html).toContain('<aside class="callout callout-note">');
    expect(html).toContain('<p class="callout-title">Why R, not dollars</p>');
    expect(html).toContain("<p>Because sizes differ.</p>");
    expect(html).toContain("</aside>");
    expect(html).not.toContain("[!note]");
  });

  it("with no title, the type is the title; a body in later paragraphs stays inside", () => {
    const html = renderMarkdown("> [!warning]\n>\n> First.\n>\n> Second.");
    expect(html).toContain('<aside class="callout callout-warning">');
    expect(html).toContain('<p class="callout-title">Warning</p>');
    expect(html).toContain("<p>First.</p>");
    expect(html).toContain("<p>Second.</p>");
  });

  it("Obsidian's many types fold into the site's looks, and an unknown one reads as a note", () => {
    expect(renderMarkdown("> [!danger] x")).toContain("callout-danger");
    expect(renderMarkdown("> [!bug] x")).toContain("callout-danger");
    expect(renderMarkdown("> [!tip] x")).toContain("callout-tip");
    expect(renderMarkdown("> [!quote] x")).toContain("callout-quote");
    expect(renderMarkdown("> [!made-up] x")).toContain("callout-note");
  });

  it("an ordinary quote stays a quote", () => {
    const html = renderMarkdown("> Just a quote.");
    expect(html).toContain("<blockquote>");
    expect(html).not.toContain("callout");
  });

  it("callouts can sit inside callouts", () => {
    const html = renderMarkdown("> [!note] Outer\n> > [!tip] Inner\n> > Deep.");
    expect(html.match(/<aside/g)).toHaveLength(2);
    expect(html.match(/<\/aside>/g)).toHaveLength(2);
  });
});

describe("one line of Markdown", () => {
  it("is rendered without a paragraph around it, and escaped", () => {
    expect(renderInline("**+3R** <b>no</b>")).toBe("<strong>+3R</strong> &lt;b&gt;no&lt;/b&gt;");
  });
});
