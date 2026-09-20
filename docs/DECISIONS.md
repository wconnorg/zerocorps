# Decisions

Decisions the owner approved after the [brief](BRIEF.md) was written. Where this
file and the brief differ, this file wins. Add new entries at the bottom of the
relevant section with a date; do not rewrite history.

## Approved on 2026-09-19

### Hosting and database

- The app runs on **Vercel now and Docker later**. The code contains nothing
  Vercel-specific: no `VERCEL_*` variables, no Vercel-only packages.
- The database is Supabase Postgres used as **plain Postgres**. The Supabase
  Data API is disabled. The Supabase SDK and Supabase Auth are never used.
- `DATABASE_URL` is the Supabase **transaction pooler** (port 6543) and is what
  the app uses at runtime. This pooler mode does not support prepared
  statements, so postgres.js is configured with `prepare: false`.
- `DATABASE_URL_MIGRATIONS` is the Supabase **session pooler** and is used only
  by drizzle-kit.
- npm is the package manager.

### Accounts, phone and 2FA

- **SMS code ownership ("Option A").** Better Auth and our own code generate and
  check verification codes. The SMS provider only delivers them. With Twilio
  Verify this uses the per-service "custom verification code" setting, and each
  result is reported back to Twilio. The provider stays behind the
  `sendSmsCode()` / `checkSmsCode()` wrapper so it can be swapped if that Twilio
  setting is not available on the account. All limits (expiry, attempts,
  cooldown) live in our code, so they are the same for every provider.
- **One second factor at a time.** Once an authenticator app is enabled, SMS is
  no longer offered at login, even though the phone number stays on file.
- **Phone numbers are +1 only at launch** (United States and Canada). They are
  stored in E.164, so widening this later is a configuration change.
- **Only verified phone numbers are unique** (a partial unique index on
  `phone` where `phone_verified_at` is not null). A plain unique constraint
  would let anyone block a number just by typing it into the signup form.
- Usernames can be changed **once per 30 days**. The old name is released
  immediately. Users are always referenced by ID, so this is safe.

### Pages

- A private **`/profile`** page is built in milestone 4. Public profiles are
  deferred.
- **`/academy` serves two audiences**: the public landing page when signed out,
  and the academy home when signed in.

### Storage

- `avatar_url` stores the **storage object key**, not a full URL. The public URL
  is built from `STORAGE_PUBLIC_BASE_URL` at render time, so moving from Supabase
  Storage to MinIO is an environment change rather than a data migration.

### Academy content

- Every lesson has a required, stable **`id`** in its frontmatter.
  `lesson_progress.lesson_id` refers to that id, so renaming or moving a file in
  Obsidian never orphans a user's progress.
- Lessons support **Obsidian callouts and standard Markdown image syntax** only.
  No wikilinks and no `![[embeds]]`. A lint script reports content errors per
  file. Note that MDX is stricter than Markdown: a bare `<` or `{` in prose
  breaks the build.
- The owner supplies the **rank ladder** (names, order, earning rule) before
  milestone 7.

### Discord

- Role updates go through a small **retry queue**. A secret-protected endpoint
  that any cron can call works through it. Without this, a Discord outage during
  an unlink would leave rank roles in place forever.
- The internal API's `username` field is the **ZeroCorps username**.
- `academyMembers` counts accounts that are **email-verified and onboarded**.

### Brand (placeholders the owner will replace)

- Text wordmark, near-black interface, one accent colour, placeholder copy.
- The accent is a cold cyan, chosen so it never collides with the colours that
  carry meaning in a trading product: red (danger, loss), green (success, gain)
  and amber (warning).

## Deployment (set up 2026-09-19)

- **Pipeline.** The public GitHub repository `wconnorg/zerocorps` is connected to
  Vercel through Vercel's Git integration. **A push to `main` is a production
  deploy.** Pushes to any other branch create preview deploys, which Vercel keeps
  behind its own login. Nothing is pushed until the owner has tested it.
- **The site is live at `https://zerocorps.org`.** The owner moved the domain to
  Vercel on 2026-09-19, before milestone 2, replacing an older GitHub Pages site.
  HTTPS is issued and renewed by Vercel. The same deployment also answers at
  `https://zerocorps.vercel.app`; redirecting that address to the domain is still
  to do, so search engines see one site.
- **`www.zerocorps.org` is deliberately not set up.** The owner chose to leave it
  out. Every registered URL (OAuth redirects, links in emails, the bot's base URL)
  uses the address without `www`.
- **`NEXT_PUBLIC_APP_URL` in Vercel is `https://zerocorps.org`** for both the
  Production and Preview environments, and the build stops without it, by design
  (see `src/env.ts`). It must always be the address visitors actually use: from
  milestone 2 a wrong value breaks sign-in, because cookies, origin checks and the
  links in emails are all built from it.
- **There is no separate staging site.** Every push to `main` changes the public
  site, which is one more reason nothing is pushed until the owner has tested it.
  (A staging site was approved and then dropped on the same day, 2026-09-19; see
  "Environments and deploy flow" below.)
- **DNS stays at Namecheap. Do not move the nameservers.** [DNS.md](DNS.md) lists
  every record, including the Proton Mail records that were removed by accident
  during the move and need restoring before Proton is used again.
- **Commits use the owner's GitHub noreply address**, because the repository is
  public. It is set in this repository's local git config.

## Approved on 2026-09-19, before milestone 2

From the owner's two handoffs at the start of milestone 2. The second revised the
first on the same day, before anything was built or committed, so this section
records the final state. What was approved and then dropped is listed under
"Reversed the same day" so the reasoning is not lost. Where an entry here differs
from one above, this one is newer and wins.

### Priorities, in order

1. **Security is the focus of the project.** A later phase moves ZeroCorps to a
   self-hosted, hardened setup, so every assumption the current hosts cover is
   written down as it is relied on ([SECURITY.md](SECURITY.md)).
2. **Boring, standard auth.** No novel flows or crypto. Use what Better Auth does
   safely; keep custom security code small, isolated and tested against attacks,
   not only happy paths.
3. **Minimal third parties.** Ask before adding any outside service.
4. **Collect and move as little personal data as possible.**

### Housekeeping

- The project moved from a FAT32 USB stick to the laptop's internal NTFS drive.
- There is **no root `academy/` folder**. Lessons live in `content/academy/`, which
  is created in milestone 7; the owner points Obsidian at it then.
- Brand assets, reference sites, final copy and the rank ladder do not exist yet.
  The placeholders stay. The rank ladder is still due before milestone 7.

### Third-party services

- **As few as possible.** The owner will self-host later. **No new external
  service is added without asking the owner first.** Everything stays behind a
  wrapper and a plain protocol (Postgres, the S3 API, an SMTP-style email
  wrapper), so moving is an environment change.
- The free tiers (Vercel Hobby, Supabase Free, Resend Free) are accepted for the
  build phase. What each one does not give us is tracked in the hosting
  assumptions ledger in [SECURITY.md](SECURITY.md).
- **No captcha or bot-protection service for now.** Rate limits only.
- **No breached-password lookup service.** If that protection is wanted later
  without an outside service, a list of common passwords bundled into the code
  does the same job offline.

### Environments and deploy flow

- **Two environments only: local and production** (`APP_ENV` is `local` or
  `production`). There is no staging site, no `dev.zerocorps.org` and no Vercel
  login for anyone.
- **Work happens on a `dev` branch. `main` is production.** `dev` is pushed to
  GitHub as a backup and is never deployed: `vercel.json` carries
  `"git": { "deploymentEnabled": { "dev": false } }`, which Vercel's documentation
  confirms (checked 2026-09-19). The file must be in the first commit that is
  pushed to `dev`. It is configuration only; no application code depends on Vercel.
- **Flow:** build and test locally on `dev` → merge to `main` once per milestone,
  and only when the owner says so, following the release order below. Nothing is
  pushed unless the owner says "push".
- `baseURL` and `trustedOrigins` are set explicitly from `NEXT_PUBLIC_APP_URL`, which
  stays the single source for the site's origin. There is no `BETTER_AUTH_URL`.
  Production refuses a non-https URL and a non-empty `EMAIL_ALLOWLIST`.
- **`SIGNUPS_OPEN`** is a server-side kill switch, checked inside the sign-up
  endpoints, not only in the UI. When `false`, `/sign-up` shows a "signups open soon"
  state with the Discord invite as the call to action, and sign-in still works. The
  owner intends it to be `true` in production once milestone 2 is released and
  tested. _Replaced on 2026-09-20 by the three-way `SIGNUP_MODE`; see "Approved on
  2026-09-20"._
- **Release order**, for every merge of `dev` into `main`:
  1. The owner sets any new Production variables in Vercel. Startup validation
     fails the build otherwise, which is deliberate.
  2. `npm run db:migrate` (named `db:migrate:prod` before 2026-09-20, when there
     were to be two databases). Migrations are additive and backward-compatible, so
     the old code keeps working until the new code is live.
  3. Merge `dev` into `main`; push when the owner says "push".
  4. `npm run verify` against the live site, then the owner does a real sign-up on
     `zerocorps.org` as the smoke test.

### Database

- **Two Supabase projects: `zerocorps-prod` and `zerocorps-dev`.** The laptop uses
  `zerocorps-dev`; the live site uses `zerocorps-prod`. The Data API is disabled on
  both. Row-level security is on for every table, without `FORCE`. _Superseded on
  2026-09-20: there is one database; see "One shared database" below. Wherever this
  file mentions `zerocorps-dev` or `zerocorps-prod`, read "the database"._
- **Migrations never run from Vercel.** `DATABASE_URL_MIGRATIONS` exists only on the
  owner's laptop.
- **Migrations go to dev first.** Applying them to production is a separate,
  explicitly named script that refuses to run without a typed confirmation.
  _Superseded on 2026-09-20 with the rest of the two-database plan._
- **Only the owner puts connection strings in `.env.local`.** They are never asked
  for in chat and never printed.

### Email and DNS

- **Order:** restore Proton's records exactly as listed in [DNS.md](DNS.md), then
  add Resend's.
- **Exactly one SPF `TXT` per hostname and exactly one `_dmarc` record, ever.**
  Resend normally puts its SPF and bounce `MX` on a `send` subdomain and its DKIM
  key on `resend._domainkey`, so the root SPF should not change. Follow what
  Resend's dashboard shows; if it asks for a root SPF change, merge it into the
  existing record.
- Proton's DMARC record stays the single DMARC record. The policy is not tightened
  until both senders pass.
- **Sender:** `"ZeroCorps" <no-reply@zerocorps.org>`.
- **DNS process:** the owner edits Namecheap by hand from a written checklist
  (Namecheap's host field leaves out the domain: `send`, `resend._domainkey`).
  Each record is then checked with a DNS lookup and DNS.md is updated. Changes are
  add-only; nothing is deleted without a before-and-after record.
- **`sendEmail()`** writes to the console and a local outbox by default. If
  `RESEND_API_KEY` is set locally it sends for real, but only to the addresses in
  `EMAIL_ALLOWLIST`. Production sends normally and refuses to start with a
  non-empty allowlist. A quota or provider error is logged loudly.
- The repository is public: documents may contain only values that are already
  public in DNS. No account emails, tokens or dashboard URLs.

### The account flow (spans milestones 2 to 5)

a. **Sign up:** email + password + an agree-to-terms line. No phone field.
b. A 6-digit code is emailed. **Nothing is written to the users table until the
code is correct.**
c. Correct code → the account is created already verified, the user is signed in
and continues to onboarding (milestone 3). Until that exists, they land on a
signed-in placeholder.
d. Dashboard (milestone 4): a profile icon top right (avatar or grey default) opens
a small menu: profile, settings, sign out.
e. **Sign in:** email + password. From milestone 5, with 2FA on: then the 2FA code.
f. **2FA (milestone 5):** after each new sign-in or sign-up without 2FA, a small
banner with an X invites the user to secure the account by linking a phone
number and confirming a texted code. The phone is collected there and in
settings, never at sign-up. The onboarding phone step is gone and the phone
columns wait for milestone 5. TOTP stays available in settings and is the
recommended method.

Milestone 2 builds a, b, c and e.

### Sign-up by email code: required properties

- A `pending_signups` table holds the email, the password hash (made by Better
  Auth's own hasher), a keyed hash of the code, attempts, send count, expiry and
  the terms version.
- **The code is bound to the browser that started the sign-up.** An `httpOnly`,
  `secure`, `sameSite=lax` cookie carries a random pending id. Verification is that
  pending row plus the code. **A code is never accepted by email address alone.**
  If codes were keyed by email, an attacker could start a second sign-up for the
  victim's address, the victim would type the newer code, and the attacker's
  password would be the one verified.
- **Pending sign-ups are independent.** Starting another for the same email does
  not cancel earlier ones, so an attacker cannot cancel the victim's.
- **The code:** 6 digits from a CSPRNG, stored only as a keyed hash, 15-minute
  expiry, 5 attempts and then the row is dead, single use, constant-time compare.
  Resend has a 60-second cooldown and at most 3 sends per pending row.
- **On success, in one transaction:** create the user (email verified) and the
  credential account from the stored hash, delete every pending row for that email,
  create the session and mark this device as known. A unique-email conflict is
  handled gracefully.
- **Email already registered:** the same on-screen response and the same code
  screen, no pending row, and that address gets a "you already have an account"
  email with sign-in and reset links. No enumeration by response or obvious timing.
- It is built as a **local Better Auth plugin** (findings 15 to 19 say how that is
  kept small and standard). `/sign-up/email`, `/verify-email` and
  `/send-verification-email` are disabled, and `requireEmailVerification` stays on
  as a backstop.
- **Code screen:** paste works, `inputmode="numeric"`, `autocomplete="one-time-code"`,
  clear expired and too-many-attempts states that lead back to `/sign-up`.
- **Email text:** the code, "expires in 15 minutes", "never share this code,
  ZeroCorps will never ask for it", "if you didn't request this, ignore it". A short
  reference is shown on both the code screen and the email, so a user holding two
  emails knows which code belongs to the screen in front of them.
- **The tests encode the attacks**, not only the happy path: an attacker starts a
  sign-up for the victim's email and cannot finish; the victim then signs up and
  succeeds; an attacker starts another after the victim, the victim's own code
  still works and the attacker-triggered code fails on the victim's screen; 5 wrong
  attempts kill the row; an expired code fails; the existing-email path creates
  nothing; success removes every pending row for that email.

### Passwords and sessions

- **Passwords:** 12 to 128 characters, no composition rules, no forced rotation,
  paste allowed.
- **Sessions:** 30 days, rolling, refreshed at most once a day. Cookies are `secure`,
  `httpOnly`, `sameSite=lax` and host-only.
- **Password reset** stays Better Auth's link flow. A completed reset signs out
  every session and sends a "your password was changed" email.
- **Password re-entry for sensitive actions (milestone 4).** Finding 20 shows that
  in 1.7.5 `freshAge` gates almost nothing, so the rule is: a sensitive action
  carries the current password in the same request. Change-password, delete-user
  and the 2FA plugin already demand it. Change-email and our own phone endpoints
  do not, so our server code checks the password (`verifyPassword`) before it calls
  them.
- Unused endpoints are switched off with `disabledPaths` and re-enabled in the
  milestone that needs them. Telemetry is pinned off.

### Abuse limits (VPN-safe)

- **People are never recognised, blocked or trusted by IP.** Shared addresses (VPNs,
  mobile carriers, campuses) are normal. IP limits are loose abuse throttles; the
  tight limits are per email address and per pending sign-up.
- **Starting values:** sign-up starts 3 per hour per address and 20 per hour per
  IP; sign-in 10 per 15 minutes per address + IP, with a ceiling of 50 per hour per
  address; password reset 3 per hour per address; one cap of 10 emails per day per
  address across all email types.
- Identifiers are stored as an HMAC with a server secret. The trusted client-IP
  header is configurable by environment variable.
- **Fail closed.** If the limiter or the database cannot be reached, auth endpoints
  refuse the request. They never skip a check.

### Security emails

- **New-device sign-in alert**, not every sign-in. A known device is a long-lived
  `httpOnly` cookie with a random id, stored hashed per user. The email has the
  time, the browser and OS from the user agent, and a reset-password link. No
  geo-IP service.
- **"Your password was changed"** after a reset completes.

### Security baseline (milestone 2 unless marked)

- **[SECURITY.md](SECURITY.md)**: threat model, hosting assumptions ledger, runbooks.
  Short, and kept current.
- **`auth_events` table:** sign-up started and completed, sign-in success and
  failure, code failures, reset requested and completed, new device, rate-limit
  hits. It stores the user id when known and a keyed hash of the identifier
  otherwise, the user-agent family and a timestamp. Retention is 90 days, purged by
  the daily job. Milestone 4 shows a user their own recent events and their active
  sessions, with revoke.
- **Logging hygiene:** passwords, codes, tokens, secrets and full email addresses
  are never logged. A test runs a full sign-up and then searches the local outbox
  and log output for the known password and code.
- **`/.well-known/security.txt`** with a contact address the owner chooses.
- **Supply chain:** security-critical packages are pinned to exact versions, the
  lockfile is committed, `npm audit` runs in the check script as a report and never
  auto-fixes. GitHub Dependabot alerts, secret scanning and push protection are
  switched on for the public repository.
- **Backups:** a command the owner runs by hand, with no extra installs if
  practical. Output is encrypted with a passphrase (AES-256-GCM through Node's
  crypto) into a gitignored folder. Restore is documented and tested against
  `zerocorps-dev`.
- **Daily cleanup cron** (`vercel.json`; the route accepts
  `Authorization: Bearer <CRON_SECRET>`). It deletes expired pending sign-ups,
  rate-limit rows, verifications and old `auth_events`. Expired pending rows are
  also purged whenever a sign-up starts. Vercel Hobby allows this: up to 100 cron
  jobs, each at most once a day, firing at any point within the scheduled hour
  (checked 2026-09-19).
- **Terms and privacy:** plain-language starter drafts, marked as drafts for the
  owner to read and approve. They cover what is collected now and later (email,
  password hash, username, avatar, phone, Discord ID, progress), why, how to
  request deletion, 18+, and education only / not financial advice / trading risk.
  The privacy draft also says that username, rank and progress are used for the
  owner's internal community analytics and that the owner may contact members on
  Discord about opportunities. `terms_accepted_at` and `terms_version` are recorded
  at sign-up.

### Later milestones

- **Milestone 4 gains account deletion** in settings, so the privacy page can
  truthfully promise it, plus the profile menu, the user's recent security events
  and active sessions with revoke.
- **Milestone 9 is the brain export** for the owner's Obsidian vault. The brief
  has the full specification. It is pull-only, adds no endpoint to the site, and its
  field allowlist is enforced in the database by a view and a read-only role.
  Supabase accepts custom roles through the pooler as `<role>.<project-ref>`
  (checked 2026-09-19), so that role is practical today. The Obsidian graph settings
  file format must be verified against a real test vault when it is built, not
  taken from memory.
- **Designed for later, not built:** passkeys as an extra 2FA option.

### What blocks what

- **Coding and local testing of milestone 2:** the `.env.local` fix
  (`NEXT_PUBLIC_APP_URL=http://localhost:3000`), the `zerocorps-dev` connection
  strings, and locally generated secrets.
- **Releasing milestone 2:** a Resend account, DNS checklists 1 and 2 in
  [DNS.md](DNS.md), the Production variables in Vercel, `zerocorps-prod` migrated, an
  encrypted backup run once, and owner-approved `/terms` and `/privacy`. The owner is
  walked through these one at a time.
- **Provider accounts.** Authenticator-app 2FA and a unique password on GitHub,
  Vercel, Supabase, Namecheap, Resend and later Twilio. Whoever gets into one of
  those accounts gets the whole site, however solid the auth code is.

### Reversed the same day

These were approved in the first handoff and dropped in the second. They are kept
here so nobody re-proposes them without knowing why.

- **A staging site at `dev.zerocorps.org`.** Dropped: it would have put a Vercel
  login in front of testing and added a second public hostname.
- **The Have I Been Pwned password check.** Dropped as an outside service. It would
  also have failed closed, blocking sign-up and reset whenever that service was down
  (finding 9).
- **An optional phone field at sign-up**, with its SMS consent line. The phone is now
  collected only when a user chooses SMS 2FA.
- **Unverified user rows, and the fixes built around them** (deleting the row on
  re-signup, a verify-with-password page, purging after 48 hours). With sign-up by
  email code an unverified user never exists, so none of it is needed.
- **The seven launch gates as the condition for `SIGNUPS_OPEN`.** Replaced by the
  milestone 2 release list above. Three of the old gates were not restated and are
  carried as open items in [SECURITY.md](SECURITY.md): the production database must
  not be able to pause, the hosting plan must permit commercial use before anything
  is sold, and bot protection is reconsidered if rate limits prove too weak.

## Approved on 2026-09-20 (milestone 2 go-ahead)

The owner approved the revised milestone 2 plan with the decisions below. Where an
entry here differs from one above, this one is newer and wins.

### One shared database

- **There is a single Supabase project, shared by the laptop and the live site.**
  There is no `zerocorps-dev`. The owner accepts the risk of keeping it shared after
  public launch, until the self-hosting phase. A separate development database is
  recorded in [SECURITY.md](SECURITY.md) as a recommended control the owner has
  declined for now.
- Because of that, every one of these guardrails is mandatory:
  - **Automated tests use PGlite only** (Postgres running inside the test process)
    and never read `DATABASE_URL`.
  - **No destructive commands against the database, ever:** no `drizzle-kit push`, no
    drops, no truncates. Migrations are additive and go through one guarded command,
    `npm run db:migrate`, which shows the target host and the pending migrations and
    needs a typed confirmation.
  - **An encrypted backup comes before every migration, without exception.** The
    migrate command refuses to run unless a backup file from the last hour exists.
  - **Local test accounts use only the owner's own addresses**, and a cleanup command
    removes the accounts (and their events) that match that allowlist.
  - **Reverting a git push restores code, never data.** Only a backup restores data,
    so the restore runbook is kept tested.
- **Laptop and Vercel hold different `BETTER_AUTH_SECRET`, `HMAC_SECRET` and
  `CRON_SECRET` values**, even though they share the database. What that means in
  practice:
  - Accounts are portable: a password hash does not depend on any secret, so an
    account made on the laptop can sign in on the live site and the other way round.
    It also means a test address used on the laptop is taken on the live site until
    the cleanup command removes it.
  - Sessions, sign-ups in progress and the known-device cookie belong to the site
    that issued them. Signing in on the live site with an account made on the laptop
    sends a new-device email, as it should.
  - Per-address limits and the daily email cap count separately on each side, because
    the address is hashed with a different key. Testing on the laptop never uses up
    the live site's allowance.
  - Event-log hashes written by one side cannot be matched by the other. Each event
    therefore records which side wrote it (`app_env`), so the laptop's test noise can
    be told apart from real activity and left out of the milestone 4 health view.
  - **For milestone 5:** Better Auth encrypts TOTP secrets and backup codes with
    `BETTER_AUTH_SECRET`. An account that switches on 2FA on one side cannot complete
    2FA on the other. Test 2FA on one side per account.

### Sign-up modes

- **`SIGNUP_MODE` is `closed`, `allowlist` or `open`**, and replaces `SIGNUPS_OPEN`.
  It defaults to `closed`.
- In `allowlist` mode the form shows a "private beta, invited addresses only" note.
  Only addresses in `SIGNUP_ALLOWLIST` can start a sign-up; every other address gets
  the same polite message.
- The mode is enforced on the server, at the start of a sign-up and again when the
  code is checked. Sign-in works in every mode.
- The owner tests on the live site in `allowlist` mode first, then sets production
  to `open` once milestone 2 is released and tested.

### The app's database role

- **The app connects as `zerocorps_app`, a role with no DDL rights**, from milestone
  2 onwards. With one shared database this role is the main protection against a
  destructive mistake, so it is required, not optional.
- **Access comes from explicit row-level-security policies for that role, not from
  the `BYPASSRLS` attribute.** `BYPASSRLS` is role-wide: it would switch off row-level
  security on every table in the database, including tables added later and
  Supabase's own. A policy is per table and sits in the migration that creates the
  table, so a new table is closed to the app until a migration opens it. (Supabase's
  `postgres` role also cannot hand out `BYPASSRLS`, but that is not the reason.)
- The role is created by a migration **without a password and unable to log in**, so
  no secret is ever committed. The owner then gives it a password by hand, once, with
  a one-statement script. The owner deletes the saved query from the Supabase SQL
  editor afterwards.
- **Every migration that adds a table** enables row-level security on it and adds
  the policy for `zerocorps_app`. `ALTER DEFAULT PRIVILEGES` grants the role
  `SELECT, INSERT, UPDATE, DELETE` on tables the migration role creates, so a
  forgotten grant cannot break the app; a test asserts that every table has
  row-level security and the policy, and runs the app's queries as that role.
- `DATABASE_URL` uses `zerocorps_app.<project-ref>` and that role's password.
  `DATABASE_URL_MIGRATIONS` keeps the owner role and stays on the laptop only.
- **`npm run db:check-role`** proves the role cannot create, alter or drop, holds no
  special attributes, belongs to no other role, and can read nothing outside the
  app's own tables.
- The `brain_reader` role in milestone 9 follows the same procedure.

### Answers on the content-security policy, contact details and pausing

- **A nonce-based CSP is built at the start of milestone 4**, not in milestone 2. The
  current policy and the reason for it are recorded in [SECURITY.md](SECURITY.md) as
  the baseline. The auth pages already send `frame-ancestors 'none'` and
  `form-action 'self'`, which need no nonce.
- **`security.txt` takes its contact from `SECURITY_CONTACT`.** For now that is the
  repository's GitHub private-vulnerability-reporting address, not an email address,
  because the domain may have no working inbox and a published address must not
  bounce. The privacy draft takes its contact from `PRIVACY_CONTACT` by the same
  rule. **"A working contact channel exists" is a release gate.**
- **DNS checklist 1 is on hold** until the owner decides between Proton and mail
  forwarding.
- **Database pausing on the Free plan is accepted for now.** The upgrade trigger is
  recorded in the ledger: before the owner promotes the academy publicly or takes any
  money, whichever comes first. Until then the daily cron touches the database every
  day, and if the database cannot be reached the auth routes show a friendly
  "temporarily unavailable" page.

### Confirmed choices

- A separate `HMAC_SECRET`; a keyed hash of the IP address plus a readable coarse
  prefix in the event log, mentioned in the privacy draft; security emails counted by
  the daily cap but never blocked by it; Better Auth's `name` mapped to
  `display_name`; the accepted trade-off that a per-address limit lets someone
  briefly block sign-up for an address they know.
- **The backup file:** the key is derived from the passphrase with scrypt and a
  random salt, the data is encrypted with AES-256-GCM, and the file header carries a
  format version.

### Additions

- **Work that happens after the response uses Next's `after()`**, which also works
  when self-hosted, with Better Auth's `advanced.backgroundTasks.handler` wired to
  it. A bare promise that nobody awaits can be frozen when a serverless function
  returns, and the email would never be sent. The owner's real sign-up at release is
  the proof.
- **Atomicity test:** with the adapter's `transaction: true`, a failure forced late
  in the success path (at session creation, for example) must leave no user, account
  or known-device row behind, and the pending row must still work.
- **One normalised form of an email address, trim + lowercase,** shared by
  `pending_signups`, the counters, the allowlists and Better Auth.
- **A completed password reset also forgets every known device** for that user.
- **For milestone 4, not built now:** an owner-only health view with 24-hour counts
  of sign-ups, failed sign-ins, code failures, rate-limit hits and email send errors.

### Sequence

1. The first migration, then the app-role script, then `npm run db:check-role`.
2. Milestone 2 is built on `dev`, then stops for the owner's local testing.
3. The release tasks follow one at a time: Resend, DNS, the Vercel variables, the
   GitHub security settings, the legal drafts, and `allowlist` mode on the live site.

### Decided by the owner during local testing (2026-09-20)

- **The owner tested milestone 2 on the laptop and it works:** sign-up by code,
  sign-in, sign-out, password reset and the invite-only refusal.
- **The live site stays in private beta (`SIGNUP_MODE=allowlist`) for a long while**, at
  least until the whole course is finished. The owner invites friends by adding their
  addresses to `SIGNUP_ALLOWLIST` in Vercel and redeploying. `open` is not the plan
  for the milestone 2 release any more.
- **An owner-only dev panel, later, not built now.** Once auth is proven on the live
  site: a page only the owner's account can open, holding the milestone 4 health view
  and, after milestone 9, a way into the brain export. The owner is identified by an
  environment variable, never by an address written in this public repository, and
  the check is by user id on the server on every request. Managing the invite list
  from that panel, without a redeploy, belongs there too.
- **The sign-up felt slow on the laptop** ("sending your code" and the step after it).
  To be measured against a production build before release; see the open items.
- **The owner wants to change the logo and the colours.** Colours are the tokens in
  `src/app/globals.css` (the contrast test must keep passing); the logo is
  `ZeroMark` in `src/components/site/wordmark.tsx` and `src/app/icon.svg`.

### Where milestone 2 stands (keep this current; last updated 2026-09-20)

A new session starts here. Milestone 2 is **built on `dev` and waiting for the
owner's local testing**; `main` holds only milestone 1 and the docs. `dev` has not
been pushed.

**Built and proven** (typecheck, lint, 168 tests, production build, `npm run verify`):

- **Environment:** `src/env-schema.ts` (read by `src/env.ts`) with every milestone 2
  key, and the owner's tools `env:check`, `env:secrets` and `env:app-url`. The owner's
  `.env.local` is complete.
- **Database:** migrations `0000_app_role` and `0001_auth_core` were applied to the
  real database on 2026-09-20 after an encrypted backup and a passing restore drill.
  The app connects as `zerocorps_app`, and `npm run db:check-role` passed every line
  with nothing to review. The guarded commands are `db:check`, `db:backup`,
  `db:restore:check`, `db:migrate`, `db:check-role`, `db:cleanup-test-accounts` and
  `sessions:revoke-all`; the ones that change anything need a person at a terminal.
- **Sign-up by emailed code** (`src/lib/auth/email-code-signup.ts`), a local Better
  Auth plugin, with the attack tests the owner specified, the atomicity test, both
  cross-site tests, and `SIGNUP_MODE` enforced at the start and at the code check. A
  mutation check proved the cross-site test fails without the CSRF middleware.
- **Around it:** per-address limits (`limits.ts`), the daily email cap, the event log
  with `app_env` (`events.ts`), known devices and the new-device alert, the session
  hook that stores a coarse IP prefix and a browser family, "a reset forgets every
  known device", and the daily cleanup (`cleanup.ts`, `/api/cron/cleanup`).
- **Email:** `sendEmail()` (console and `.outbox/` on the laptop, Resend through
  `fetch`, the laptop-only allowlist) and the five messages, sent through Next's
  `after()`.
- **Pages:** `/sign-up` in its three modes, `/sign-up/verify`, `/sign-in`,
  `/forgot-password`, `/reset-password`, a protected placeholder `/dashboard`, the
  "temporarily unavailable" state, the `/terms` and `/privacy` drafts, and
  `/.well-known/security.txt`. The marketing and auth pages are still static.

**Waiting on the owner, one step at a time:**

1. **The second migration**, `0002_email_code_signup` (four new tables, nothing
   existing is touched): `npm run db:backup` → `npm run db:restore:check` →
   `npm run db:migrate` → `npm run db:check-role`. Until it is applied, sign-up and
   sign-in fail closed on the laptop, because the limiter's table does not exist yet.
2. **Local testing.** In `.env.local`: `SIGNUP_MODE=allowlist`, and the owner's test
   addresses in both `SIGNUP_ALLOWLIST` and `EMAIL_ALLOWLIST`. Codes and links are read
   from `.outbox/`. Afterwards `npm run db:cleanup-test-accounts` removes them.
3. Then the release tasks, one at a time (see "Sequence" above).

**Open questions for the owner:** pinning Supabase's CA certificate so the database
link is verified and not only encrypted ([SECURITY.md](SECURITY.md)); and the
already-registered path keeping a password-less row (finding 28), which differs from
the letter of "no pending row".

**Housekeeping:** the work sits in a few checkpoint commits on `dev`, made for safety
at the owner's request. Squash them into the single milestone commit before `dev` is
merged into `main`. The status table in AGENTS.md changes to "Done" only after the
owner's testing.

## Better Auth findings that shape the design

Verified against the Better Auth **1.7.5** documentation and plugin source on
2026-09-19. Re-verify against the installed version before configuring auth,
because plugin behaviour changes between releases.

1. **The phone-number plugin is not used.** It registers `/sign-in/phone-number`,
   an unauthenticated `/phone-number/send-otp`, a `/phone-number/verify` that
   creates a session, and phone-based password reset. None can be fully switched
   off, and they break hard rules 3 and 7. `phone` and `phone_verified_at` are
   our own columns, changed only through our own session-required endpoints.
2. **The username plugin is not used.** It adds `/sign-in/username`. Username is
   our own column with our own availability endpoint.
3. **Trusted devices are supported.** `trustDevice: true` on the code screen
   trusts the device for 30 days by default (`trustDeviceMaxAge`). Trust is a
   server-side record that rotates on every sign-in. The plugin also locks an
   account after 10 consecutive failed codes and allows 10 minutes to complete a
   challenge.
4. **Better Auth generates and checks SMS login codes itself**, and offers no
   hook to delegate the check. This is why "Option A" above was chosen.
5. **Backup codes are only created during authenticator-app enrolment**, and
   enabling 2FA through the plugin requires the password. For the onboarding
   flow, 2FA is switched on server-side after the SMS check (the docs allow
   this), and the backup-code record is created by us through the plugin's
   custom encrypt/decrypt option. SMS-only accounts then get the lockout counter
   too. The plugin supports adding an authenticator app to an SMS-only account.
6. **The plugin advertises the SMS method to every 2FA user**, including
   authenticator-only users with no phone. The offered methods are filtered per
   user at sign-in.
7. **Signing up with an existing email returns the same success response as a
   new one** (email-enumeration protection, automatic when verification is
   required). The UI always says "check your email", and the optional phone is
   only written when a user row is actually created.

Added on 2026-09-19 from a second pass over the 1.7.5 package source, before
milestone 2:

8. **Re-signup never touches an existing row, verified or not.** The endpoint
   hashes the new password only to even out timing, returns a made-up user and
   keeps the credential the first person set. The verification token is a
   stateless JWT that holds nothing but the email and lasts an hour, so any link
   issued in that hour verifies whichever row currently holds the address. Left
   alone, someone can sign up with another person's email, wait for them to click
   a verification link, and then sign in with the password they chose. The hooks
   that make a fix possible: `emailAndPassword.onExistingUserSignUp`,
   `emailVerification.beforeEmailVerification` (throwing in it blocks
   verification) and the global `hooks.before`.
9. **The Have I Been Pwned plugin adds no endpoints.** It wraps password hashing
   on the sign-up, change-password and reset-password paths and sends only the
   first five characters of the SHA-1 hash, with padding requested. It **fails
   closed**: if the lookup service is unreachable, sign-up and reset return an
   error until it is back. The check also runs on the existing-email path, so it
   does not reveal whether an address is registered.
10. **`emailAndPassword.disableSignUp` is checked inside the sign-up endpoint
    itself**, so it holds for direct API calls as well as for the form.
11. **Password reset answers identically for unknown emails** and does the same
    dummy work to even out timing. `revokeSessionsOnPasswordReset` is off by
    default and must be switched on.
12. **"Fresh" means recently signed in.** `session.freshAge` is measured from the
    moment the session was created, not from the last activity.
13. **Rate limiting is built in**, keyed by IP and path. The defaults are 3
    requests per 10 seconds on the sign-in and sign-up paths and 3 per 60 seconds
    on reset and verification emails. Storage defaults to memory, which is useless
    on serverless hosting, so it must be set to the database. There is nothing per
    target address; that part is ours to build.
14. **Cookies default to `httpOnly`, `sameSite=lax`, and `secure` whenever the
    base URL is https.** Telemetry is off unless switched on. IDs can be native
    UUIDs (`advanced.database.generateId: "uuid"`).

Added later on 2026-09-19 for the email-code sign-up. Finding 8 is the reason the
stock sign-up is not used at all. Finding 9 is kept for the record; the plugin it
describes was dropped.

15. **The `emailOTP` plugin cannot do this job, so a small local plugin is right.**
    It stores each code under `<type>-otp-<email>` and nothing else, and its verify
    endpoints take only an email and a code: there is no option that binds a code
    to a browser, a session or a request. A second request for the same address
    replaces the first, so anyone who knows an address can cancel the victim's
    live code. Paired with the stock sign-up it is worse than a race: the first
    person to submit an address has their password written immediately, and the
    code the victim later types verifies that row. The only path in it that creates
    the user _after_ the code check creates a passwordless account, which breaks
    hard rule 1. It also adds nine HTTP endpoints, including `/sign-in/email-otp`,
    that no option removes.
16. **The browser binding is a first-party pattern, not a novel one.** Better
    Auth's own two-factor plugin already keeps a random identifier in a signed
    `httpOnly` cookie and the matching row in the database
    (`createAuthCookie`, `setSignedCookie`, `getSignedCookie`, `expireCookie`). Our
    plugin copies it. Everything else comes from the library too: the 6-digit code
    (`generateRandomString(6, "0-9")`, which uses rejection sampling, so no modulo
    bias), the keyed hash (`makeSignature`, HMAC-SHA256), `constantTimeEqual`, the
    password hasher, `createUser`, `linkAccount`, `createSession` and
    `setSessionCookie`. The custom code is the pending-row state machine and the
    already-registered branch, and nothing more.
17. **The origin check does not cover a first visit on its own.** The global check
    only runs when the request carries a Cookie header, and someone starting a
    sign-up may have none. Without it, a cross-site form post could plant an
    attacker-chosen pending sign-up and its cookie in a victim's browser, and the
    victim would then verify the attacker's password. Every endpoint of our plugin
    therefore declares `use: [formCsrfMiddleware]`, as the stock sign-up and
    sign-in do. A test posts to the start endpoint from a foreign origin and
    expects a refusal with no cookie set.
18. **The origin check, the rate limiter and `disabledPaths` exist only on the
    HTTP router.** Server-side `auth.api.*` calls skip all three. So the forms call
    the HTTP endpoints through Better Auth's client, which is the standard usage,
    and do not go through server actions. For the same reason the stock sign-up
    is switched off twice: `disabledPaths` for HTTP and
    `emailAndPassword.disableSignUp: true` for server-side calls. Our plugin creates
    users through `internalAdapter`, which `disableSignUp` does not touch, and it
    checks `SIGNUPS_OPEN` itself in both the start and the verify endpoint.
19. **"One transaction" needs a setting.** The Drizzle adapter's `transaction` option
    defaults to `false`, and then `runWithTransaction` quietly runs the steps one
    after another. It is set to `true`. Only calls made through Better Auth's
    adapter join that transaction, so `pending_signups` and the known-device table
    are declared in the plugin's `schema`. A unique-email violation aborts the
    whole Postgres transaction, so it is caught outside and mapped to the
    already-registered behaviour. Attempts are counted with a single guarded
    `UPDATE … SET attempts = attempts + 1 WHERE id = … AND attempts < 5 AND
expires_at > now() RETURNING …`, before the code is compared, so concurrent
    guesses cannot exceed the cap.
20. **`freshAge` gates almost nothing in 1.7.5.** Only `/list-sessions` and a
    password-less `/delete-user` check it. Change-password demands the current
    password itself, and so does delete-user when one is sent. **Change-email
    demands neither.** `/verify-password` checks the password for the current
    session and changes nothing about freshness. Hence the milestone 4 rule above:
    the password travels with the sensitive request, and our server code checks it
    before calling change-email or a phone endpoint.
21. **The rate limiter fails closed.** It runs before the endpoint with no error
    handling around it, so a storage failure becomes a 500 and the request never
    reaches the endpoint. With no client IP it falls back to one shared bucket per
    path and logs a warning. `advanced.ipAddress.disableIpTracking` must **not** be
    used: with it, a request without an IP skips the limiter entirely. The limiter
    is on by default only in production, so it is switched on explicitly.
22. **Sessions store the raw IP address and the full user-agent string by default.**
    A `databaseHooks.session.create.before` hook may rewrite them, and it is used to
    store the same reduced form as `auth_events` and a length-capped user agent.
23. **The user's `name` is required by the core schema.** It is mapped to our
    `display_name` column (`user.fields.name`) and created as an empty string, which
    is what Better Auth's own plugins do when they have no name. Onboarding fills
    it in.
24. **Stock sign-in is already enumeration-safe** (re-confirmed line by line on
    2026-09-20, `api/routes/sign-in.mjs` 315 to 335): an unknown email, or a user
    with no password, runs one full password hash, which costs the same scrypt work
    as verifying a real one, and then throws `INVALID_EMAIL_OR_PASSWORD`; a wrong
    password throws the identical error. "Email not verified" can only be reached
    after the password has verified. The endpoint uses the CSRF middleware.

Added on 2026-09-20 while proving the schema:

25. **Better Auth switches its origin and CSRF checks off by itself under test.**
    `skipOriginCheck` defaults to `true` whenever `NODE_ENV` is `test`, and with it
    the CSRF check is skipped too (`context/create-context.mjs`, line 211). Our first
    cross-site test passed for that reason and proved nothing. Both
    `advanced.disableOriginCheck` and `advanced.disableCSRFCheck` are therefore set to
    `false` explicitly: the tests run against the real checks, and no environment
    variable can switch them off in production.
26. **Better Auth checks the Drizzle schema against its own model on the first
    request** and throws on a mismatch (`advanced.database.validateSchema`, on by
    default). It stays on. The tests build a Postgres inside the test process from
    the real migration files and run sign-in, reset and sign-out through it, once as
    the owner and once as `zerocorps_app`, so a wrong or missing column, grant or
    policy is caught before a migration ever reaches the one real database.
27. **The `accounts` table carries Better Auth's OAuth token columns**
    (`access_token`, `refresh_token`, `id_token` and their expiry times) because the
    library's model requires them and the schema check would fail without them. No
    social provider is ever configured, so they stay `NULL`; a test asserts that no
    row holds a token and that every account is a `credential` account.

Added on 2026-09-20 while building the email-code sign-up:

28. **An address that already has an account DOES get a pending row, without a
    password. This departs from the letter of "no pending row", on purpose, and is
    the owner's to confirm.** The spec asks for two things that pull apart: "no
    pending row" and "the same code screen, no enumeration". Without a row there is
    nothing to count attempts, cooldowns or expiry against, so the code screen would
    answer differently: five wrong codes on a real sign-up end in "too many attempts",
    and on a registered address they never would. Six requests would then reveal who
    has an account. So the row is created either way, with `password_hash` NULL for a
    registered address. Such a row can never create anything: the verify step treats
    a NULL hash as a wrong code even when the code is right, which a test proves by
    finding the never-sent code by brute force with the server's secret. No password
    hash is stored for that address, and it receives the "you already have an
    account" email instead of a code. Both paths do the same work: one password hash,
    one lookup, one row, one email, one cookie.
29. **A resend replaces the code and does not give attempts back.** Only a hash of the
    code is stored, so the same code cannot be sent twice. Five attempts per sign-up
    means five however many codes it sends; with three sends that is still five
    guesses, not fifteen.
30. **Headers set in an after-hook reach the response**, cookies included
    (`api/dispatch.mjs`, `mergeResponseHeaders`), and `context.returned` holds the
    endpoint's error when it failed. That is how the sign-in hook sets the
    known-device cookie and logs a failure without knowing whose it was. One upsert
    decides whether a browser is new, so two sign-ins at once cannot both alert.
31. **`after()` accepts a promise and is supported in route handlers** (Next's bundled
    docs). On a serverless host it relies on the platform's `waitUntil`; a self-hosted
    Node server needs nothing extra. It is wired to
    `advanced.backgroundTasks.handler`, so every email Better Auth or our plugin hands
    to `runInBackgroundOrAwait` goes out after the response. Without a handler (in the
    tests) the send is awaited instead, which keeps the tests deterministic.
32. **`createUser` takes a second, required argument** in 1.7.5, the provisioning
    source. The plugin passes `{ method: "email-password" }`, the same value the stock
    sign-up declares. A reset token is single-use, `onPasswordReset` is the hook for
    the "password changed" email, and `revokeSessionsOnPasswordReset` removes every
    session the user has.
