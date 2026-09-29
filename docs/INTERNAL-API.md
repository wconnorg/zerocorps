# The internal API, for Agent Zero

Agent Zero is the ZeroCorps Discord bot (its own repository). This page is the contract
between it and zerocorps.org (milestone 8). It contains no secret and no address that is
not already public.

## Who does what

- **The website's own Discord application ("ZeroCorps Web")** powers only the "Link
  Discord" button: Discord's authorize screen tells the website which Discord user a
  member is (scope `identify`). It has no bot and no power in the server.
- **Agent Zero is the only bot.** It lets people in and gives the **verified** role by a
  reaction to one of its messages, and it gives the **rank** roles (today only Rookie,
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
| 200    | `{ "linked": true, "username": "trader_99", "rank": "rookie" }` | Linked. `rank` is `null` before a rank is earned. |
| 404    | `{ "linked": false }`                                           | This Discord account is not linked to any member. |
| 400    | `{ "error": "invalid_discord_id" }`                             | Not a Discord id.                                 |

`username` is the member's ZeroCorps username, never their Discord name. No email, phone
number or anything else is ever returned.

**What the bot does with it:** on a member joining, call this; if `rank` is not null, give
the Discord role configured for that rank. Rank keys today: `rookie`.

## GET /api/internal/discord/ranks

| Status | Body                                                                                                           | Meaning                                                    |
| ------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 200    | `{ "members": [{ "discordId": "123456789012345678", "rank": "rookie" }, { "discordId": "…", "rank": null }] }` | Every linked member, once. Discord ids and rank keys only. |

A member who unlinks disappears from the list, so the bot takes their rank roles away on
its next sync; a listed member keeps every rank role they hold, even with `rank: null`.
Rank keys today: `rookie`. The bot also names its "Academy Users: N" channel after the
length of this list (linked Discord accounts), so it does not use `/stats`.

## GET /api/internal/stats

| Status | Body                       | Meaning                                                      |
| ------ | -------------------------- | ------------------------------------------------------------ |
| 200    | `{ "academyMembers": 42 }` | Accounts that are email-verified and have chosen a username. |

## Before the bot can reach it

zerocorps.org sits behind Vercel, which has challenged automated requests to its pages
(a "Security Checkpoint", HTTP 403). The bot's first request to `/api/internal/` on
2026-09-29 was NOT challenged: it got the API's own 503 (no secret set yet). If the
challenge ever appears for the bot, a Firewall rule letting `/api/internal/` through is
the fix. The bot backs off on a 403 checkpoint either way.
