/**
 * The one normalised form of an email address: trimmed and lower-cased.
 *
 * Pending sign-ups, the abuse counters, the allowlists and Better Auth all use this
 * form, so one person is never matched or counted as two. Better Auth lower-cases
 * addresses itself; trimming first makes our side agree with it exactly.
 *
 * This module has no imports on purpose: the scripts in `scripts/` load it directly.
 */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

const EMAIL_SHAPE = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;

/** A deliberately loose shape check. Real validation is the code we email to it. */
export function looksLikeEmail(input: string): boolean {
  return input.length <= 254 && EMAIL_SHAPE.test(input);
}

/**
 * Parses a comma-separated list of addresses (an allowlist in an environment
 * variable) into normalised, de-duplicated addresses. Returns `null` if any entry
 * is not shaped like an address, so the caller can refuse to start.
 */
export function parseEmailList(input: string | undefined): string[] | null {
  if (input === undefined) return [];
  const entries = input
    .split(",")
    .map(normalizeEmail)
    .filter((entry) => entry !== "");
  if (!entries.every(looksLikeEmail)) return null;
  return [...new Set(entries)];
}
