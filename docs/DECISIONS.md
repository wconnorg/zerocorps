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
- _Superseded on 2026-09-20: the brand is now black and red; see "Brand and landing page"._
  The accent is a cold cyan, chosen so it never collides with the colours that
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
  pushed unless the owner says "push". _Narrowed on 2026-09-21 to `main` only; see
  "Release decisions by the owner (2026-09-21)"._
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

### Brand and landing page, decided by the owner (2026-09-20)

- **The colours are black and red in both themes.** This replaces the cold-cyan accent
  and the earlier rule that the accent is never red. Because the brand is now red,
  **`danger` is orange**, so an error can never be mistaken for the brand. On the dark
  theme the text on a red button is black: white on that red fails the contrast test.
- **The logo is the owner's hand-drawn slashed zero.** `public/brand/zero-mark.png` is
  the mark alone, used as a CSS mask so it takes the text colour in both themes;
  `src/app/icon.png` is the browser-tab icon. The source image is only 224 pixels
  wide, so a vector version is wanted before it is used large.
- **In the name, "Zero" is the text colour and "Corps" is red** (`BrandName` and
  `Wordmark` in `src/components/site/wordmark.tsx`).
- **The landing page leads with the quotation "Forced evolution."**, credited by
  initials only, and one line: "We build trading solutions to empower the industry."
  The closing "Start at zero" section was removed. _Changed on 2026-09-21: the name
  leads and the quotation is small; see "The landing page is ZeroCorps's" below._
- **Link previews carry the logo.** `src/app/opengraph-image.png` and `twitter-image.png`
  (1200 by 630, generated from the mark) with the `summary_large_image` card, so Discord,
  iMessage, WhatsApp and Android Messages show it. It appears once `dev` is released;
  Discord caches previews, so an old link may need `?v=2` added to refresh.
- **Wanted next, NOT built, each needs a plan and the owner's answers first:**
  - a deeper, better-presented replacement for the "Built like a curriculum" section;
  - **a trading journal with risk-to-reward tools**, as a product in its own right.
    It is not in the brief; it needs its own milestone, schema and privacy thinking;
  - **polished animation across the site.** Constraints already known: no third-party
    script origins (CSP), the marketing pages stay static, and `prefers-reduced-motion`
    is respected;
  - "Powered by ZeroCorps" on the course pages, in milestone 7 when they exist.

### Release mechanics, decided by the owner (2026-09-20)

- **The checkpoint commits on `dev` are kept. Nothing is squashed.** A squash only
  tidies history, and it rewrites commits to do it; the owner decided that is not
  worth the risk.
- **"One commit per milestone" now means one merge commit on `main`.** `dev` is
  merged with `git merge --no-ff dev` and a message that names the milestone, so
  `main` shows one entry per milestone and the checkpoints stay reachable under it.
  On `dev`, work is committed in checkpoints. Never `--squash`, never a rebase of
  commits that have been pushed, never a force push.
- **`backup-dev-before-squash`** is a local branch left from the abandoned squash. It
  is deleted only after the milestone 2 release has been verified on the live site.
- **`dev` was pushed to GitHub on 2026-09-20** as the backup that is not on the
  laptop. Before the push, the commits were checked for env files, the outbox and
  backup files (none). After it, GitHub's public API listed no deployment, status or
  check run for the pushed commit: `git.deploymentEnabled` held on the branch's very
  first push, which Vercel's documentation (checked again the same day) does not
  spell out. Had it not held, the result would have been a failed preview build, not
  a change to the live site: only `main` deploys to production.
- **Vercel's functions run in `cle1` (Cleveland)**, set by `"regions"` in
  `vercel.json`. The database is in AWS `us-east-2`, which is the same place. Vercel's
  default is `iad1` (Washington), a short hop away, so the gain on the live site is
  small but free. The slowness the owner felt on the laptop was put down to the
  laptop's own distance from the database (about eight round trips per sign-up). If
  that is right, the live site never paid it. **Not proven yet: the sign-up is timed
  on the live site after release.** The Hobby plan allows exactly one region.
- **The site description is the landing page's line**, "We build trading solutions to
  empower the industry." It lives once, in `src/config/site.ts`, and feeds the landing
  page, the search-result description and the link preview.

### Email DNS, decided by the owner (2026-09-20)

Where an entry here differs from "Email and DNS" above, this one is newer and wins.

- **Resend's records use its newer format ("Resend Forge"):** a DKIM `TXT` at
  `resend._domainkey` and two CNAMEs, `send` → `send.forge.rmta.net` and `rsend` →
  `rsend.forge.rmta.net`. There is no `MX` and no SPF `TXT` of ours, which replaces the
  expectation recorded on 2026-09-19. A CNAME cannot share its name with any other
  record, so nothing else is ever added at `send` or `rsend`.
- **The two CNAMEs are a delegation of trust.** Resend publishes the SPF and bounce
  `MX` that receiving servers read under our names. It is in the hosting ledger, and
  the runbook "Stop using Resend" in [SECURITY.md](SECURITY.md) deletes both CNAMEs
  the day Resend is dropped, so they never dangle.
- **The zone's single `_dmarc` record is `v=DMARC1; p=none;`, added now**, without
  waiting for Proton. This replaces "Proton's DMARC record stays the single DMARC
  record": the record belongs to the zone, not to a mail host. When Proton returns it
  will suggest its own; **we keep ONE and never add a second.** The policy is tightened
  by editing that record once every sender passes.
- **Proton is delayed until about 2026-09-24, so DNS checklist 1 stays on hold.** The
  milestone 2 release does not wait for it.
- The owner added the four records on 2026-09-20. They were confirmed the same day on
  two public resolvers and on Namecheap's authoritative server, and both CNAME targets
  publish an SPF record and a bounce `MX`. Resend's public Forge page does not list
  the `rmta.net` hostnames, so the targets were checked another way: the address block
  in `send`'s SPF is registered at ARIN to Resend. [DNS.md](DNS.md) has the values.
- **2026-09-21: Resend's dashboard shows `zerocorps.org` as verified and able to send**
  (the owner's report). The domain is in Resend's `us-east-1` region. **Receiving stays
  OFF in Resend**, because it would compete with Proton's `MX` rows. A new session
  repeated the lookups the same day: all four records and both CNAME targets answered
  as recorded, with exactly one `_dmarc`.

### Claude Code on the laptop, decided by the owner (2026-09-21)

- **Claude Code's file tools are denied every env file except the example.**
  `.claude/settings.json` (committed; it holds no secret) carries the deny rules
  `Read(./.env)`, `Read(./.env.*)` and the carve-out `Read(!.env.example)`, the same
  shape as `.gitignore`. Why: `.env.local` kept ending up as the owner's open editor
  tab, and the VS Code extension attaches the open file's name, and any selected text,
  to each message. A matching `Read` deny rule stops both from reaching the assistant,
  and also blocks its Read, Edit, Write, Grep and Glob tools and shell commands such as
  `cat` on those paths (Claude Code's documentation, read 2026-09-21).
- **Proven the same day without touching `.env.local`:** a dummy `.env.denytest` was
  refused, `.env.example` still opened, and `npm run env:check` still worked, because
  the owner's tools read the file from inside Node, which the rule does not cover.
- **What it does not cover:** a program that opens the file by itself. So the standing
  rule is unchanged: nothing the assistant runs may print a value from `.env.local`.
- **`.outbox/` is denied the same way** (`Read(./.outbox/**)`, added the same day when an
  outbox file turned up as the open tab). Those files hold the owner's real address and
  live codes and reset links, and with one shared database a reset link made on the
  laptop also works on the live site until it expires. Proven with a dummy file. The
  site, the tests and `npm run verify` read the outbox from inside Node and are
  unaffected.

### The landing page is ZeroCorps's, and the dashboard shell comes next (owner, 2026-09-21)

- **The home page is the ZeroCorps page, not the Academy's.** The Academy is one product
  under it. The hero's heading is the name (ZERO in the text colour, CORPS in red). Under
  it, at the size the description line had, is the quotation "Forced evolution." with
  the red quote marks, credited as "J.B." (two initials, replacing three). The hero no
  longer shows "We build trading solutions to empower the industry."; that line stays in
  `src/config/site.ts` as the search-result and link-preview description.
- **The hero button is "Enter the dashboard"** and links to `/dashboard`. A signed-out
  visitor is sent to sign-in and back, as before.
- **The site title and the link-preview title are "ZeroCorps".** "ZeroCorps Academy"
  stays on `/academy`.
- **The Academy has ONE labelled section on the home page:** "Built like a curriculum,
  not a feed." with its three pillars, under an ACADEMY label, with the "Enter the
  Academy" button. "See your consistency." and its calendar preview moved to `/academy`
  unchanged. No new marketing copy was written.
- **Both buttons take the same road (owner, later the same day).** "Enter the Academy"
  links to `/dashboard` too, because the Academy lives behind the account as a tile on
  the dashboard. A signed-out visitor lands on sign-in, which offers "Create an
  account", and is brought back to the dashboard; a signed-in one goes straight
  through. Neither link is pre-loaded. `/academy` stays as the public page about the
  Academy (in the sitemap, and the dashboard's Academy tile leads there until milestone
  7). A quiet "Learn more" link beside the button leads to it, so a visitor who cannot
  sign in during the beta can still read about it and search engines reach it.
- **`?next=` cannot send anyone off the site (fixed before release, 2026-09-21).** The
  sign-in form is the only reader of `next`, through `safeNextPath`. It rejected full
  URLs, `//host`, `/\host` and control characters, but it checked the input only:
  `/.//evil.example` and `/x/..//evil.example` passed, and normalising them produced
  `//evil.example`, which a browser reads as another site. A phishing link could have
  used the real sign-in page as its springboard. The result is now checked as well, and
  must resolve to this site. The attack tests cover it, a mutation check proved they fail
  without the fix, and `npm run verify` visits such a link. It was never live.
  `next` is NOT carried through sign-up, the code screen or the reset: those end at
  `/dashboard`, which is the only protected page today, so nothing is lost. Carrying it
  belongs with the second protected page (milestone 4), through the same function.
- **The invite-only note on `/sign-up` links to the Discord** when `DISCORD_INVITE_URL`
  is set ("No invitation yet? Join the Discord."), as the "closed" state already did.
  During the private beta the Discord is where the owner sends people, so
  `DISCORD_INVITE_URL` joins the Production variables at step 5.
- **The dashboard shell is the first slice after the milestone 2 release, ahead of
  onboarding. NOT built, and no code until milestone 2 is live and the owner has
  approved a plan.** What a signed-in user lands on: a dashboard of tiles, starting with
  one tile, "Academy", and a profile icon at the top right (the grey default avatar)
  that opens a small menu. Until profile and settings exist, the menu holds only "Sign
  out". More tiles come later (the trading journal, for one).
  - **Built on `dev` on 2026-09-21, after the release, on the owner's word** ("proceed
    with functionality"). **The Academy tile says "Coming soon" and is not a link**
    (owner, the same day): there are no lessons until milestone 7, and the public
    `/academy` page would ask a signed-in member to sign up. The tile is labelled
    "ZeroCorps Academy" and reuses the public page's one line; no new copy. The header
    of the signed-in area gains the profile button (the grey default picture) whose
    menu holds "Sign out"; the standalone sign-out button it replaced is gone. No
    library was added: the menu is a small disclosure menu (Escape, a click outside or
    focus leaving closes it). Tests render the dashboard and the menu from plain values,
    so nothing signs in to the one shared database. **The owner's testing on the laptop
    comes before it is released.**
  - **The order after it, agreed the same day:** the username step (one additive
    migration, forced after the first sign-in), then profile-picture upload, which needs
    file storage and is decided when it is reached. Everyone has the grey default
    picture until then, as the brief says.
  - **What this does to the brief's order.** The brief has onboarding as milestone 3 and
    "dashboard with the Academy tile and the profile menu, plus the settings pages" as
    milestone 4. The shell is the first part of milestone 4, pulled ahead of milestone 3. Milestone 3 is unchanged and follows it: once it lands, a first sign-in is sent
    through `/onboarding` before reaching the dashboard, and the uploaded avatar takes
    the grey default's place in the shell. Milestone 4 shrinks to the settings pages
    and the menu's remaining entries (profile, settings). The shell needs no schema
    change. Its Academy tile leads to `/academy` until milestone 7 builds the lessons.

### The home page's look, decided by the owner while watching it live (2026-09-21)

The owner's direction: a stark corporate look in the manner of Arasaka (black, red,
sharp edges, restrained motion). Built on `dev` after the milestone 2 release, with the
owner watching the laptop's dev server and answering as it changed. Not released yet.

- **The hero.** The chart is replaced by a **turning wheel of three product tiles**:
  ZeroBot, ZeroCharts and ZeroCorps Academy. The quotation and "J.B." are larger and the
  quotation marks take the text colour (white on the dark theme). The hero's background
  grid is gone. The chart component is kept, unused: it is Academy material.
- **Each product has its own tone:** ZeroBot blue, ZeroCharts purple, the Academy the
  brand red. They are theme tokens (`--tone-bot`, `--tone-charts`) in both themes, held to
  the same AA contrast test as every other text colour. A tile names its tone with
  `data-tone`; there are no inline styles.
- **The tiles:** sharp corners and a plain outline (the owner liked the outline and
  asked for the corner brackets to go), no index number on top, "COMING SOON" on ZeroBot
  and ZeroCharts only. The Academy tile says nothing on top and **leads to `/academy`**,
  which now says "COMING SOON" itself. ZeroBot and ZeroCharts carry one short line each.
  **Those two lines are placeholder copy written at the owner's request** ("I'll leave it
  up to you, super short"); the ZeroCharts one is the owner's own pitch cut down. They
  are the owner's to edit, in `src/components/marketing/products.tsx`.
- **The motion:** slow and even (a 2.2 second turn, every 8 seconds). Tiles are always
  solid: one at the side is dimmed by a dark veil and shows no words, because half a
  name behind the front tile ("OBOT") looked broken; the words fade in at the front. The
  tiles share one real 3D space, so they pass behind each other; a fixed layer order had
  made a clicked tile jump on top at once. Nothing is drawn under the wheel: a click at
  either side brings that tile forward (two invisible zones outside the 3D space catch
  it, because a tile at the side stands behind the wheel's own plane and the browser
  gives the click to the wheel). The timer is an invisible element's CSS animation, so
  resting the pointer on the wheel pauses it exactly, a background tab stops it, and a
  visitor who asked for reduced motion never gets a wheel that turns by itself. The
  previous, next, pick-one and pause buttons remain for the keyboard and screen readers,
  hidden until focused. No library.
- **The section below the hero is the three products side by side** (the same tiles,
  without the large faint mark). The three Academy "pillars", the "Enter the Academy"
  button and the "Learn more" link are gone from the home page; `/academy` keeps its own
  content and is reached through the Academy tile.
- **The header:** the logo and the name sit in the middle, on all three headers, and the
  logo takes the text colour there. The footer's logo stays red.
- **A lesson about working this way:** the owner saw every half-finished state through
  hot reload ("you lost the colour scheme"). Changes that belong together should land
  together, and the owner should be told when a state is ready to judge.

### The username step: the owner's answers (2026-09-21). NOT built yet

- **A username can be changed from the start.** This goes further than the brief, which
  puts "username change" in the settings of milestone 4. So the change needs somewhere to
  live and a rule against churn; the plan below carries both.
- **The display name is asked for on the same screen**, optional and not unique. It needs
  no new column: `users.display_name` already exists (Better Auth's `name`), empty until
  onboarding fills it.
- Still the brief's rules: 3 to 20 characters, `a-z 0-9 _`, stored lowercase, unique
  without regard to case, a reserved-word blocklist, a rate-limited availability check as
  the member types, and **the database constraint as the real guard** (two people claiming
  one name at the same moment must end in "just taken", never an error page).
- Better Auth's own username plugin is still NOT used: it registers a username sign-in
  route, which breaks hard rule 1. A small local plugin is used instead, as for sign-up.

### The Academy tile is the way IN, and slow tests no longer read as failures (2026-09-21)

- **On the home page, "Enter here" on the Academy tile leads to the sign-in and sign-up
  road, not to the Academy's page** (owner: it "leads to a page that says coming soon;
  direct it to sign in / sign up"). It goes to `/dashboard`, so a signed-out visitor
  lands on sign-in, which offers "Create an account", and comes back; someone already
  signed in goes straight through. It is never pre-loaded.
- **On the dashboard the same tile still leads to `/academy`**, the black "coming soon"
  page: a member is already through the door that `/dashboard` opens, and sending them
  back to sign in would be a loop. `ProductFace` takes an `href` that the dashboard
  passes; everywhere else the product's own road is used.
- **Nothing on the home page links to `/academy` any more.** It stays in the sitemap and
  keeps its heading, so search engines still reach it.
- **Database tests get 60 seconds instead of Vitest's default 5** (`vitest.config.mts`).
  Each one starts a whole Postgres (PGlite) in the test process, which takes longer than
  5 seconds on the owner's laptop when anything else is running. Fifteen such tests had
  no timeout of their own, and on 2026-09-21 two release checks failed for that reason
  alone: once a worker died of memory pressure while the dev server, a backup and the
  check all ran together, and once this test simply ran long. Nothing was wrong in the
  code either time. A slow machine must not read as a broken build, least of all when it
  stands between the owner and a release. The slowest tests keep their own longer limits.

### Released on 2026-09-21: the home page, the dashboard shell and the Academy's page

On the owner's word ("looks good", "push all changes to the live website"), `dev` was
merged into `main` as one `--no-ff` merge commit, `bbd5269`, made without switching the
working folder off `dev`, and `main` was pushed. GitHub recorded Vercel's production
deployment of it as a success. **No database change was in this release.**

What went live: the ZeroCorps home page (the turning product wheel, the products row, the
centred header, the white header logo), the dashboard shell (three product tiles, the
profile button with "Sign out"), `/academy` as a black "coming soon" page, the `?next=`
fix, the guarded test-account cleanup and `npm run env:handoff`.

Proven before the merge, on a quiet laptop: typecheck, lint, **207 tests** and the
production build; then **86 browser checks** against that production build, including the
wheel turning by itself, holding still under reduced motion, a side click bringing a tile
forward, `/academy` black in both themes, and sign-in offering "Create an account".

**A first attempt at the full check died of memory pressure** (the owner's dev server, a
backup and the check at once) and reported a crashed worker and a timed-out test. Nothing
was wrong with the code, and it passed on the second run with the laptop quiet. **Only one
heavy thing runs on this laptop at a time.**

**The first backup holding a real account** was taken by the owner the same day, and
verified by decrypting it again: 1 user, 1 account, 6 auth events, migrations applied 3.
The restore drill (`npm run db:restore:check`) is still to run.

### The dashboard's look, decided by the owner while watching it live (2026-09-21)

- **Three equal tiles, one above the other:** ZeroCorps Academy, then ZeroBot, then
  ZeroCharts, in the same tones as the home page. They are the same tile component, in a
  "row" layout for wide tiles: the words on the left and ONE action at the middle right.
- **The action:** a red **"Enter here"** button on the Academy, which leads to `/academy`
  (that page says "COMING SOON"); on ZeroBot and ZeroCharts, "COMING SOON" drawn as a
  button that cannot be pressed. This replaces "the Academy tile is not a link". The
  same red button is the Academy tile's way in on the home page too, where it replaced a
  small text link.
- **One heading**, light, in capitals and widely spaced, with a short red rule under it
  (the owner saw "Dashboard" twice and asked for a sleeker title). The red wash from the
  home page's hero sits behind the top of the page, and the signed-in area's header has
  the same bar under it as the home page's.
- **"Signed in as ..." stays on the dashboard** and is to show the USERNAME, not the
  email address. There are no usernames until the next slice, so it shows the email
  address until then. A label on the profile button instead was tried and reversed at
  the owner's word within minutes.
- The profile button and its menu ("Sign out") are as built; the owner approved them.

### Profile pictures live in the database; the Academy's page for now (owner, 2026-09-21)

- **Profile pictures will be stored in Postgres, not in Supabase Storage.** The owner's
  words: "everything lives in the database". This replaces the brief's S3-compatible
  storage for avatars and DECISIONS.md's earlier "Storage" entry, for pictures. Why it
  fits the owner's priorities: no new service, no new keys, nothing new in the hosting
  ledger, and the pictures are in the same encrypted backups as everything else. The
  price, accepted: migrations are never undone, so the table stays even if pictures move
  out one day; and every picture is served through the app. It is still behind the small
  storage wrapper, so the place can change. Pictures are small (resized and re-encoded on
  the server, which also strips metadata such as a phone's GPS position), so the
  database stays small. **Not built:** it is the slice after the username step. The
  brain export is unaffected: it is limited to usernames, ranks and progress.
- **`/academy`, where "Enter here" leads, is pitch black with a red glow and two small
  words, "COMING SOON", in the middle**, until the lessons exist (milestone 7). It is
  black in BOTH themes: that part of the page carries its own `data-theme="dark"`. The
  earlier landing content (the features, the calendar preview, the sign-up and sign-in
  buttons) is gone from it. An account is reached through "Enter the dashboard", and the
  sign-in page offers "Create an account". The page keeps a heading for screen readers
  and search engines.

### The test-account cleanup can no longer delete a live account (2026-09-21)

After the owner's real sign-up, the laptop's `EMAIL_ALLOWLIST` named the owner's REAL
account, so `npm run db:cleanup-test-accounts` would have deleted it. The command now
deletes an account only when the event log shows its sign-up was completed on the laptop
(`app_env = 'local'`). An account made on the live site, or one whose origin cannot be
told, is kept with everything keyed by its address, and the command says so. The check
runs again inside the deleting transaction. Tests cover all three origins.

### Release decisions by the owner (2026-09-21)

These reached the session in a handoff written by the owner's planning assistant, which
had made them on the owner's behalf. The owner was asked about each one directly and
confirmed all of them.

- **The standing push rule.** `dev` may be pushed to GitHub after any checkpoint commit
  without asking, because `dev` never deploys and the push is the backup that is not on
  the laptop. **`main` needs the owner's explicit "push" every time.** The repository is
  public, so the commits are still checked for env files, secrets and real addresses
  before every push. This narrows "nothing is pushed unless the owner says push".
- **Finding 28 is approved.** An address that already has an account gets a pending row
  with no password hash, so the code screen behaves the same for everyone. Not revealing
  who has an account matters more than the letter of "no pending row".
- **Supabase's CA certificate is pinned before the release**, as one small commit, and
  it is kept only if `npm run db:check` then reports the certificate as verified on the
  laptop. The certificate is public and may be committed. The connection must fail
  closed and never fall back to an unverified link. If it turns into more than a small
  change, the work stops, the hosting ledger says so, and it becomes the first job after
  the release. It gets its own plan before any code.
  - **The plan, approved the same day.** The certificate comes from the owner's own
    Supabase dashboard. Both places that open a connection (`src/db/client.ts` and
    `scripts/lib/database.mjs`) verify the chain and the host name against the pinned
    certificates only, with no fallback; `db:check` stops retrying unverified. A guard
    test fails if "encrypt, don't verify" comes back.
  - **Two additions from the owner.** The pin is a LIST of certificates, so a rotation
    is staged by adding the new one beside the old one before the old one is removed.
    `db:check` and `npm run check` warn loudly when a pinned certificate has under 90
    days left, and fail only when one has expired. SECURITY.md gets the runbook
    "database connections fail after Supabase rotates its CA" and a ledger line that
    the pin is ours to maintain, on Vercel and after the move to self-hosting.
  - The owner's real sign-up on the live site is what proves the verified connection
    works from Vercel. The rollback is Vercel's previous deployment.
- **`PRIVACY_CONTACT` is a `@zerocorps.org` address.** The variable takes the `mailto:`
  form. The address goes into Vercel only, never into this repository or into chat.
- **The "working contact channel" gate for `PRIVACY_CONTACT` moves from the release to
  the invitations.** Proton may not be working until about 2026-09-24. Proton's two `MX`
  rows are intact, but whether the mailbox accepts mail before then depends on the
  owner's Proton account, which DNS cannot show. So: the milestone 2 release goes ahead
  when its other steps are done, and **until a test message sent to that address from
  another mailbox has arrived, the live `SIGNUP_ALLOWLIST` holds only the owner's own
  addresses.** While the owner is the only member, nobody else's data depends on that
  contact. Friends are added only after the test message arrives, and the date goes
  here. Replies sent from the address fail SPF and DKIM until DNS checklist 1 is done,
  so they may land in spam until then. The owner's Gmail stays off the public page.
  `SECURITY_CONTACT` is unaffected: it is GitHub's private vulnerability reporting page
  and still gates the release.

### Where milestone 2 stands (keep this current; last updated 2026-09-21)

A new session starts here. Milestone 2 is **built on `dev`, tested by the owner on
the laptop, and in its release walkthrough**; `main` holds only milestone 1 and the
docs. `dev` is pushed to GitHub as a backup and is not built by Vercel.

**Built and proven** (typecheck, lint, 168 tests, production build, `npm run verify`):

- **Environment:** `src/env-schema.ts` (read by `src/env.ts`) with every milestone 2
  key, and the owner's tools `env:check`, `env:secrets` and `env:app-url`. The owner's
  `.env.local` is complete.
- **Database:** migrations `0000_app_role` and `0001_auth_core` were applied to the
  real database on 2026-09-20 after an encrypted backup and a passing restore drill.
  The app connects as `zerocorps_app`, and `npm run db:check-role` passed every line
  with nothing to review. The guarded commands are `db:check`, `db:backup`,
  `db:restore:check`, `db:migrate`, `db:check-role`, `db:counts`,
  `db:cleanup-test-accounts` and `sessions:revoke-all`; the ones that change anything
  need a person at a terminal.
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

**Done by the owner on 2026-09-20:** the second migration, `0002_email_code_signup`,
is applied (there is one database, so production is migrated too), and local testing
passed: sign-up by code, sign-in, sign-out, password reset and the invite-only refusal.

**The release walkthrough, one step at a time, in this order:**

The numbering is the owner's handoff of 2026-09-21, so both assistants mean the same
step by the same number.

1. **Done:** Resend's account, the domain, DNS checklist 2 in [DNS.md](DNS.md) verified
   by lookup (2026-09-20, repeated 2026-09-21), the single `_dmarc` record at `p=none`,
   and Resend's dashboard showing the domain as verified (2026-09-21).
2. `npm run db:cleanup-test-accounts`, so the owner's test addresses are free again on
   the live site. **Run on 2026-09-21: it removed nothing**, because the one address in
   `EMAIL_ALLOWLIST` had no account, no waiting sign-up, no events and no counters. The
   owner did test sign-ups on 2026-09-20, so either the cleanup had already been run or
   the test used another address. **`npm run db:counts` settles it** (built the same
   day: rows per table, counts only, read-only, as `zerocorps_app`). `users` must be 0
   before the release and exactly 1 after the owner's real sign-up. If it is not 0, the
   owner adds the address they tested with to `EMAIL_ALLOWLIST` and runs the cleanup
   again.
3. **Done 2026-09-21 (the owner's report):** the Resend API key, sending access only,
   restricted to `zerocorps.org`, pasted straight into Vercel as `RESEND_API_KEY`
   (Production, sensitive). It was never in chat or in `.env.local`.
   **Re-test on the laptop, 2026-09-21,** after the auth code changed (the `next` fix,
   the pinned connection, the new landing page): the owner signed up with the
   allowlisted address using the code from `.outbox/`, landed on the dashboard, and the
   server log showed every request answering 200 (start 1.6 s, code check 1.9 s on the
   laptop). The cleanup then removed exactly that 1 account, 1 event and 2 limit
   counters, so `users` is 0 again before the release.
4. **Done 2026-09-21 (the owner's report):** GitHub's Dependabot alerts, secret scanning
   with push protection, and private vulnerability reporting. The reporting page's URL
   becomes `SECURITY_CONTACT`.
5. The Production variables in Vercel. Keep `NEXT_PUBLIC_APP_URL`. Add `APP_ENV`,
   `SIGNUP_MODE=allowlist`, `SIGNUP_ALLOWLIST`, `DATABASE_URL` (the `zerocorps_app`
   one), `RESEND_API_KEY`, `SECURITY_CONTACT`, `PRIVACY_CONTACT`, `DISCORD_INVITE_URL`
   (the public invite link, shown on the invite-only sign-up page), and three NEW values
   for `BETTER_AUTH_SECRET`, `HMAC_SECRET` and `CRON_SECRET` that differ from the
   laptop's and never appear in chat. **Never add** `DATABASE_URL_MIGRATIONS`,
   `BACKUP_DIR` or `EMAIL_ALLOWLIST`. Leave `EMAIL_FROM` and `TRUSTED_IP_HEADER` unset.
   **`npm run env:handoff` carries the four sensitive ones** (built 2026-09-21): it makes
   the three secrets fresh, reads the app's `DATABASE_URL` and refuses it unless its role
   is `zerocorps_app`, puts one value at a time on the clipboard through the clipboard
   program's standard input, never shows one, and clears the clipboard (and Windows's
   clipboard history) afterwards. Nobody opens `.env.local` to copy a URL by hand.
   `PRIVACY_CONTACT` is the owner's `@zerocorps.org` address in the `mailto:` form; it
   goes into Vercel only, never into this repository. **`SIGNUP_ALLOWLIST` holds only
   the owner's own addresses** until the test message to that address has arrived (the
   moved gate, above).
   **Done 2026-09-21 (the owner's report):** the six typed variables, then the three
   new secrets and the app's `DATABASE_URL` through `npm run env:handoff`.
6. `npm run db:backup`, then `npm run db:restore:check` ("migrations applied: 3").
   **Moved by the owner on 2026-09-21 ("fast path"): it runs right after the owner's
   real sign-up,** not before the release. The database held 0 accounts at the release,
   and the restore drill had passed on 2026-09-20, so there was nothing new to protect
   until that first account existed.
7. The owner reads `/terms` and `/privacy`. **Moved by the owner the same day: it gates
   inviting anyone, not the release.** Until then the owner is the only person who can
   sign up, so nobody else agrees to the drafts. It joins step 10.
8. `git merge --no-ff dev` on `main`; push on the owner's word; `npm run verify`
   against the live site; the owner's real sign-up in `allowlist` mode, timed. That
   sign-up is also the proof that the verified database connection works from Vercel;
   if it fails, the rollback is Vercel's previous deployment. `npm run db:counts` then
   shows exactly 1 in `users`.
   **Released 2026-09-21.** On the owner's explicit word, `dev` was merged into `main`
   as one `--no-ff` merge commit, "Milestone 2: auth" (`871359d`, parents `35ad045` and
   `bd55d15`), created without switching the working folder off `dev`, and `main` was
   pushed. GitHub recorded Vercel's production deployment of that commit as a success.
   **Not verified yet:** every automated request to `zerocorps.org` (curl, headless Edge,
   and a fetch from another network) is answered with Vercel's "Security Checkpoint",
   HTTP 403 with `X-Vercel-Mitigated: challenge`. At milestone 1 the same verification
   ran against the live site, so something on the Vercel side differs: Attack Challenge
   Mode or Bot Protection in the project's Firewall, or an automatic mitigation. Open
   until the owner has looked at the site in a normal browser and at the Firewall tab.
   The owner's real sign-up, `npm run verify` against the live site, and the
   milestone's "Done" all wait on that.
   **The owner's real sign-up on zerocorps.org worked the same day**, in `allowlist`
   mode, in a normal browser: the site loads for real visitors, Resend delivered the
   code to a real mailbox, the pinned database connection works from Vercel, and the
   Production variables are right. `npm run db:counts` then showed exactly 1 user, 1
   account, 1 session, 1 known device and no sign-up left waiting. It was not timed.
   **Still open:** Vercel keeps challenging every automated client (checked again after
   the sign-up), so `npm run verify` against the live site has not run. The same pages
   passed all 79 checks on the production build on the laptop. The owner is to look at
   the project's Firewall tab (Attack Challenge Mode, Bot Protection). It matters later
   too: Agent Zero's calls to the internal API (milestone 8) are automated traffic, and
   the first run of the daily cleanup cron should be confirmed.
9. Afterwards: delete `backup-dev-before-squash`, mark milestone 2 "Done" in
   AGENTS.md, and refresh Discord's cached link preview by sharing the link with `?v=2`.
10. **Before anyone but the owner is invited:** Proton is restored (DNS checklist 1), a
    test message sent to the `PRIVACY_CONTACT` address from another mailbox arrives,
    and the date is recorded above; **and the owner has read and approved `/terms` and
    `/privacy`** (moved here from step 7). Only then are friends added to
    `SIGNUP_ALLOWLIST`.

**Open questions for the owner:** none. Both earlier ones were answered on 2026-09-21
(see "Release decisions by the owner" above): finding 28 is approved, and Supabase's CA
certificate is pinned before the release. **The pinning was built on 2026-09-21**: the
root certificate from the owner's dashboard is in `certs/` and pinned in
`src/lib/db-ca.ts`; `src/db/client.ts` and `scripts/lib/database.mjs` trust that list
only, with no unverified mode left anywhere; `db:check` makes one verified attempt and
reports the days each certificate has left. A mutation check proved the guard test: with
"encrypt, don't verify" put back, it fails. **Proven on the laptop the same day:**
`npm run db:check` reported both URLs as "VERIFIED against the pinned certificates"
(the app's role on the transaction pooler and the owner role on the session pooler),
which was the owner's condition for keeping the change. The proof from Vercel is the
owner's real sign-up at step 8.

**Housekeeping:** the work sits in checkpoint commits on `dev`, made for safety at the
owner's request. **They are not squashed** (see "Release mechanics" above): `main`
gets one `--no-ff` merge commit for the milestone. The status table in AGENTS.md
changes to "Done" only after the release is verified on the live site.

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
    password. This departs from the letter of "no pending row", on purpose. The owner
    approved it on 2026-09-21.** The spec asks for two things that pull apart: "no
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
