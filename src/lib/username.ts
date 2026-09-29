/**
 * What a username may be. One place, used by the browser as it is typed, by the server
 * when a name is claimed, and by the database constraint that is the real guard.
 *
 * The rules come from the brief: 3 to 20 characters, `a-z 0-9 _`, stored lower-cased,
 * unique without regard to case. The narrow alphabet is itself a security control: with
 * no Unicode, nobody can register a name that merely LOOKS like someone else's (a Cyrillic
 * "а" beside a Latin "a"), which is the usual way impersonation starts.
 *
 * This module has no imports on purpose: the scripts in `scripts/` load it directly.
 */

/** The one normalised form: trimmed and lower-cased, as addresses are. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** Must match the CHECK constraint on `users.username`. A test proves the two agree. */
export const USERNAME_SHAPE = /^[a-z0-9_]{3,20}$/;

/**
 * Names nobody may take. Two kinds, both about impersonation:
 *
 * - the brand and the people who run it, so no member can pass for ZeroCorps or its staff;
 * - words the site itself uses as paths, so a name can never be mistaken for a page.
 *
 * Underscores are ignored when matching, so `z_e_r_o_c_o_r_p_s` is refused along with
 * `zerocorps`. The owner may add to this list at any time; it is only read when a name is
 * claimed, so a later addition never breaks a name somebody already has.
 *
 * **Every entry must itself be a name somebody could otherwise have taken.** A word that
 * is too short or badly shaped to be a username is dead weight that hides a real mistake,
 * and a test refuses one. That is why `me` is not here: no name may be two letters.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // The brand and its products
  "zerocorps",
  "zero",
  "corps",
  "zerobot",
  "zerocharts",
  "academy",
  "zeroacademy",
  "agentzero",
  // Whoever runs it
  "admin",
  "administrator",
  "root",
  "owner",
  "staff",
  "team",
  "official",
  "mod",
  "moderator",
  "support",
  "help",
  "helpdesk",
  "security",
  "abuse",
  "billing",
  "moderation",
  // The site's own words
  "api",
  "auth",
  "login",
  "signin",
  "signup",
  "logout",
  "signout",
  "register",
  "dashboard",
  "onboarding",
  "settings",
  "account",
  "accounts",
  "profile",
  "user",
  "users",
  "terms",
  "privacy",
  "legal",
  "about",
  "contact",
  "discord",
  "static",
  "public",
  "assets",
  "cdn",
  "www",
  "mail",
  "email",
  "webmaster",
  "postmaster",
  "noreply",
  "system",
  "bot",
  "null",
  "undefined",
  "anonymous",
  "guest",
  "test",
  "new",
  "edit",
  "delete",
]);

export type UsernameProblem =
  "too-short" | "too-long" | "bad-characters" | "no-letter-or-digit" | "reserved";

export type UsernameCheck =
  { ok: true; username: string } | { ok: false; problem: UsernameProblem; message: string };

/** One sentence per problem, shown to the member as they type. */
const MESSAGES: Record<UsernameProblem, string> = {
  "too-short": `At least ${USERNAME_MIN} characters.`,
  "too-long": `At most ${USERNAME_MAX} characters.`,
  "bad-characters": "Letters a to z, numbers and underscores only.",
  "no-letter-or-digit": "Needs at least one letter or number.",
  reserved: "That one is reserved. Please choose another.",
};

/**
 * Checks a name's SHAPE. It says nothing about whether the name is free: only the
 * database can answer that, and only at the moment it is claimed.
 */
export function checkUsername(input: string): UsernameCheck {
  const username = normalizeUsername(input);
  const refuse = (problem: UsernameProblem): UsernameCheck => ({
    ok: false,
    problem,
    message: MESSAGES[problem],
  });

  // Length first, so a name that is merely too short is not also called badly spelled.
  if (username.length < USERNAME_MIN) return refuse("too-short");
  if (username.length > USERNAME_MAX) return refuse("too-long");
  if (!USERNAME_SHAPE.test(username)) return refuse("bad-characters");
  // A name of underscores alone reads as blank wherever it is shown.
  if (!/[a-z0-9]/.test(username)) return refuse("no-letter-or-digit");
  if (isReserved(username)) return refuse("reserved");

  return { ok: true, username };
}

/** Underscores are ignored, so `a_d_m_i_n` is refused along with `admin`. */
export function isReserved(username: string): boolean {
  const normalized = normalizeUsername(username);
  return RESERVED_USERNAMES.has(normalized) || RESERVED_USERNAMES.has(normalized.replace(/_/g, ""));
}
