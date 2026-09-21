import { authEvents } from "../../db/schema.ts";
import { normalizeEmail } from "../email-address.ts";
import { clientIp, coarseIpPrefix, userAgentFamily } from "./client-info.ts";
import type { AuthDatabase } from "./create-auth.ts";
import { keyedHash } from "./keyed-hash.ts";

/**
 * The security event log (90-day retention, purged by the daily job).
 *
 * It never holds an email address, a raw IP or a raw User-Agent. The address and the
 * IP are stored as keyed hashes, so events about the same address can be grouped
 * without the address being readable, next to a coarse IP prefix and a browser family
 * from a fixed vocabulary. Milestone 4 shows a user their own recent events.
 */

export type AuthEventType =
  | "signup_started"
  | "signup_blocked"
  | "signup_code_failed"
  | "signup_completed"
  | "signin_succeeded"
  | "signin_failed"
  | "reset_requested"
  | "reset_completed"
  | "new_device"
  | "rate_limited"
  | "email_failed"
  | "username_claimed"
  | "username_changed";

export type AuthEventInput = {
  type: AuthEventType;
  userId?: string | null;
  /** An email address. Only its keyed hash is stored. */
  identifier?: string | null;
  headers?: Headers | null;
  /** A short machine-readable reason such as "wrong_code". Never free text. */
  detail?: string | null;
};

export function createEventLog(
  db: AuthDatabase,
  options: { appEnv: string; hmacSecret: string; trustedIpHeader: string },
) {
  return {
    async record(event: AuthEventInput): Promise<void> {
      const ip = clientIp(event.headers, options.trustedIpHeader);
      try {
        await db.insert(authEvents).values({
          type: event.type,
          userId: event.userId ?? null,
          identifierHash: event.identifier
            ? keyedHash(options.hmacSecret, "event-identifier", normalizeEmail(event.identifier))
            : null,
          ipHash: ip ? keyedHash(options.hmacSecret, "event-ip", ip) : null,
          ipPrefix: coarseIpPrefix(ip),
          userAgent: userAgentFamily(event.headers?.get("user-agent")),
          detail: event.detail?.slice(0, 64) ?? null,
          appEnv: options.appEnv,
        });
      } catch (error) {
        // Logging must not take a working sign-in down with it. If the database itself is
        // gone, the request fails anyway, at the limiter or at Better Auth.
        console.error(
          `[auth] could not record a ${event.type} event: ${error instanceof Error ? error.name : "error"}`,
        );
      }
    },
  };
}

export type EventLog = ReturnType<typeof createEventLog>;
