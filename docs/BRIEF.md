# ZEROCORPS.ORG — PROJECT BRIEF + DISCORD INTEGRATION CONTRACT

> This is the owner's brief. It is the contract for the build. Decisions made
> after it was written are recorded in [DECISIONS.md](DECISIONS.md); where the two
> differ, DECISIONS.md wins because the owner approved each change.
>
> **Revised on 2026-09-19 at the owner's instruction.** The user journey, the
> milestone list and "Design for later" were rewritten for the email-code sign-up,
> the move of the phone number from sign-up to the 2FA prompt, and the new
> milestone 9. Everything else is the original text. The security baseline that
> now runs through every milestone is in [SECURITY.md](SECURITY.md).

## Priorities, in order

1. Security is the focus of this project. A later phase moves ZeroCorps to a
   self-hosted, hardened setup, so every assumption the current hosts cover is
   written down as we go ([SECURITY.md](SECURITY.md)).
2. Boring, standard auth. No novel flows or crypto. Use what Better Auth does
   safely; keep custom security code small, isolated and tested against attacks,
   not only happy paths.
3. Minimal third parties. Ask before adding any outside service.
4. Collect and move as little personal data as possible.

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
4. Sign up: email + password + an agree-to-terms line. There is NO phone field.
   A 6-digit code is emailed, and NOTHING is written to the users table until
   the code is correct. Correct code -> the account is created already
   verified, the user is signed in and continues to onboarding.
5. /onboarding (forced after the first sign-in, cannot be skipped):
   - Username REQUIRED: 3–20 chars, a–z 0–9 underscore, stored lowercase,
     unique index (case-insensitive), reserved-words blocklist, debounced live
     availability check via a rate-limited endpoint. DB constraint is the real
     guard; handle the race-condition error gracefully.
   - Display name optional (non-unique).
   - Profile picture optional: upload, validate type/size, resize server-side.
     If none, show a default blank grey avatar everywhere.
6. /dashboard: clean layout, one prominent center tile labeled
   "Zero Corps Academy" -> enters the academy. Leave room for future tiles
   (ZeroCharts, ZeroBot). A profile icon top right (the avatar, or the grey
   default) opens a small menu: profile, settings, sign out.
7. 2FA: SMS code or TOTP authenticator app, plus backup codes. TOTP is the
   recommended method and is always available in settings.
   - With 2FA on, login is: email + password -> 6-digit code (SMS or TOTP)
     -> session. Include an optional "Trust this device for 30 days" checkbox
     on the code screen (check Better Auth's current trusted-device support).
   - With no 2FA, login is password only. After each new sign-in or sign-up, a
     small banner with an X invites the user to secure the account by linking
     a phone number and confirming a texted code. The phone number is
     collected THERE and in settings, never at sign-up. A confirmed number
     sets phone_verified_at, switches SMS 2FA on and shows backup codes once
     (the user must confirm they saved them).
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
- Passkeys as an extra 2FA option.

## Brain export (owner-only; milestone 9)

The owner wants an Obsidian graph ("brain") of every ZeroCorps member, to see
who is progressing fastest and reach out to them on Discord. It is a read-only
view for the owner and nobody else.

- Pull, never push. The website never writes to the owner's laptop or to
  Obsidian and gets NO new public endpoint for this. A local command
  (`npm run brain:export`) on the owner's laptop reads the database and writes
  Markdown notes.
- Hard allowlist of fields: user id, username, display name, rank, joined date,
  lessons completed (ids and dates), last activity date, Discord username if
  linked. NEVER email, phone, IP, device, password or auth data. The allowlist
  is enforced in the database, not only in code: a `brain_export` view exposing
  only those columns, read by a dedicated read-only role that has SELECT on the
  view and nothing else. The owner sets that role's password by hand; it is
  never in a committed migration.
- Output goes to `BRAIN_VAULT_PATH`, a private vault OUTSIDE the public repo. The
  command refuses to write inside the repo. Each run rebuilds the folder from
  scratch, so deleted accounts disappear from the brain too.
- One note per member with frontmatter (the allowlisted fields plus a computed
  pace) and a rank tag; stub notes per lesson, module, course and rank; a
  central hub note. Members link to every lesson they completed, so members
  with more progress gain more links. A plain-Markdown leaderboard note ranks
  pace over the last 30 days. Graph colour groups are keyed on the rank tags.
- The vault stays local, or on end-to-end encrypted sync only, and is never
  published. The privacy page says that username, rank and progress are used
  for the owner's internal community analytics and that the owner may contact
  members on Discord.

## Milestones (stop after each)

1. Skeleton, theme system (2 themes), home ad page, /academy landing.
2. Auth: sign-up by emailed 6-digit code (no phone field), login, logout,
   password reset, rate limiting, protected routes, security emails, and the
   security baseline (SECURITY.md, the auth event log, encrypted backups).
3. Onboarding: username rules + availability check, display name, avatar
   upload with grey default.
4. Dashboard with the Academy tile and the profile menu; settings pages for
   account and appearance (including account deletion, recent security events
   and active sessions), with placeholders for security, connections,
   subscriptions.
5. Phone + 2FA: SMS wrapper, the "secure your account" banner that links and
   confirms a phone number, auto-enabled SMS 2FA, TOTP option, backup codes,
   login code challenge, trusted device, settings security page.
6. Discord link/unlink flow + connections UI.
7. Academy skeleton: MDX lessons, progress, computed rank, heatmap calendar.
8. syncDiscordRoles + internal API for Agent Zero.
9. Brain export for the owner's Obsidian vault. A bare version (members and
   join dates only) may be asked for after milestone 3.

Design direction: minimal, dark-first, clean. I may share reference sites for
layout inspiration; match the feel, don't copy assets or code.
