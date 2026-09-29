/**
 * The optional name a member is shown by, beside their unique `@username`.
 *
 * It is free text, so people can write their own name properly, in any language. That
 * freedom is exactly why it needs a guard: a display name sits next to a username on the
 * screen, and a few invisible characters can make one member appear to be another.
 *
 * So three kinds of character are refused outright, none of which a real name contains:
 *
 * - **direction overrides** (U+202A..U+202E, U+2066..U+2069), which reverse how the rest
 *   of a line is drawn and can make "admin" read out of a harmless-looking string;
 * - **zero-width and invisible characters**, which pad a name so that two different names
 *   look identical;
 * - **control characters and line breaks**, which break the layout wherever it is shown.
 *
 * Ordinary spacing is tidied rather than refused: the name is trimmed, and runs of spaces
 * become one, so " Jane   Doe " and "Jane Doe" cannot sit side by side as two members.
 *
 * This module has no imports on purpose: the scripts in `scripts/` load it directly.
 */

export const DISPLAY_NAME_MAX = 40;

/** Direction overrides, zero-width characters, and the byte-order mark. */
const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff\u00ad\u180e\u061c]/u;
/** C0 and C1 control characters, which include every kind of line break. */
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;

export type DisplayNameProblem = "too-long" | "hidden-characters";

export type DisplayNameCheck =
  { ok: true; displayName: string } | { ok: false; problem: DisplayNameProblem; message: string };

const MESSAGES: Record<DisplayNameProblem, string> = {
  "too-long": `At most ${DISPLAY_NAME_MAX} characters.`,
  "hidden-characters": "Please use ordinary characters only.",
};

/** Trims, and turns any run of spacing into a single space. */
export function normalizeDisplayName(input: string): string {
  return input.replace(/\s+/gu, " ").trim();
}

/**
 * Checks a display name. An empty one is fine: the field is optional, and a member who
 * leaves it blank is shown by their username alone.
 */
export function checkDisplayName(input: string): DisplayNameCheck {
  const refuse = (problem: DisplayNameProblem): DisplayNameCheck => ({
    ok: false,
    problem,
    message: MESSAGES[problem],
  });

  // Look for the dangerous characters BEFORE tidying, so nothing is quietly let through.
  if (INVISIBLE.test(input) || CONTROL.test(input)) return refuse("hidden-characters");

  const displayName = normalizeDisplayName(input);
  // Counted in code points, so one emoji or accented letter is one character.
  if ([...displayName].length > DISPLAY_NAME_MAX) return refuse("too-long");

  return { ok: true, displayName };
}
