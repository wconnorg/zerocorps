# The internal API, for Agent Zero

Agent Zero is the ZeroCorps Discord bot (its own repository). This page is the contract
between it and zerocorps.org (milestone 8). It contains no secret and no address that is
not already public.

## Who does what

- **The website's own Discord application ("ZeroCorps Web")** powers only the "Link
  Discord" button: Discord's authorize screen tells the website which Discord user a
  member is (scope `identify`). It has no bot and no power in the server.
- **Agent Zero is the only bot.** It lets people in and gives the **verified** role by a
  reaction to one of its messages, and it gives the **rank** roles (today only Bronze,
  earned by completing Chapter 1 and claimed by linking Discord). The website never holds
  the bot's token.
- **How the bot knows ranks:** it asks the website. On start and every few minutes it
  reads every linked member's rank (`GET /api/internal/discord/ranks`) and gives the role
  for each listed rank. **A linked member never loses a rank role** (owner, 2026-09-29):
  only a member missing from the list, which is what unlinking Discord does, loses them. When someone joins it can ask about that one member
  (`GET /api/internal/discord/{discordId}/profile`). The verified role is the bot's own
  business and never part of this.

## Calling it

Every call sends the shared secret in a header:

```
X-Internal-Secret: <the same value as INTERNAL_API_SECRET on the website>
```

The secret is at least 32 characters, lives in the website's host settings and in the
bot's own environment, and never in either repository or in chat. Without it, or with a
wrong one, the answer is `401`. While the website has no secret set, every call is `503`
(the API is off).

At most 120 calls a minute, counted only for calls with the right secret; above that the
answer is `429` with `retryAfterSeconds`.

## GET /api/internal/discord/{discordId}/profile

`discordId` is the member's Discord user id (17 to 20 digits).

| Status | Body                                                            | Meaning                                           |
| ------ | --------------------------------------------------------------- | ------------------------------------------------- |
| 200    | `{ "linked": true, "username": "trader_99", "rank": "bronze" }` | Linked. `rank` is `null` before a rank is earned. |
| 404    | `{ "linked": false }`                                           | This Discord account is not linked to any member. |
| 400    | `{ "error": "invalid_discord_id" }`                             | Not a Discord id.                                 |

`username` is the member's ZeroCorps username, never their Discord name. No email, phone
number or anything else is ever returned.

**What the bot does with it:** on a member joining, call this; if `rank` is not null, give
the Discord role configured for that rank. Rank keys today: `bronze` (since 2026-10-05; `rookie` before, never earned by anyone).

## GET /api/internal/discord/ranks

| Status | Body                                                                                                           | Meaning                                                    |
| ------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 200    | `{ "members": [{ "discordId": "123456789012345678", "rank": "bronze" }, { "discordId": "…", "rank": null }] }` | Every linked member, once. Discord ids and rank keys only. |

A member who unlinks disappears from the list, so the bot takes their rank roles away on
its next sync; a listed member keeps every rank role they hold, even with `rank: null`.
Rank keys today: `bronze` (since 2026-10-05; `rookie` before, never earned by anyone). The bot also names its "Academy Users: N" channel after the
length of this list (linked Discord accounts), so it does not use `/stats`.

## GET /api/internal/stats

| Status | Body                       | Meaning                                                      |
| ------ | -------------------------- | ------------------------------------------------------------ |
| 200    | `{ "academyMembers": 42 }` | Accounts that are email-verified and have chosen a username. |

## Before the bot can reach it

zerocorps.org sits behind Vercel, which has challenged automated requests to its pages
(a "Security Checkpoint", HTTP 403). The bot's first request to `/api/internal/` on
2026-09-29 was NOT challenged: it got the API's own 503 (no secret set yet). After the
secret was set, a request without it got the API's own `401 {"error":"unauthorized"}`,
also unchallenged. If the challenge ever appears for the bot, a Firewall rule letting
`/api/internal/` through is the fix. The bot backs off on a 403 checkpoint either way.

## What Agent Zero relies on (keep these true on the website)

From the bot's own handoff, 2026-09-29. Breaking one of these stops the role sync.

- **Only `https://zerocorps.org`.** The bot refuses `http://` and anything on the laptop,
  so the website's dev server is never called.
- **No redirect, ever, on `/api/internal/*`.** The bot never follows one, because the
  secret header would travel with it, so a trailing-slash, `www`, locale or host redirect
  (in `next.config`, a proxy or Vercel's domain settings) breaks every call. Vercel's
  challenge must stay off these paths too.
- **The answers stay exactly as documented above.** One malformed entry rejects the whole
  ranks list, and an HTML page (Next's own 404 included) counts as an error; either way
  the bot changes no role. Off is `503 {"error":"disabled"}`.
- **How it calls:** the ranks list at start and every 5 minutes, the profile once per
  member who joins, about 12 calls an hour; `/stats` is not called. It waits out a `429`
  (`retryAfterSeconds`, else `Retry-After`, else 60 seconds), pauses 10 minutes on a `403`
  and backs off to at most 30 minutes on repeated failures.
- **A new rank key needs the bot first.** An unknown key only logs a warning and changes
  nothing for the members holding it. A new rank needs a line in the bot's config, a role
  id in its environment and the role in Discord, so the owner sets those up before the
  site sends the key. The site's keys come from `rankKeyOf` in
  `src/lib/academy/standing.ts`; today only `bronze`. **Changed on 2026-10-05:** the key
  was `rookie` (never earned by anyone, so no member holds it); the bot needs a Bronze
  role, its id in its environment, and `bronze` in its config, and can drop `rookie`.
- **Verified is the bot's own:** a ✅ on its welcome message gives it, removing the ✅
  takes it away. The website plays no part.
