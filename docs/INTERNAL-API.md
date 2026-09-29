# The internal API, for Agent Zero

Agent Zero is the ZeroCorps Discord bot (its own repository). This page is the contract
between it and zerocorps.org (milestone 8). It contains no secret and no address that is
not already public.

## Who does what

- **The bot** lets people into the server and gives the **verified** role, by a reaction
  to one of its messages. The website never touches that role.
- **The website** gives the **rank** roles (today only Rookie, earned by completing
  Chapter 1 of the Academy and claimed by linking Discord in Settings). It adds or removes
  only the roles listed in its `DISCORD_RANK_ROLE_IDS`, so the verified role must never be
  in that list.
- **When a member (re)joins the server,** the bot asks the website for their rank and gives
  the matching role, because the website cannot see who joins.

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

## GET /api/internal/stats

| Status | Body                       | Meaning                                                      |
| ------ | -------------------------- | ------------------------------------------------------------ |
| 200    | `{ "academyMembers": 42 }` | Accounts that are email-verified and have chosen a username. |

## Before the bot can reach it

zerocorps.org sits behind Vercel, which currently challenges automated requests (a
"Security Checkpoint" page, HTTP 403). A bot is automated, so either that challenge is
switched off in the project's Firewall settings or a Firewall rule lets `/api/internal/`
through. The owner checks which applies in the Vercel dashboard.
