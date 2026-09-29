import { and, count, eq, isNotNull } from "drizzle-orm";
import { discordLinks, rankHistory, users } from "../../db/schema.ts";
import { readProgress } from "../academy/progress.ts";
import { rankKeyOf } from "../academy/standing.ts";
import type { AuthDatabase } from "../auth/create-auth.ts";
import { safeEqual } from "../auth/keyed-hash.ts";
import type { Limiter } from "../auth/limits.ts";
import { SNOWFLAKE } from "../discord/discord-api.ts";

/**
 * The internal API Agent Zero calls (milestone 8, the brief's contract):
 *
 *   GET /api/internal/discord/:discordId/profile  -> { linked, username, rank } or 404
 *   GET /api/internal/stats                       -> { academyMembers }
 *
 * Machine to machine, so no session and no cookies: the caller sends the shared secret in
 * `X-Internal-Secret`, compared in constant time. With no secret configured the API is
 * switched off and refuses everything (fail closed). It never returns an email, a phone
 * number or anything beyond the fields above; `username` is the ZeroCorps username
 * (DECISIONS.md), and `rank` is the rank key the roles follow, or null.
 *
 * The handling lives here, away from Next, so the tests run it as it runs.
 */

export type InternalDeps = {
  db: AuthDatabase;
  limiter: Limiter;
  /** `INTERNAL_API_SECRET`. Undefined: the API is off. */
  secret: string | undefined;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/** The secret check and the limiter, shared by both routes. Null means "go on". */
async function gate(deps: InternalDeps, request: Request): Promise<Response | null> {
  if (!deps.secret) return json(503, { error: "disabled" });
  const sent = request.headers.get("x-internal-secret") ?? "";
  if (!safeEqual(sent, deps.secret)) return json(401, { error: "unauthorized" });
  // Counted only once the caller is known, so a stranger cannot lock the bot out.
  const limit = await deps.limiter.hit("internalApi", "agent-zero");
  if (!limit.allowed)
    return json(429, { error: "too_many_requests", retryAfterSeconds: limit.retryAfterSeconds });
  return null;
}

export async function discordProfile(
  deps: InternalDeps,
  request: Request,
  discordId: string,
): Promise<Response> {
  const refused = await gate(deps, request);
  if (refused) return refused;
  if (!SNOWFLAKE.test(discordId)) return json(400, { error: "invalid_discord_id" });

  const [row] = await deps.db
    .select({ userId: discordLinks.userId, username: users.username })
    .from(discordLinks)
    .innerJoin(users, eq(users.id, discordLinks.userId))
    .where(eq(discordLinks.discordId, discordId))
    .limit(1);
  if (!row) return json(404, { linked: false });

  const rank = rankKeyOf((await readProgress(deps.db, row.userId)).steps);
  return json(200, { linked: true, username: row.username, rank });
}

/**
 * Every linked member's Discord id and rank key (null before a rank is earned): what Agent
 * Zero syncs the rank roles from, every few minutes and whenever it starts. A member who
 * unlinked is simply absent, so the bot takes the rank roles from anyone not listed.
 * Discord ids and rank keys only: no usernames, no emails.
 */
export async function linkedRanks(deps: InternalDeps, request: Request): Promise<Response> {
  const refused = await gate(deps, request);
  if (refused) return refused;
  // One query for every linked member's steps, grouped here: fast however many there are.
  const rows = await deps.db
    .select({ discordId: discordLinks.discordId, step: rankHistory.rank })
    .from(discordLinks)
    .leftJoin(rankHistory, eq(rankHistory.userId, discordLinks.userId));
  const steps = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = steps.get(row.discordId) ?? new Set<string>();
    if (row.step) set.add(row.step);
    steps.set(row.discordId, set);
  }
  const members = [...steps].map(([discordId, set]) => ({ discordId, rank: rankKeyOf(set) }));
  return json(200, { members });
}

export async function stats(deps: InternalDeps, request: Request): Promise<Response> {
  const refused = await gate(deps, request);
  if (refused) return refused;
  // "Academy members": accounts that are email-verified and onboarded (DECISIONS.md).
  const [row] = await deps.db
    .select({ members: count() })
    .from(users)
    .where(and(eq(users.emailVerified, true), isNotNull(users.username)));
  return json(200, { academyMembers: Number(row?.members ?? 0) });
}
