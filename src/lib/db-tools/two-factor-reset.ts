import type { Query } from "../backup/dump.ts";

/**
 * Turns two-factor off for ONE member who has lost both their authenticator app and their
 * backup codes. `npm run 2fa:reset -- <username>`. Only the owner runs it, at a terminal,
 * and only after making sure it really is that member asking (docs/SECURITY.md, "Turn
 * two-factor off for a member"): whoever talks the owner into running it gets past the
 * member's second factor.
 *
 * It finds the account by its exact ZeroCorps username, what a member tells the owner on
 * Discord, and never by a pattern. In one transaction it removes the app's secret and the
 * backup codes, forgets every browser trusted to skip the code, signs every session out
 * and records the event, which the member then sees in their security activity. Their
 * password, progress and everything else stay as they were.
 *
 * This module imports nothing from the app, so the script in `scripts/` can load it.
 */

/** Must match TRUST_DEVICE_PREFIX in src/lib/auth/two-factor.ts (a test checks that). */
export const TRUST_DEVICE_PREFIX = "trust-device-";

/** The username rule of src/lib/username.ts: anything else cannot name an account. */
const USERNAME = /^[a-z0-9_]{3,20}$/;

export type ResetCandidate = {
  userId: string;
  username: string;
  /** For the notice only. The command prints `maskedEmail`, never this. */
  email: string;
  /** The first letter and the domain, as `maskEmail` shows an address. */
  maskedEmail: string;
  /** The day the account was created, UTC. */
  memberSince: string;
  twoFactorEnabled: boolean;
  discordUsername: string | null;
};

export async function findResetCandidate(
  query: Query,
  input: string,
): Promise<ResetCandidate | null> {
  const username = input.trim().replace(/^@/, "").toLowerCase();
  if (!USERNAME.test(username)) return null;
  const [row] = await query(
    `SELECT u.id::text AS id, u.username, u.email, u.two_factor_enabled,
            to_char(u.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS member_since,
            d.discord_username
       FROM users u
       LEFT JOIN discord_links d ON d.user_id = u.id
      WHERE u.username = $1`,
    [username],
  );
  if (!row) return null;
  const email = String(row.email);
  return {
    userId: String(row.id),
    username: String(row.username),
    email,
    maskedEmail: email.replace(/^(.).*(@.*)$/, "$1***$2"),
    memberSince: String(row.member_since),
    twoFactorEnabled: row.two_factor_enabled === true,
    discordUsername: row.discord_username == null ? null : String(row.discord_username),
  };
}

export type ResetResult = { secrets: number; trustedBrowsers: number; sessions: number };

/** Run inside ONE transaction: all of it happens, or none of it. */
export async function resetTwoFactor(query: Query, userId: string): Promise<ResetResult> {
  const secrets = await query(`DELETE FROM two_factors WHERE user_id = $1::uuid RETURNING id`, [
    userId,
  ]);
  await query(
    `UPDATE users SET two_factor_enabled = false, updated_at = now() WHERE id = $1::uuid`,
    [userId],
  );
  const trusted = await query(
    `DELETE FROM verifications WHERE identifier LIKE $1 AND value = $2 RETURNING id`,
    [`${TRUST_DEVICE_PREFIX}%`, userId],
  );
  const sessions = await query(`DELETE FROM sessions WHERE user_id = $1::uuid RETURNING id`, [
    userId,
  ]);
  // Written from the laptop, so `local`; the detail says it was the owner's command.
  await query(
    `INSERT INTO auth_events (type, user_id, detail, app_env)
     VALUES ('two_factor_reset', $1::uuid, 'owner_command', 'local')`,
    [userId],
  );
  return { secrets: secrets.length, trustedBrowsers: trusted.length, sessions: sessions.length };
}
