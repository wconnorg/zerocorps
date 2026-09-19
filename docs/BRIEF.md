# ZEROCORPS.ORG — PROJECT BRIEF + DISCORD INTEGRATION CONTRACT

> This is the owner's brief, saved verbatim. It is the contract for the build.
> Decisions made after it was written are recorded in [DECISIONS.md](DECISIONS.md);
> where the two differ, DECISIONS.md wins because the owner approved each change.

## What this is

ZeroCorps is my trading education/software brand. This repo is zerocorps.org.
A separate repo contains "Agent Zero", a private Discord bot that runs in ONE
server (the ZeroCorps Discord). This brief defines the website and exactly how
it connects to Discord and the bot. Read it fully, then reply with a build
plan and any questions BEFORE writing code. We build one milestone at a time
and stop for testing after each.

## Stack / infra

- Next.js (App Router), TypeScript, Tailwind, Drizzle ORM
- Postgres hosted on Supabase, used as PLAIN Postgres via DATABASE_URL. Do not
  use Supabase Auth or the Supabase client SDK — I will self-host later
  (Docker + Postgres), so everything must be portable.
- Auth: Better Auth (check current docs before configuring)
- File storage for avatars: S3-compatible API (Supabase Storage now, MinIO
  later) behind a small storage wrapper
- Email: Resend behind a sendEmail() wrapper; log to console in dev
- SMS: Twilio Verify (or an equivalent verification API) behind a
  sendSmsCode() / checkSmsCode() wrapper; log codes to console in dev. Use a
  verification API rather than raw SMS from my own number so I do not have to
  do A2P 10DLC registration.
- Secrets in .env; create .env.example and .gitignore first. Repo may go public.

## Hard rules

1. Accounts are created ONLY with email + password. No Google, no Discord
   login, no magic-link-only accounts. Email must be verified before access.
2. Discord is NEVER a login method. It is an optional link on an existing
   account. Joining/using the Discord server never requires a site account.
3. A phone number is NEVER a login or signup identifier. It is an optional
   verified attribute on an existing account, used only as a second factor.
   If Better Auth's phone number plugin is used, its phone sign-in/sign-up
   must be disabled (confirm how in current docs).
4. Postgres is the single source of truth for users, progress, and ranks.
5. Store only Discord data needed for functionality: discord_id,
   discord_username, linked_at. No profiling, no extra scopes.
6. Users are referenced internally by ID, never by username.
7. No SMS is ever sent for an account whose email is not verified.

## User journey

1. Person joins the Discord. Agent Zero's verify/welcome messages include a
   link to zerocorps.org/academy. (Bot side; not built here.)
2. zerocorps.org (home) is currently a single advertisement page for ZeroCorps
   Academy with one CTA -> /academy.
3. /academy is a public landing page with "Sign in" and "Sign up".
4. Sign up: email + password, plus an OPTIONAL "Phone number" field clearly
   labeled optional. If entered, the phone is stored unverified and nothing
   is texted yet. -> verification email -> verified.
5. /onboarding (forced after first verified login, cannot be skipped):
   - Phone step, shown FIRST and ONLY IF a phone was entered at signup:
     send a 6-digit SMS code -> on success set phone_verified_at, auto-enable
     SMS 2FA, show backup codes once (user must confirm they saved them).
     The user can go back and remove the number instead, which skips 2FA
     setup entirely.
   - Username REQUIRED: 3–20 chars, a–z 0–9 underscore, stored lowercase,
     unique index (case-insensitive), reserved-words blocklist, debounced live
     availability check via a rate-limited endpoint. DB constraint is the real
     guard; handle the race-condition error gracefully.
   - Display name optional (non-unique).
   - Profile picture optional: upload, validate type/size, resize server-side.
     If none, show a default blank grey avatar everywhere.
6. /dashboard: clean layout, one prominent center tile labeled
   "Zero Corps Academy" -> enters the academy. Leave room for future tiles
   (ZeroCharts, ZeroBot).
7. 2FA: SMS code or TOTP authenticator app, plus backup codes.
   - With 2FA on, login is: email + password -> 6-digit code (SMS or TOTP)
     -> session. Include an optional "Trust this device for 30 days" checkbox
     on the code screen (check Better Auth's current trusted-device support).
   - With no 2FA, login is password only, and /dashboard shows a RED
     "Secure your account" overlay banner on every new session (dismissible
     for that session, returns next session) linking to /settings security.
   - Phone rules: stored E.164, UNIQUE constraint on verified phone (one
     number <-> one account), friendly error if the number is already in use.
   - Changing the phone or disabling 2FA requires password re-entry. A new
     number must be verified before SMS 2FA is active again.
   - SMS endpoints are rate limited per user, per phone, and per IP, with a
     resend cooldown, max attempts per code, and 10-minute code expiry.
8. /settings: account (email, password, username change, phone), security
   (add/verify phone and enable SMS 2FA, enable TOTP, switch methods,
   regenerate backup codes), appearance (exactly two themes: dark default +
   light, saved per user, implemented with CSS variables), connections
   (Discord).

## Discord integration contract

### Linking (website side)

- /settings connections AND the profile page show a clean "Link Discord"
  button. After onboarding, show a one-time skippable prompt to link.
- Custom OAuth2 flow independent of Better Auth:
  GET /api/discord/link (session required) -> Discord authorize, scope
  `identify` only, signed state param.
  GET /api/discord/callback -> verify state, exchange code, fetch Discord user,
  save discord_id + discord_username + linked_at on the user.
- UNIQUE constraint on discord_id (one Discord <-> one ZeroCorps account).
  Friendly error if already linked elsewhere.
- Linked state shows Discord username + "Unlink". Unlink clears the fields and
  removes all academy rank roles in Discord.

### Rank -> role sync (website -> Discord)

- Academy rank is COMPUTED from progress, then cached on the user row.
- config maps rank -> Discord role ID (env/config, not hardcoded).
- syncDiscordRoles(userId): if the user has a discord_id and is in the guild,
  call Discord REST with the bot token (DISCORD_BOT_TOKEN, GUILD_ID):
  PUT/DELETE /guilds/{guild}/members/{user}/roles/{role} so they hold exactly
  the role for their current rank and none of the other rank roles.
  Idempotent. Handle 404 (not in server) and 429 (rate limit) gracefully.
- Call it on: Discord link, rank change, unlink (remove all).
- Rank roles are what unlock gated channels in Discord; channel permissions
  are configured in Discord, not here.

### Bot -> website (internal API, shared-secret header X-Internal-Secret)

- GET /api/internal/discord/:discordId/profile -> { linked, username, rank }
  or 404. Agent Zero calls this when a member (re)joins to restore roles.
- GET /api/internal/stats -> { academyMembers } for the bot's stats channel.
- Rate limit and never expose emails, phone numbers, or anything beyond
  what's listed.

## Academy (initial framework — content structure may change)

- Lessons are MDX files: /content/academy/<course>/<module>/<lesson>.mdx with
  frontmatter (title, order, rank_required). I write them in Obsidian.
- Tables: users (+ username, display_name, avatar_url, phone nullable unique,
  phone_verified_at nullable, theme, discord_id, discord_username, linked_at,
  rank), lesson_progress (user_id, lesson_id, completed_at), rank_history
  (user_id, rank, achieved_at). 2FA secrets, backup codes, and trusted
  devices use whatever tables Better Auth's plugins require.
- "Mark complete" action -> recompute rank -> if changed, write rank_history
  and call syncDiscordRoles.
- Progress calendar on the academy home: GitHub-style activity heatmap built
  from lesson_progress dates, plus current rank and next-rank progress.

## Design for later, do NOT build now

- Subscriptions to ZeroBot trading algorithms (Stripe): plan a nullable
  subscriptions table and a placeholder "Subscriptions" section in settings.
  A subscription tier will later map to a Discord role via the same
  syncDiscordRoles mechanism.
- ZeroCharts, ZeroBot dashboards.

## Milestones (stop after each)

1. Skeleton, theme system (2 themes), home ad page, /academy landing.
2. Auth: signup (with optional phone field, stored unverified, no SMS yet),
   email verification, login, logout, password reset, rate limiting,
   protected routes.
3. Onboarding: username rules + availability check, display name, avatar
   upload with grey default. (Phone step is added in milestone 5.)
4. Dashboard with the Academy tile; settings pages for account and
   appearance, with placeholders for security, connections, subscriptions.
5. Phone + 2FA: SMS wrapper, onboarding phone verification step with
   auto-enabled SMS 2FA, TOTP option, backup codes, login code challenge,
   trusted device, settings security page, red "Secure your account" overlay
   for sessions without 2FA.
6. Discord link/unlink flow + connections UI.
7. Academy skeleton: MDX lessons, progress, computed rank, heatmap calendar.
8. syncDiscordRoles + internal API for Agent Zero.

Design direction: minimal, dark-first, clean. I may share reference sites for
layout inspiration; match the feel, don't copy assets or code.
