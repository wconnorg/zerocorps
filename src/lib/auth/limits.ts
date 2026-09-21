import { sql } from "drizzle-orm";
import { abuseCounters } from "../../db/schema.ts";
import type { AuthDatabase } from "./create-auth.ts";
import { keyedHash } from "./keyed-hash.ts";

/**
 * Our own abuse limits. They are about EMAIL ADDRESSES, not about IP addresses.
 *
 * People are never recognised, blocked or trusted by IP: VPNs, mobile carriers and
 * campuses put thousands of people behind one address. So the per-IP numbers are
 * loose throttles, and the tight numbers are per address. Better Auth's own limiter
 * (per IP and path) sits in front of all of this as a coarse backstop.
 *
 * Fail closed: a limit that cannot be checked throws, and the request is refused.
 */

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const LIMITS = {
  /** Also bounds code guessing: every pending sign-up allows 5 guesses at 1 in a million. */
  signUpStartPerAddress: { window: HOUR, max: 3 },
  signUpStartPerIp: { window: HOUR, max: 20 },
  signInPerAddressAndIp: { window: 15 * MINUTE, max: 10 },
  signInPerAddress: { window: HOUR, max: 50 },
  passwordResetPerAddress: { window: HOUR, max: 3 },
  passwordResetPerIp: { window: HOUR, max: 20 },
  /** One cap across ALL email types. Security notices are counted but never blocked. */
  emailsPerAddressPerDay: { window: DAY, max: 10 },
  /**
   * The "free / taken" hint while a member types. Generous for a person choosing a name,
   * far too slow to harvest the list of names with. Counted per MEMBER, never per IP.
   */
  usernameCheckPerUser: { window: 10 * MINUTE, max: 60 },
  profileSavePerUser: { window: HOUR, max: 20 },
} as const;

export type LimitName = keyof typeof LIMITS;
export type LimitResult = { allowed: boolean; count: number; retryAfterSeconds: number };

export function createLimiter(db: AuthDatabase, hmacSecret: string) {
  return {
    /**
     * Counts one use and says whether it is within the limit. One atomic statement: an
     * upsert that either starts a new window or adds to the current one, so concurrent
     * requests cannot all read a stale count and slip through.
     */
    async hit(name: LimitName, identifier: string): Promise<LimitResult> {
      const rule = LIMITS[name];
      // The rule name is part of the hashed key, and no identifier is stored in the clear.
      const key = keyedHash(hmacSecret, "abuse-limit", `${name}\n${identifier}`);
      const expired = sql`${abuseCounters.expiresAt} <= now()`;
      const windowEnd = sql`now() + make_interval(secs => ${rule.window})`;

      const [row] = await db
        .insert(abuseCounters)
        .values({ key, count: 1, windowStartedAt: sql`now()`, expiresAt: windowEnd })
        .onConflictDoUpdate({
          target: abuseCounters.key,
          set: {
            count: sql`CASE WHEN ${expired} THEN 1 ELSE ${abuseCounters.count} + 1 END`,
            windowStartedAt: sql`CASE WHEN ${expired} THEN now() ELSE ${abuseCounters.windowStartedAt} END`,
            expiresAt: sql`CASE WHEN ${expired} THEN ${windowEnd} ELSE ${abuseCounters.expiresAt} END`,
          },
        })
        .returning({
          count: abuseCounters.count,
          retryAfterSeconds: sql<number>`ceil(extract(epoch FROM ${abuseCounters.expiresAt} - now()))::int`,
        });

      if (!row) throw new Error("The limiter returned no row; refusing the request.");
      return {
        allowed: row.count <= rule.max,
        count: row.count,
        retryAfterSeconds: Math.max(1, Number(row.retryAfterSeconds)),
      };
    },
  };
}

export type Limiter = ReturnType<typeof createLimiter>;

/** The kinds of email we send. Security notices must always get through. */
export type EmailKind =
  "signup-code" | "already-registered" | "password-reset" | "password-changed" | "new-device";

const SECURITY_NOTICES: ReadonlySet<EmailKind> = new Set(["password-changed", "new-device"]);

/**
 * The daily cap on email to one address, across every kind. It answers whether THIS
 * email may be sent. A security notice is counted like any other, but it is never
 * held back: a person must always hear that their password changed.
 */
export function createEmailBudget(limiter: Limiter) {
  return {
    async allow(address: string, kind: EmailKind): Promise<boolean> {
      const { allowed } = await limiter.hit("emailsPerAddressPerDay", address);
      return allowed || SECURITY_NOTICES.has(kind);
    },
  };
}

export type EmailBudget = ReturnType<typeof createEmailBudget>;
