import { eq } from "drizzle-orm";
import { discordLinks } from "../../db/schema.ts";
import type { AuthDatabase } from "../auth/create-auth.ts";

/**
 * A member's link to their Discord account: the Discord id, the Discord username and when
 * it was linked, and nothing else (hard rule 5). One Discord account per ZeroCorps account
 * and one ZeroCorps account per Discord account: the unique index decides that, not a
 * check before it.
 */

export type DiscordLink = { discordId: string; discordUsername: string; linkedAt: Date };

export async function getDiscordLink(
  db: AuthDatabase,
  userId: string,
): Promise<DiscordLink | null> {
  const [row] = await db
    .select({
      discordId: discordLinks.discordId,
      discordUsername: discordLinks.discordUsername,
      linkedAt: discordLinks.linkedAt,
    })
    .from(discordLinks)
    .where(eq(discordLinks.userId, userId))
    .limit(1);
  return row ?? null;
}

function isUniqueViolation(error: unknown): boolean {
  for (let cause: unknown = error, depth = 0; cause && depth < 5; depth++) {
    const candidate = cause as { code?: unknown; cause?: unknown };
    if (candidate.code === "23505") return true;
    cause = candidate.cause;
  }
  return false;
}

/**
 * Links a member's Discord account, or replaces the one they had linked. Refused, and
 * nothing changes, when that Discord account is already linked to somebody else.
 */
export async function saveDiscordLink(
  db: AuthDatabase,
  link: { userId: string; discordId: string; discordUsername: string; now: Date },
): Promise<{ ok: true; replaced: DiscordLink | null } | { ok: false; reason: "taken" }> {
  const previous = await getDiscordLink(db, link.userId);
  try {
    await db
      .insert(discordLinks)
      .values({
        userId: link.userId,
        discordId: link.discordId,
        discordUsername: link.discordUsername,
        linkedAt: link.now,
      })
      .onConflictDoUpdate({
        target: discordLinks.userId,
        set: {
          discordId: link.discordId,
          discordUsername: link.discordUsername,
          linkedAt: link.now,
        },
      });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "taken" };
    throw error;
  }
  const replaced = previous && previous.discordId !== link.discordId ? previous : null;
  return { ok: true, replaced };
}

/** Unlinks. Returns what was linked, so its roles can be taken back. */
export async function removeDiscordLink(
  db: AuthDatabase,
  userId: string,
): Promise<DiscordLink | null> {
  const [row] = await db.delete(discordLinks).where(eq(discordLinks.userId, userId)).returning({
    discordId: discordLinks.discordId,
    discordUsername: discordLinks.discordUsername,
    linkedAt: discordLinks.linkedAt,
  });
  return row ?? null;
}
