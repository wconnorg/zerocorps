import { DISCORD_API, type DiscordFetch, SNOWFLAKE } from "./discord-api.ts";

/**
 * `syncDiscordRoles` from the brief: makes a member hold exactly the role for their rank
 * in the ZeroCorps server, and none of the other rank roles. Called on linking (so a new
 * link brings the rank role) and on unlinking (with no rank: every rank role goes).
 *
 * Idempotent: adding a role a member has, or removing one they lack, changes nothing on
 * Discord's side. It never throws: linking works even while Discord is slow or down, and
 * the result says what happened so it can be logged. A member not in the server is not
 * an error; Agent Zero restores the role when they join (milestone 8).
 */

export type RoleConfig = {
  botToken: string;
  guildId: string;
  /** Rank key → Discord role id, from `DISCORD_RANK_ROLE_IDS`. Today: `{ "bronze": "..." }`. */
  roleIds: Readonly<Record<string, string>>;
};

export type SyncResult =
  | { status: "synced" }
  | { status: "not-in-server" }
  | { status: "rate-limited" }
  | { status: "failed"; httpStatus: number | null };

const TIMEOUT_MS = 10_000;
const MAX_WAIT_MS = 2_000;

async function roleCall(
  fetcher: DiscordFetch,
  config: RoleConfig,
  method: "PUT" | "DELETE",
  discordId: string,
  roleId: string,
): Promise<Response | null> {
  const url = `${DISCORD_API}/guilds/${config.guildId}/members/${discordId}/roles/${roleId}`;
  const send = () =>
    fetcher(url, {
      method,
      headers: {
        authorization: `Bot ${config.botToken}`,
        "x-audit-log-reason": "ZeroCorps Academy rank",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch(() => null);

  const first = await send();
  if (first?.status !== 429) return first;
  // Rate limited: wait what Discord asks, if it is short, and try once more.
  const body = (await first.json().catch(() => null)) as { retry_after?: unknown } | null;
  const seconds = typeof body?.retry_after === "number" ? body.retry_after : 1;
  if (seconds * 1000 > MAX_WAIT_MS) return first;
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  return send();
}

export async function syncDiscordRoles(
  fetcher: DiscordFetch,
  config: RoleConfig,
  discordId: string,
  rankKey: string | null,
): Promise<SyncResult> {
  if (!SNOWFLAKE.test(discordId) || !SNOWFLAKE.test(config.guildId)) {
    return { status: "failed", httpStatus: null };
  }
  const wanted = rankKey ? config.roleIds[rankKey] : undefined;
  const calls = Object.values(config.roleIds)
    .filter((roleId) => SNOWFLAKE.test(roleId))
    .map((roleId) => ({
      roleId,
      method: roleId === wanted ? ("PUT" as const) : ("DELETE" as const),
    }));
  // Add the wanted role first, so a member is never briefly left with no rank role.
  calls.sort((a, b) => (a.method === "PUT" ? -1 : 0) - (b.method === "PUT" ? -1 : 0));

  for (const call of calls) {
    const response = await roleCall(fetcher, config, call.method, discordId, call.roleId);
    if (!response) return { status: "failed", httpStatus: null };
    if (response.status === 404) return { status: "not-in-server" };
    if (response.status === 429) return { status: "rate-limited" };
    if (!response.ok) return { status: "failed", httpStatus: response.status };
  }
  return { status: "synced" };
}

/**
 * Reads `DISCORD_RANK_ROLE_IDS`: a JSON object of rank keys to role ids. Returns null for
 * anything else, so a typo switches role sync off instead of doing something odd.
 */
export function parseRoleIds(raw: string | undefined): Record<string, string> | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return null;
  for (const [key, id] of entries) {
    if (!/^[a-z0-9-]+$/.test(key) || typeof id !== "string" || !SNOWFLAKE.test(id)) return null;
  }
  return Object.fromEntries(entries) as Record<string, string>;
}
