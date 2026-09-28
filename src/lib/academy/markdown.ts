import MarkdownIt from "markdown-it";
import type { RenderRule } from "markdown-it/lib/renderer.mjs";
import type StateCore from "markdown-it/lib/rules_core/state_core.mjs";

/**
 * Turns a lesson's Markdown into HTML for the lesson page.
 *
 * The lessons are the owner's own files, but they are still rendered as if they were not
 * trusted, because the page shows the result with `dangerouslySetInnerHTML`:
 *
 * - **raw HTML is never passed through** (`html: false`): a `<script>` in a lesson is shown
 *   as text, not run;
 * - **links are checked** by markdown-it's own `validateLink`, which refuses
 *   `javascript:`, `vbscript:`, `file:` and non-image `data:` addresses;
 * - **links to other sites** open as ordinary links with `rel="noopener noreferrer"`.
 *
 * On top of plain Markdown it understands Obsidian's callouts (`> [!note] Title`), since
 * the owner writes in Obsidian. A `# heading` becomes `##`: the lesson's title is the
 * page's only `#`.
 */

const md = new MarkdownIt({ html: false, linkify: false, typographer: false, breaks: false });

/** Obsidian's callout types, folded into the four looks the site has. */
const CALLOUT_LOOK: Record<string, "note" | "tip" | "warning" | "danger" | "quote"> = {
  note: "note",
  info: "note",
  abstract: "note",
  summary: "note",
  tldr: "note",
  todo: "note",
  tip: "tip",
  hint: "tip",
  important: "tip",
  success: "tip",
  check: "tip",
  done: "tip",
  example: "tip",
  warning: "warning",
  caution: "warning",
  attention: "warning",
  question: "warning",
  help: "warning",
  faq: "warning",
  danger: "danger",
  error: "danger",
  failure: "danger",
  fail: "danger",
  missing: "danger",
  bug: "danger",
  quote: "quote",
  cite: "quote",
};

const CALLOUT_START = /^\[!([a-z][a-z-]*)\][+-]?[ \t]*(.*)$/i;

/**
 * Runs after the block parser and before inline parsing, so the title it inserts is
 * parsed as Markdown like any other text (and escaped like any other text).
 */
function callouts(state: StateCore) {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i]!;
    if (open.type !== "blockquote_open") continue;
    const paragraph = tokens[i + 1];
    const inline = tokens[i + 2];
    if (paragraph?.type !== "paragraph_open" || inline?.type !== "inline") continue;
    const [firstLine = "", ...restLines] = inline.content.split("\n");
    const match = CALLOUT_START.exec(firstLine);
    if (!match) continue;

    const type = match[1]!.toLowerCase();
    const look = CALLOUT_LOOK[type] ?? "note";
    const title = match[2]!.trim() || type.charAt(0).toUpperCase() + type.slice(1);

    // The matching close is the next blockquote_close at the same nesting level.
    const close = tokens
      .slice(i + 1)
      .find((token) => token.type === "blockquote_close" && token.level === open.level);
    if (!close) continue;
    open.tag = "aside";
    close.tag = "aside";
    open.attrSet("class", `callout callout-${look}`);

    const titleOpen = new state.Token("paragraph_open", "p", 1);
    titleOpen.attrSet("class", "callout-title");
    titleOpen.block = true;
    const titleInline = new state.Token("inline", "", 0);
    titleInline.content = title;
    titleInline.children = [];
    const titleClose = new state.Token("paragraph_close", "p", -1);
    titleClose.block = true;

    const rest = restLines.join("\n").trim();
    if (rest) {
      inline.content = rest;
      tokens.splice(i + 1, 0, titleOpen, titleInline, titleClose);
    } else {
      // Title only: the body, if any, is in the paragraphs that follow.
      tokens.splice(i + 1, 3, titleOpen, titleInline, titleClose);
    }
  }
}

md.core.ruler.after("block", "obsidian_callouts", callouts);

const demoteTitle: RenderRule = (tokens, index, options, env, self) => {
  const token = tokens[index]!;
  if (token.tag === "h1") token.tag = "h2";
  return self.renderToken(tokens, index, options);
};
md.renderer.rules.heading_open = demoteTitle;
md.renderer.rules.heading_close = demoteTitle;

md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const token = tokens[index]!;
  if (/^https?:\/\//i.test(token.attrGet("href") ?? "")) {
    token.attrSet("rel", "noopener noreferrer");
  }
  return self.renderToken(tokens, index, options);
};

/** A wide table scrolls inside its own box instead of widening the page. */
md.renderer.rules.table_open = () => '<div class="lesson-table"><table>\n';
md.renderer.rules.table_close = () => "</table></div>\n";

/** A block of Markdown, as HTML. */
export function renderMarkdown(source: string): string {
  return md.render(source);
}

/** One line of Markdown (a quick check's question or option), as HTML without a paragraph. */
export function renderInline(source: string): string {
  return md.renderInline(source);
}
