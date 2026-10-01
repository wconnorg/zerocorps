/**
 * Writing Markdown and YAML that Obsidian cannot misread (milestone 9).
 *
 * Some of what goes into the brain was typed by members: a display name is free text of
 * up to 40 characters, so it can hold `<img src=...>`, `[[links]]`, `#tags` or backticks.
 * Obsidian renders HTML in Reading view and turns `[[...]]` and `#...` into graph edges,
 * so such text is only ever written in two ways: as a YAML string in the frontmatter, and
 * inside an inline code span in the body. Everything else in the notes is either ours or a
 * name from a fixed, safe alphabet (usernames, lesson and rank ids).
 *
 * This module imports nothing, so `npm run brain:export` can load it.
 */

const hex4 = (character: string) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;

/**
 * A YAML double-quoted scalar. JSON's escaping is valid YAML; on top of it, the characters
 * YAML does not allow raw (DEL, the C1 controls) and the ones some parsers read as line
 * breaks (U+2028, U+2029) or strip (U+FEFF) are escaped too.
 */
export function yamlString(value: string): string {
  return JSON.stringify(value).replace(/[\u007f-\u009f\u2028\u2029\ufeff]/g, hex4);
}

/** A YAML value that may be absent: an empty value, which Obsidian shows as empty. */
export const yamlOptional = (value: string | null): string =>
  value === null ? "" : ` ${yamlString(value)}`;

/**
 * Untrusted text as an inline code span: never a link, a tag, HTML or formatting. The
 * fence is one backtick longer than the longest run inside, and a space separates it from
 * a backtick at either end (CommonMark strips exactly that one space again).
 */
export function codeSpan(value: string): string {
  const text = value.replace(/[\r\n\u2028\u2029]+/g, " ");
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  const pad = /^[` ]|[` ]$/.test(text) ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

/**
 * Text for a link's alias or a heading, from our own lesson and course titles: without
 * the characters that end or re-route a link, start a tag or a block id, or open a comment.
 */
export function plainTitle(value: string): string {
  const cleaned = value
    .replace(/[[\]|#^`<>\r\n]/g, "")
    .replace(/%%/g, "%")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned === "" ? "untitled" : cleaned;
}

/**
 * A wikilink by full path from the vault's root (never ambiguous, whatever other notes
 * are called), with the alias pipe escaped inside a table.
 */
export function wikilink(path: string, alias?: string, options: { inTable?: boolean } = {}) {
  if (!/^[A-Za-z0-9 _./-]+$/.test(path) || path.split("/").some((part) => /^\.|^$/.test(part))) {
    throw new Error("A link path held unexpected characters.");
  }
  if (alias === undefined) return `[[${path}]]`;
  return `[[${path}${options.inTable ? "\\|" : "|"}${alias}]]`;
}

/** Windows refuses these as file names, with or without an extension. */
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])$/i;

/**
 * A file's base name from a username, a member number or an Academy id. Their alphabets
 * cannot reach outside a folder; anything else is refused outright. A name Windows
 * reserves gets a hyphen, which no username has.
 */
export function fileBase(name: string): string {
  if (!/^[a-z0-9_][a-z0-9_-]{0,79}$/.test(name)) {
    throw new Error("A note name held unexpected characters.");
  }
  return WINDOWS_RESERVED.test(name) ? `${name}-` : name;
}
