import { and, eq, gt, ne, or } from "drizzle-orm";
import { users } from "../../db/schema.ts";
import { checkUsername, normalizeUsername } from "../username.ts";
import type { AuthDatabase } from "./create-auth.ts";

/**
 * Claiming a username, and changing one later.
 *
 * Three things are guarded here, and each is guarded where it cannot be raced:
 *
 * 1. **Two people cannot end up with one name.** The unique index on `users.username` is
 *    what decides that. So for a name in use there is NO check before the write: the write
 *    is attempted, and the database's refusal is read as "taken". A check first would be
 *    true for two people at the same instant, and it would also mean the path that really
 *    protects the name was the one the tests exercised least.
 * 2. **A name somebody just left is held**, for `HOLD_DAYS`, so nobody can pick it up and
 *    pass themselves off as them. The index cannot see a held name, so that one IS checked
 *    here. The hold is worked out from `username_changed_at`, not from a flag, so it ends
 *    on time even if nothing runs to tidy it.
 * 3. **A name cannot churn.** After the first change there is a wait of `COOLDOWN_DAYS`.
 *    The FIRST change is free: someone who mistypes their name at onboarding should be
 *    able to put it right, and only then does the wait begin. The member's row is locked
 *    while this is judged, so two requests at once cannot both pass.
 *
 * Letting go of a hold that has run out is the daily cleanup's job, in `cleanup.ts`.
 */

/** How long a name somebody has left is kept out of everyone else's reach. */
export const HOLD_DAYS = 30;
/** How long after a change before the next one is allowed. The first change is free. */
export const COOLDOWN_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

export type ClaimRefusal = "invalid" | "taken" | "too-soon";

export type ClaimResult =
  | { ok: true; username: string; changed: boolean }
  | { ok: false; refusal: ClaimRefusal; message: string; availableAt?: Date };

/**
 * Postgres says 23505 when a unique index refuses a row. Drizzle wraps the driver's error,
 * so the code may sit a few `cause`s down.
 */
function isUniqueViolation(error: unknown): boolean {
  for (let cause: unknown = error, depth = 0; cause && depth < 5; depth++) {
    const candidate = cause as { code?: unknown; cause?: unknown; message?: unknown };
    if (candidate.code === "23505") return true;
    if (typeof candidate.message === "string" && /users_username_unique/.test(candidate.message)) {
      return true;
    }
    cause = candidate.cause;
  }
  return false;
}

const taken = (): ClaimResult => ({
  ok: false,
  refusal: "taken",
  message: "That name is taken. Please choose another.",
});

/** Held by somebody ELSE: they left it less than `HOLD_DAYS` ago. */
const heldByAnother = (username: string, now: Date, exceptUserId?: string) =>
  and(
    eq(users.previousUsername, username),
    gt(users.usernameChangedAt, new Date(now.getTime() - HOLD_DAYS * DAY)),
    exceptUserId ? ne(users.id, exceptUserId) : undefined,
  );

/**
 * Is this name free to take, as far as anybody can know before trying? It is what the
 * "free / taken" hint is drawn from while a member types. It promises nothing: only the
 * write decides, and `setUsername` does not rely on this for a name in use.
 *
 * `forUserId` is the member asking, so their own name and their own held name read as free.
 */
export async function isUsernameAvailable(
  db: AuthDatabase,
  rawUsername: string,
  now: Date,
  forUserId?: string,
): Promise<boolean> {
  const check = checkUsername(rawUsername);
  if (!check.ok) return false;

  const inUse = and(
    eq(users.username, check.username),
    forUserId ? ne(users.id, forUserId) : undefined,
  );
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(or(inUse, heldByAnother(check.username, now, forUserId)))
    .limit(1);
  return rows.length === 0;
}

/**
 * When this member may next change their name, or `null` if they may now. It is what the
 * settings page shows. Like the hint above it promises nothing: `setUsername` judges the
 * wait itself, under a lock.
 */
export async function nextUsernameChangeAt(
  db: AuthDatabase,
  userId: string,
  now: Date,
): Promise<Date | null> {
  const [member] = await db
    .select({ changedAt: users.usernameChangedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!member?.changedAt) return null;
  const availableAt = new Date(member.changedAt.getTime() + COOLDOWN_DAYS * DAY);
  return availableAt > now ? availableAt : null;
}

class Refused extends Error {
  constructor(readonly result: ClaimResult) {
    super("refused");
  }
}

/**
 * Claims a name for a member, or changes the one they have, in ONE transaction of its own.
 *
 * Nothing about the member is taken from the caller: their current name and when they last
 * changed it are read here, under a row lock.
 */
export async function setUsername(
  db: AuthDatabase,
  options: { userId: string; username: string; now: Date },
): Promise<ClaimResult> {
  const { userId, now } = options;
  const check = checkUsername(options.username);
  if (!check.ok) return { ok: false, refusal: "invalid", message: check.message };
  const username = check.username;

  try {
    return await db.transaction(async (tx) => {
      // Locked, so a second request from the same member waits here rather than racing.
      const [member] = await tx
        .select({ username: users.username, changedAt: users.usernameChangedAt })
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
      if (!member) {
        throw new Refused({ ok: false, refusal: "invalid", message: "No such account." });
      }

      const current = member.username === null ? null : normalizeUsername(member.username);
      if (current === username) return { ok: true as const, username, changed: false };

      if (member.changedAt !== null) {
        const availableAt = new Date(member.changedAt.getTime() + COOLDOWN_DAYS * DAY);
        if (availableAt > now) {
          throw new Refused({
            ok: false,
            refusal: "too-soon",
            message: `You can change your username again after ${availableAt.toISOString().slice(0, 10)}.`,
            availableAt,
          });
        }
      }

      // The one thing the unique index cannot see: a name somebody else has just left.
      const held = await tx
        .select({ id: users.id })
        .from(users)
        .where(heldByAnother(username, now, userId))
        .limit(1);
      if (held.length > 0) throw new Refused(taken());

      // The FIRST claim is not a change: it sets no date, so one correction is still free.
      const isFirstClaim = current === null;
      await tx
        .update(users)
        .set(
          isFirstClaim
            ? { username, updatedAt: now }
            : { username, previousUsername: current, usernameChangedAt: now, updatedAt: now },
        )
        .where(eq(users.id, userId));

      return { ok: true as const, username, changed: !isFirstClaim };
    });
  } catch (error) {
    if (error instanceof Refused) return error.result;
    // Somebody else has this name. The transaction has rolled back. THIS is the guard.
    if (isUniqueViolation(error)) return taken();
    throw error;
  }
}
