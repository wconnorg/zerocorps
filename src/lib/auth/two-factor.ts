import { twoFactor } from "better-auth/plugins/two-factor";
import { and, eq, like } from "drizzle-orm";
import { verifications } from "../../db/schema.ts";
import type { AuthDatabase } from "./create-auth.ts";

/**
 * Two-factor (milestone 5): a code from an authenticator app after the password, backup
 * codes, and "trust this device for 30 days". All of it is Better Auth's own two-factor
 * plugin; this file holds its settings and two small helpers.
 *
 * App codes only (the owner, 2026-09-29): no text messages and no phone numbers. Without
 * `otpOptions.sendOTP` the plugin refuses `method: "otp"`, and its text-code endpoints are
 * switched off in create-auth.ts (DISABLED_PATHS).
 */

const DAY = 60 * 60 * 24;

export const TRUST_DEVICE_DAYS = 30;
/** How long the code screen waits after a correct password before it has to start again. */
export const CHALLENGE_MINUTES = 10;
export const BACKUP_CODE_COUNT = 10;

/** What changed, for the security notice the member gets by email. */
export type TwoFactorChange =
  "enabled" | "disabled" | "backup-codes" | "backup-code-used" | "reset";

export type TwoFactorMailer = {
  sendTwoFactorChanged(message: { to: string; change: TwoFactorChange }): Promise<void>;
};

export function twoFactorPlugin() {
  return twoFactor({
    // The name the authenticator app shows next to the code.
    issuer: "ZeroCorps",
    totpOptions: { digits: 6, period: 30 },
    // Encrypted with BETTER_AUTH_SECRET, like the app's secret. Rotating that secret needs
    // its runbook in docs/SECURITY.md, or every member with two-factor is locked out.
    backupCodeOptions: { amount: BACKUP_CODE_COUNT, length: 10, storeBackupCodes: "encrypted" },
    trustDeviceMaxAge: TRUST_DEVICE_DAYS * DAY,
    twoFactorCookieMaxAge: CHALLENGE_MINUTES * 60,
    // The defaults, spelled out: 10 wrong codes in a row lock the code screen for 15 minutes,
    // across every challenge (5 tries each) and both kinds of code.
    accountLockout: { enabled: true, maxFailedAttempts: 10, durationSeconds: 15 * 60 },
    // Two-factor is on only once the member has typed a first code from the app.
    skipVerificationOnEnable: false,
  });
}

/**
 * Better Auth keeps each trusted browser as a `verifications` row named `trust-device-…`
 * whose value is the member's id (a test pins this). It forgets only the CURRENT browser
 * when two-factor is turned off, so every other one is forgotten here: otherwise turning
 * two-factor back on would find browsers that still skip the code.
 */
export const TRUST_DEVICE_PREFIX = "trust-device-";

export async function forgetTrustedDevices(db: AuthDatabase, userId: string): Promise<number> {
  const removed = await db
    .delete(verifications)
    .where(
      and(
        like(verifications.identifier, `${TRUST_DEVICE_PREFIX}%`),
        eq(verifications.value, userId),
      ),
    )
    .returning({ id: verifications.id });
  return removed.length;
}

type ChallengeContext = {
  context: {
    secret: string;
    createAuthCookie: (name: string) => { name: string };
    internalAdapter: {
      findVerificationValue: (
        identifier: string,
      ) => Promise<{ value: string; expiresAt: Date } | null | undefined>;
    };
  };
  getSignedCookie: (name: string, secret: string) => Promise<string | null | false | undefined>;
};

/**
 * Whose sign-in the code screen is finishing: the member id behind this browser's signed
 * `two_factor` cookie, or null when there is none or it has run out. The same lookup the
 * plugin makes, so an event can name the member before the plugin answers.
 */
export async function pendingTwoFactorUserId(ctx: ChallengeContext): Promise<string | null> {
  const cookie = ctx.context.createAuthCookie("two_factor");
  const identifier = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
  if (!identifier) return null;
  const record = await ctx.context.internalAdapter.findVerificationValue(identifier);
  if (!record || record.expiresAt.getTime() <= Date.now()) return null;
  return record.value;
}
