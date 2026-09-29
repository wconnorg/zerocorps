/**
 * The few calls this site makes to Discord, over plain `fetch` (no SDK, as everywhere
 * else). `fetch` is passed in, so the tests run the real code against a fake Discord.
 *
 * Linking (milestone 6) uses OAuth2 with the `identify` scope only (hard rule 5): the
 * access token is used once, to read the member's Discord id and username, then revoked
 * and forgotten. It is never stored.
 *
 * Roles (the Rookie role on linking) use the bot token of the site's OWN Discord
 * application, which needs nothing but "Manage Roles" in the server (SECURITY.md).
 */

export const DISCORD_API = "https://discord.com/api/v10";
export const DISCORD_AUTHORIZE = "https://discord.com/oauth2/authorize";

/** Discord's ids are "snowflakes": 17 to 20 digits. Anything else is refused. */
export const SNOWFLAKE = /^\d{17,20}$/;

export type DiscordFetch = typeof fetch;

export type DiscordApp = {
  clientId: string;
  clientSecret: string;
  /** Where Discord sends the browser back: `<site>/api/auth/discord/callback`. */
  redirectUri: string;
};

const TIMEOUT_MS = 10_000;

export function authorizeUrl(app: DiscordApp, state: string): string {
  const url = new URL(DISCORD_AUTHORIZE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", app.clientId);
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", app.redirectUri);
  // Always show Discord's screen, so the member sees which account they are linking.
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();

/**
 * Trades the one-time code for the member's Discord id and username, then revokes the
 * token straight away. Returns null on ANY failure: the caller links nothing then.
 */
export async function identify(
  fetcher: DiscordFetch,
  app: DiscordApp,
  code: string,
): Promise<{ id: string; username: string } | null> {
  const tokenResponse = await fetcher(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form({
      grant_type: "authorization_code",
      code,
      redirect_uri: app.redirectUri,
      client_id: app.clientId,
      client_secret: app.clientSecret,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
  if (!tokenResponse?.ok) return null;
  const token = (await tokenResponse.json().catch(() => null)) as {
    access_token?: unknown;
    scope?: unknown;
  } | null;
  const accessToken = typeof token?.access_token === "string" ? token.access_token : null;
  if (!accessToken) return null;

  try {
    const userResponse = await fetcher(`${DISCORD_API}/users/@me`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch(() => null);
    if (!userResponse?.ok) return null;
    const user = (await userResponse.json().catch(() => null)) as {
      id?: unknown;
      username?: unknown;
      discriminator?: unknown;
    } | null;
    if (typeof user?.id !== "string" || !SNOWFLAKE.test(user.id)) return null;
    if (typeof user.username !== "string" || user.username.length === 0) return null;
    // Discord's old four-digit tags still exist on a few accounts; "0" means none.
    const tag =
      typeof user.discriminator === "string" && user.discriminator !== "0"
        ? `#${user.discriminator}`
        : "";
    return { id: user.id, username: `${user.username}${tag}`.slice(0, 64) };
  } finally {
    // Not needed after this, and never stored: revoke it now. Best effort.
    await fetcher(`${DISCORD_API}/oauth2/token/revoke`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form({
        token: accessToken,
        token_type_hint: "access_token",
        client_id: app.clientId,
        client_secret: app.clientSecret,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch(() => null);
  }
}
