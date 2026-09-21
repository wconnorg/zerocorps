import { checkUsername, normalizeUsername } from "../username.ts";
import type { Query } from "../backup/dump.ts";

/**
 * Claiming a username, and changing one later.
 *
 * Three things are guarded here, and each is guarded where it cannot be raced:
 *
 * 1. **Two people cannot end up with one name.** The unique index on `users.username` is
 *    what decides that, not the check in the browser and not the one below: both of those
 *    can be true for two people at the same instant. So the write is attempted and a
 *    unique violation is READ AS "taken". That is the whole race handled, in one place.
 * 2. **A name somebody just left is held**, for `HOLD_DAYS`, so nobody can pick it up and
 *    pass themselves off as them. The hold is worked out from `username_changed_at`, not
 *    from a flag, so it expires on time even if nothing runs to tidy it.
 * 3. **A name cannot churn.** After the first change there is a wait of `COOLDOWN_DAYS`.
 *    The FIRST change is free: someone who mistypes their name at onboarding should be
 *    able to put it right, and only then does the wait begin.
 *
 * The caller supplies the query function and, for a change, its own transaction, so a
 * failed claim leaves nothing behind.
 *
 * Letting go of a hold that has run out is the daily cleanup's job, in `cleanup.ts`.
 *
 * This module imports nothing from the app, so it can be tested on PGlite alone.
 */

/** How long a name somebody has left is kept out of everyone else's reach. */
export const HOLD_DAYS = 30;
/** How long after a change before the next one is allowed. The first change is free. */
export const COOLDOWN_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;
/** Postgres says 23505 when a unique index refuses a row. */
const UNIQUE_VIOLATION = "23505";

export type ClaimRefusal = "invalid" | "taken" | "too-soon";

export type ClaimResult =
  | { ok: true; username: string; changed: boolean }
  | { ok: false; refusal: ClaimRefusal; message: string; availableAt?: Date };

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: string }).code === UNIQUE_VIOLATION;

const taken = (): ClaimResult => ({
  ok: false,
  refusal: "taken",
  message: "That name is taken. Please choose another.",
});

/**
 * Is this name free for this member to take? It answers for the name's SHAPE and for what
 * is in the database right now, which is all anybody can know before the write is tried.
 *
 * `forUserId` is the member asking, so their own current name reads as free: re-typing the
 * name you already have is not a clash.
 */
export async function isUsernameAvailable(
  query: Query,
  rawUsername: string,
  now: Date,
  forUserId?: string,
): Promise<boolean> {
  const check = checkUsername(rawUsername);
  if (!check.ok) return false;

  const heldSince = new Date(now.getTime() - HOLD_DAYS * DAY);
  const rows = await query(
    `SELECT 1
       FROM users
      WHERE ($2::uuid IS NULL OR id <> $2::uuid)
        AND (username = $1 OR (previous_username = $1 AND username_changed_at > $3))
      LIMIT 1`,
    [check.username, forUserId ?? null, heldSince.toISOString()],
  );
  return rows.length === 0;
}

/**
 * Claims a name for a member, or changes the one they have.
 *
 * Nothing about the member is read from the caller: their current name and when they last
 * changed it are read here, inside the caller's transaction, so two requests from the same
 * person cannot both pass the wait.
 */
export async function setUsername(
  query: Query,
  options: { userId: string; username: string; now: Date },
): Promise<ClaimResult> {
  const { userId, now } = options;
  const check = checkUsername(options.username);
  if (!check.ok) return { ok: false, refusal: "invalid", message: check.message };
  const username = check.username;

  // Locked, so a second request from the same member waits here rather than racing.
  const [member] = await query(
    `SELECT username, username_changed_at FROM users WHERE id = $1::uuid FOR UPDATE`,
    [userId],
  );
  if (!member) return { ok: false, refusal: "invalid", message: "No such account." };

  const current = member.username === null ? null : normalizeUsername(String(member.username));
  if (current === username) return { ok: true, username, changed: false };

  const changedAt = member.username_changed_at
    ? new Date(String(member.username_changed_at))
    : null;
  if (changedAt !== null) {
    const availableAt = new Date(changedAt.getTime() + COOLDOWN_DAYS * DAY);
    if (availableAt > now) {
      return {
        ok: false,
        refusal: "too-soon",
        message: `You can change your username again after ${availableAt.toISOString().slice(0, 10)}.`,
        availableAt,
      };
    }
  }

  // Held by somebody else? The unique index cannot see this, so it is checked here.
  if (!(await isUsernameAvailable(query, username, now, userId))) return taken();

  // The FIRST claim is not a change: it sets no date, so one correction is still free.
  const isFirstClaim = current === null;
  try {
    const written = await query(
      `UPDATE users
          SET username = $2,
              previous_username = CASE WHEN $4::boolean THEN previous_username ELSE username END,
              username_changed_at = CASE WHEN $4::boolean THEN username_changed_at ELSE $3 END,
              updated_at = $3
        WHERE id = $1::uuid
      RETURNING id`,
      [userId, username, now.toISOString(), isFirstClaim],
    );
    if (written.length === 0) return { ok: false, refusal: "invalid", message: "No such account." };
  } catch (error) {
    // Somebody else took it between the check above and this write. This is the real guard.
    if (isUniqueViolation(error)) return taken();
    throw error;
  }

  return { ok: true, username, changed: !isFirstClaim };
}
