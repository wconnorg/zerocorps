import { and, desc, eq, gt, isNotNull } from "drizzle-orm";
import { authEvents, sessions } from "../../db/schema.ts";
import type { AuthDatabase } from "./create-auth.ts";

/**
 * What settings shows a member about their own account (milestone 4): the devices signed
 * in, and recent security activity. Read on the server; the browser never receives a
 * session token, only each session's id, which signs nobody in.
 */

export type Device = {
  id: string;
  /** The browser family stored at sign-in ("Chrome on Windows"), never the raw header. */
  device: string;
  /** A coarse prefix, never the full address. */
  network: string | null;
  signedInAt: Date;
  lastActiveAt: Date;
  current: boolean;
};

export async function listDevices(
  db: AuthDatabase,
  userId: string,
  currentSessionId: string,
  now = new Date(),
): Promise<Device[]> {
  const rows = await db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      createdAt: sessions.createdAt,
      updatedAt: sessions.updatedAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
    .orderBy(desc(sessions.updatedAt));
  return rows
    .map((row) => ({
      id: row.id,
      device: row.userAgent || "An unknown browser",
      network: row.ipAddress,
      signedInAt: row.createdAt,
      lastActiveAt: row.updatedAt,
      current: row.id === currentSessionId,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

export type Activity = {
  type: string;
  at: Date;
  device: string | null;
  network: string | null;
};

/** The member's own recent security events, newest first. */
export async function recentActivity(
  db: AuthDatabase,
  userId: string,
  limit = 15,
): Promise<Activity[]> {
  return db
    .select({
      type: authEvents.type,
      at: authEvents.createdAt,
      device: authEvents.userAgent,
      network: authEvents.ipPrefix,
    })
    .from(authEvents)
    .where(and(eq(authEvents.userId, userId), isNotNull(authEvents.userId)))
    .orderBy(desc(authEvents.createdAt))
    .limit(limit);
}

/** Each event, in words a member reads. An event not listed here is not shown. */
export const ACTIVITY_WORDS: Readonly<Record<string, string>> = {
  signup_completed: "Account created",
  signin_succeeded: "Signed in",
  new_device: "Signed in from a new browser",
  reset_completed: "Password reset by email",
  password_changed: "Password changed",
  username_claimed: "Username chosen",
  username_changed: "Username changed",
  discord_linked: "Discord linked",
  discord_unlinked: "Discord unlinked",
  session_revoked: "A device signed out",
  other_sessions_revoked: "Signed out everywhere else",
  rate_limited: "Too many attempts: paused for a while",
};
