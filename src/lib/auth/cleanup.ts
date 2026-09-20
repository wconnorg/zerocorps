import { lt, sql } from "drizzle-orm";
import {
  abuseCounters,
  authEvents,
  knownDevices,
  pendingSignups,
  rateLimits,
  sessions,
  verifications,
} from "../../db/schema.ts";
import type { AuthDatabase } from "./create-auth.ts";

/**
 * The daily cleanup. Everything here has simply run out: nothing a member could still
 * use is ever removed. It also keeps the database active, which matters while it is on
 * a plan that pauses idle projects.
 *
 * These are the only routine deletes in the app, and they run as `zerocorps_app`.
 */

export const EVENT_RETENTION_DAYS = 90;
/** The longest a device cookie can live. A device not seen for this long has lost its cookie. */
export const KNOWN_DEVICE_RETENTION_DAYS = 400;

export type CleanupResult = Record<
  | "pendingSignups"
  | "verifications"
  | "sessions"
  | "rateLimits"
  | "abuseCounters"
  | "authEvents"
  | "knownDevices",
  number
>;

export async function runCleanup(db: AuthDatabase): Promise<CleanupResult> {
  const now = sql`now()`;
  const removed = async (rows: Promise<unknown[]>) => (await rows).length;

  return {
    pendingSignups: await removed(
      db
        .delete(pendingSignups)
        .where(lt(pendingSignups.expiresAt, now))
        .returning({ id: pendingSignups.id }),
    ),
    verifications: await removed(
      db
        .delete(verifications)
        .where(lt(verifications.expiresAt, now))
        .returning({ id: verifications.id }),
    ),
    sessions: await removed(
      db.delete(sessions).where(lt(sessions.expiresAt, now)).returning({ id: sessions.id }),
    ),
    // Better Auth's own limiter stores milliseconds since 1970. Nothing it counts lasts a day.
    rateLimits: await removed(
      db
        .delete(rateLimits)
        .where(
          lt(
            rateLimits.lastRequest,
            sql`(extract(epoch FROM now() - interval '1 day') * 1000)::bigint`,
          ),
        )
        .returning({ id: rateLimits.id }),
    ),
    abuseCounters: await removed(
      db
        .delete(abuseCounters)
        .where(lt(abuseCounters.expiresAt, now))
        .returning({ key: abuseCounters.key }),
    ),
    authEvents: await removed(
      db
        .delete(authEvents)
        .where(
          lt(authEvents.createdAt, sql`now() - make_interval(days => ${EVENT_RETENTION_DAYS})`),
        )
        .returning({ id: authEvents.id }),
    ),
    knownDevices: await removed(
      db
        .delete(knownDevices)
        .where(
          lt(
            knownDevices.lastSeenAt,
            sql`now() - make_interval(days => ${KNOWN_DEVICE_RETENTION_DAYS})`,
          ),
        )
        .returning({ id: knownDevices.id }),
    ),
  };
}

/**
 * /.well-known/security.txt (RFC 9116). `Contact` and `Expires` are the required
 * fields. The contact comes from an environment variable: a published address must be
 * one that works, so it is never hard-coded.
 */
export function buildSecurityTxt(options: { contact: string; siteUrl: string; now: Date }): string {
  const expires = new Date(options.now.getTime() + 364 * 24 * 60 * 60 * 1000);
  return [
    "# Found a security problem in zerocorps.org? Thank you for telling us first.",
    `Contact: ${options.contact}`,
    `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, "Z")}`,
    "Preferred-Languages: en",
    `Canonical: ${options.siteUrl}/.well-known/security.txt`,
    "",
  ].join("\n");
}
