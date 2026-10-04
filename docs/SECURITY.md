# Security

Security is the first priority of this project ([BRIEF.md](BRIEF.md)). This file is
short on purpose and is kept current: when a control lands, its status changes
here; when new code relies on something a host does for us, the ledger gains a line.

The repository is public. This file describes controls and procedures. It never
contains a secret, a real address or a dashboard link.

**Status key:** _live_ is in production today. _M2_, _M4_ and so on mean "arrives
with that milestone". _Owner_ means it is an action only the owner can take.

## 1. Threat model

### What we protect

- **Credentials:** password hashes; from milestone 5, the authenticator-app secrets and
  backup codes, stored encrypted with `BETTER_AUTH_SECRET`.
- **Personal data:** email addresses, usernames, profile pictures and Discord IDs. No
  phone numbers: two-factor is app codes only (owner, 2026-09-29). We hold as little
  as possible.
- **Sessions**, and the secrets that sign them.
- **Integrity of progress and rank.** Rank unlocks Discord channels, so forging it
  is worth something.
- **The owner's provider accounts:** GitHub, Vercel, Supabase, Namecheap, Resend,
  Proton and the Discord developer account. Any one of them is a way into the whole
  site.
- **The owner's laptop:** `.env.local`, database backups and, from milestone 9, the
  brain vault. **Since 2026-10-01 the vault holds every member's email address** (the
  owner's decision), as plain text in a folder: full-disk encryption on the laptop is what
  protects it, and it must never be copied to a sync service or shared.

### Who attacks it, and what answers them

| Threat                                                                                                                                               | Control                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Status   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Credential stuffing and password guessing                                                                                                            | Sign-in limits per address + IP with a per-address ceiling; 12-character minimum; slow password hash (scrypt); one error message for every failure; new-device email; the event log                                                                                                                                                                                                                                                                                                                                                                                               | M2       |
|                                                                                                                                                      | An optional second factor: a code from an authenticator app (TOTP), or one of 10 single-use backup codes. A correct password alone is not a sign-in: no session, no remembered browser and no new-browser alert until the code. Five tries per sign-in, and 10 wrong codes in a row lock the code screen for 15 minutes; each app code works once. Switching it on or off and new backup codes need the password (counted per member); every change, and every use of a backup code, is emailed to the member. Attack tests in `two-factor.test.ts`                               | M5 (dev) |
| Taking over an account at sign-up (registering someone else's email)                                                                                 | Nothing is written to `users` until an emailed code is entered in the browser that started the sign-up; the code is never accepted by email alone; pending sign-ups are independent; CSRF check on start                                                                                                                                                                                                                                                                                                                                                                          | M2       |
| Finding out who has an account                                                                                                                       | Same response and same screen for a registered address; "you already have an account" goes to the mailbox instead; same work done on both paths; reset answers identically for unknown emails                                                                                                                                                                                                                                                                                                                                                                                     | M2       |
| Email bombing and sign-up abuse                                                                                                                      | Per-address limits, 10 emails a day per address across all types, 3 sends per pending row, `SIGNUP_MODE` (`closed`, `allowlist`, `open`) as the kill switch                                                                                                                                                                                                                                                                                                                                                                                                                       | M2       |
| SMS pumping                                                                                                                                          | Nothing is ever texted: two-factor is app codes only and no phone number is collected (owner, 2026-09-29). Better Auth's code-sending endpoints are switched off, and a test proves it                                                                                                                                                                                                                                                                                                                                                                                            | M5 (dev) |
| Getting past a member's two-factor through ZeroCorps (someone pretending to be them)                                                                 | Only the owner can switch it off, with `npm run 2fa:reset` at a terminal, for one exact username, after the identity check in the runbook below. It signs every device out, is emailed to the member and shows in their security activity                                                                                                                                                                                                                                                                                                                                         | M5 (dev) |
| A trusted browser that falls into someone else's hands                                                                                               | "Trust this browser" lasts 30 days, is refreshed at each sign-in and is offered with the words "only on a device that is yours alone"; turning two-factor off, turning it on again and a password reset each forget every trusted browser of the account                                                                                                                                                                                                                                                                                                                          | M5 (dev) |
| Stolen session                                                                                                                                       | `httpOnly`, `secure`, `sameSite=lax`, host-only cookies; CSP; HSTS; reset signs out every session                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | M2       |
|                                                                                                                                                      | Users see and revoke their own sessions; sensitive actions need the password again                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | M4 (dev) |
| Cross-site request forgery                                                                                                                           | Better Auth's origin and CSRF checks on every auth endpoint, including first-visit requests; `form-action 'self'`; `sameSite=lax`                                                                                                                                                                                                                                                                                                                                                                                                                                                 | M2       |
| Cross-site scripting                                                                                                                                 | React's escaping, no third-party scripts, CSP (`object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | live     |
| Being sent off the site after sign-in (open redirect)                                                                                                | `?next=` is accepted only as a path on this site, checked before AND after the path is normalised (`/.//host` becomes `//host`), and must resolve to this site; anything else falls back to `/dashboard`. One reader (`safeNextPath`), attack tests, and a visit in `npm run verify`                                                                                                                                                                                                                                                                                              | M2       |
| Passing for another member, or for ZeroCorps, by name                                                                                                | Usernames are `a-z 0-9 _` only, so no look-alike letters; a reserved list for the brand and staff that ignores underscores; the unique index decides a clash, not a check before it; a name somebody leaves is held for 30 days; one free change, then a 30-day wait judged under a row lock; display names refuse invisible and direction-override characters; the "free / taken" hint is signed-in only and counted per member, so the name list cannot be harvested                                                                                                            | M3       |
| A lesson that puts a script or a harmful link on the page                                                                                            | Lessons are rendered on the server by markdown-it with raw HTML switched off; `javascript:`, `vbscript:`, `file:` and non-image `data:` links are refused; links to other sites get `noopener noreferrer`; attack tests in `markdown.test.ts`. The lessons are the owner's own files, and they are treated as untrusted anyway                                                                                                                                                                                                                                                    | M7       |
| Forging Academy progress or a rank                                                                                                                   | Every write takes the member from the session and every id from the lesson files; drafts and coming-soon courses cannot be completed; a checkpoint opens only after its lessons and is graded on the server, which never sends the right answers to the browser; six attempts an hour per member; steps are stored once and never removed. **Accepted:** the answer keys are in the public repository (the owner's decision for the Rookie stage), and "mark complete" is the member's own word. Ranks 1 to 3 prove reading, not skill, so they must not unlock anything valuable | M7       |
| Linking someone else's Discord to a member (OAuth CSRF), or keeping Discord's tokens                                                                 | The standard `state` check: random, in a signed httpOnly cookie, bound to the member who started the link, ten minutes, used once; a mismatch links nothing and never reaches Discord. The access token is revoked straight after reading the id and username and is never stored. One Discord account per member, enforced by a unique index. Discord is never a sign-in (hard rule 2), and no `accounts` row is made. Attack tests in `discord-plugin.test.ts`; a mutation check proved the member-binding test                                                                 | M6       |
| Taking over an account by moving its email address                                                                                                   | The member's password (counted per member) and a 6-digit code from the NEW inbox, bound to the account that asked, five guesses, 15 minutes, used once, stored only as a keyed hash; the old address is always told (a security notice, never held back by the daily cap); a taken address gets the same answer as a free one; Better Auth's link-based `/change-email` stays off                                                                                                                                                                                                 | M4       |
| A hostile picture upload: script in an SVG, a file that only claims to be a picture, a decompression bomb, a photo's hidden location                 | Only JPEG, PNG and WebP are decoded; the size is read from the header and refused over 40 megapixels before any pixel is decoded; uploads over 2 MB are refused unread; everything is re-encoded by sharp to a 256-pixel WebP that keeps pixels only; served only to its owner, from our own origin, as `image/webp` with `nosniff`; 20 changes an hour per member                                                                                                                                                                                                                | M3       |
| Harassment and doxxing of members                                                                                                                    | Minimal data; no public profiles; the internal API never returns emails or phones; the brain export is restricted to an allowlist inside the database                                                                                                                                                                                                                                                                                                                                                                                                                             | M2 to M9 |
| A leaked secret                                                                                                                                      | Secrets only in `.env.local` and the host's settings; GitHub secret scanning and push protection; rotation runbook below; the coding assistant's file tools are denied every env file except the example, and the email outbox (`.claude/settings.json`), so an open editor tab cannot put one in a transcript                                                                                                                                                                                                                                                                    | M2       |
| The brain export reading, or letting out, more than its allowlist                                                                                    | Three views in their own `brain` schema hold the allowlist; `brain_reader` can read those and no table of the app (tests read every table as that role), cannot write (and is read-only by default, with a 30-second statement limit) and cannot log in until `npm run brain:setup`; the export refuses to run if its role could read any table of the app; Supabase's API roles get nothing on the schema, which the Data API does not expose; the site refuses to start with `BRAIN_DATABASE_URL` set                                                                           | M9 (dev) |
| Text a member typed attacking the owner through the brain: HTML that loads a remote image when a note opens, or links and tags that redraw the graph | A display name or a Discord name is only ever written as a quoted YAML string in the frontmatter or inside an inline code span in the body, never as Markdown or HTML; usernames and Academy ids come from fixed alphabets; links go by full path, so a note's name cannot capture one; attack tests in `notes.test.ts` and `markdown.test.ts`                                                                                                                                                                                                                                    | M9 (dev) |
| The brain vault leaving the laptop                                                                                                                   | The export refuses a vault inside the public repository or around it, the home folder, and any folder OneDrive (or another sync service) uploads; it takes over only a folder it made, and deletes or overwrites only notes it wrote; nothing about members is printed                                                                                                                                                                                                                                                                                                            | M9 (dev) |
| A role's password kept by the database (logs, query statistics) after `ALTER ROLE ... PASSWORD`                                                      | `npm run brain:setup` never sends the password: it sends a SCRAM-SHA-256 secret computed on the laptop, as psql's `\password` does (checked against RFC 7677 and against Postgres itself)                                                                                                                                                                                                                                                                                                                                                                                         | M9 (dev) |
| A stolen or compromised laptop                                                                                                                       | Full-disk encryption; encrypted backups; the brain role can read three views and nothing else; rotation runbook                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Owner    |
| A compromised provider account                                                                                                                       | Authenticator-app 2FA and a unique password on every provider; recovery codes kept offline                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Owner    |
| A malicious or vulnerable dependency                                                                                                                 | Few dependencies, `fetch` instead of SDKs, exact pins on security-critical packages, committed lockfile, `npm audit` report, Dependabot alerts                                                                                                                                                                                                                                                                                                                                                                                                                                    | M2       |
| Mistakes on our side, with one database shared by laptop and live                                                                                    | The app connects as a role that cannot create, alter or drop; one guarded migrate command with a typed confirmation that refuses to run without a backup from the last hour; tests never touch the real database; a fixed release order; nothing is pushed to `main` without the owner's word                                                                                                                                                                                                                                                                                     | M2       |
| Spoofed email and hijacked hostnames                                                                                                                 | SPF, DKIM and DMARC; one web hostname only; every record documented in [DNS.md](DNS.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Owner    |
| Floods and denial of service                                                                                                                         | Absorbed by the host today (see the ledger); rate limits only cover abuse that reaches the app                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | live     |

### Rules that hold everywhere

- **Fail closed.** If a security check cannot run, the request is refused.
- **Nobody is recognised, blocked or trusted by IP address.** Shared addresses are
  normal. IP limits are loose; the tight limits are per address and per pending
  sign-up.
- **Never logged:** passwords, codes, tokens, secrets, full email addresses. A test
  searches captured output for a known password and code after a full sign-up.
- **Standard parts only.** Hashing, random codes, HMAC, constant-time comparison,
  cookies and sessions all come from Better Auth or Node. Custom security code is
  small, isolated and tested against attacks.

### Risks accepted on purpose

- **No captcha or bot-protection service** and **no breached-password lookup**
  (minimal third parties). An offline common-password list is the fallback if
  wanted.
- **Whoever controls a member's mailbox can reset their password.** That is inherent
  in email reset; 2FA is the answer for members who want more.
- **An app code can be phished in real time.** A fake site that relays the password and
  the code within the minute gets in; so does anything that already controls the
  member's browser. Passkeys (designed for later) are the answer to that. Two-factor
  still stops the common attacks: a leaked or guessed password.
- **Two-factor is optional.** A member who never switches it on is protected by the
  password alone. The dashboard invites every such member at each sign-in.
- **Two-factor depends on `BETTER_AUTH_SECRET`.** The app secrets and backup codes are
  encrypted with it: lose it, or replace it outright, and every member with two-factor on
  is locked out until the owner resets them one by one. See "Rotate a secret".
- **Per-address sign-up limits let someone briefly block sign-up for an address they
  know.** A sign-up already in progress is not affected. The alternative, no
  per-address limit, would let them multiply code guesses and flood the mailbox.
- **One database is shared by the owner's laptop and the live site** (owner's
  decision, 2026-09-20, until the self-hosting phase). See "One shared database"
  below for what that costs and what holds it in check.
- **The database can pause.** Supabase pauses a Free project after about a week of
  low activity, and a paused database means nobody can sign in. Accepted for now.
  **The upgrade trigger: before the owner promotes the academy publicly or takes any
  money, whichever comes first.** Until then the daily cron touches the database
  every day, and the auth routes show a friendly "temporarily unavailable" page when
  the database cannot be reached.

### One shared database

The laptop's `.env.local` and the live site point at the same database, so
development happens against production data.

- **Reverting a git push restores code, never data. Only a backup restores data.**
  That is why a backup comes before every migration and why the restore runbook is
  kept tested.
- **The app's role is the main protection.** `zerocorps_app` cannot create, alter or
  drop anything, holds no special attributes, and reaches the app's tables only
  through explicit row-level-security policies. `npm run db:check-role` proves it. A
  bug can still change or delete _rows_ the app is allowed to touch; nothing but a
  backup protects against that.
- **No destructive commands, ever:** no `drizzle-kit push`, no drops, no truncates.
  Migrations are additive and go through `npm run db:migrate` only. The only deletes
  are the documented ones: the daily purge of expired rows, the test-account cleanup
  and the revoke-sessions runbook.
- **Tests never touch it.** They run on PGlite, a Postgres inside the test process,
  and never read `DATABASE_URL`.
- **Test accounts use only the owner's own addresses**, and a cleanup command removes
  them. An address used for a test on the laptop is taken on the live site too until
  it is cleaned up, so it should not be the address of a real account.
- **Recommended control, declined for now: a separate development database.** It
  would take development off production data entirely. Revisit it at the
  self-hosting phase.

### The content-security policy today (the baseline)

Production sends, on every route including the auth pages:

```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; object-src 'none';
base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

- **Why `script-src` allows `'unsafe-inline'`:** Next.js writes inline scripts into
  every page (the data React needs to start, and our theme script that runs before
  first paint). The strict alternative is a per-request nonce, and a nonce forces
  every page to be rendered per request. That would cost the marketing pages their
  static rendering and caching. No third-party script origin is allowed, so the
  policy still blocks the usual injected `<script src="https://evil…">`.
- **What already holds without a nonce, on the auth pages too:**
  `frame-ancestors 'none'` (no clickjacking), `form-action 'self'` (a form cannot be
  made to post a password elsewhere), `base-uri 'self'`, `object-src 'none'`. A test
  in `src/lib/security-headers.test.ts` pins them.
- **The plan:** a nonce-based policy for the dynamic `(auth)` and `(app)` routes at
  the start of milestone 4, with the marketing pages keeping this one. Milestone 2
  adds no inline script or style of its own, so that switch stays mechanical.

### Release gates for milestone 2

Production sign-ups are not opened until: a Resend account and its DNS records are
in place; the Production variables are set in Vercel; the database is migrated; an
encrypted backup has been run once and its restore check has passed; the owner has
approved `/terms` and `/privacy`; **a working contact channel exists** for
`SECURITY_CONTACT` (a published address must not bounce); and the GitHub security
settings are on. The live site runs in `allowlist` mode first.

**The `PRIVACY_CONTACT` gate was moved by the owner on 2026-09-21.** The contact is a
`@zerocorps.org` mailbox and Proton may not be working until about 2026-09-24. A working
privacy contact no longer gates the release. It gates **inviting anyone**: until a test
message sent to that address from another mailbox has arrived, the live
`SIGNUP_ALLOWLIST` holds only the owner's own addresses. While the owner is the only
member, nobody else's data depends on that contact. Friends are added only after the
test message arrives, and the date it arrived is recorded in DECISIONS.md.

**Two more gates were moved by the owner on 2026-09-21, for the same reason** (the owner
is the only person who can sign up): approving `/terms` and `/privacy` now gates
**inviting anyone**, not the release; and the fresh backup with its restore check runs
**right after the owner's real sign-up**. The gate "an encrypted backup has been run once
and its restore check has passed" was already met on 2026-09-20, and the database held no
accounts at the release.

### Open items carried from earlier decisions

- **The hosting plan must permit commercial use** before anything is sold. Vercel
  Hobby is for non-commercial use.
- **Bot protection is reconsidered** if rate limits prove too weak in practice.
- **One open dependency alert, development-only (seen 2026-09-21).** `npm audit` and
  Dependabot report a moderate advisory in an old `esbuild` that `drizzle-kit` pulls in
  (GHSA-67mh-4wv8-2f99). It is about esbuild's own development web server, which nothing
  here ever starts: `drizzle-kit` is used only for `npm run db:generate`, offline, on the
  laptop, and none of it is in what the live site runs. **Do not run
  `npm audit fix --force`:** it would swap `drizzle-kit` for a years-old version. The fix is
  a `drizzle-kit` release that drops the old package; check again at each release. The
  owner has not yet said whether to accept this or to dismiss the alert on GitHub.
- **Closed on 2026-10-04: the Next.js advisories.** On 2026-10-02 `npm audit` reported
  GHSA-vcvr-r3jv-pc5j, remote code execution in `next/og`'s `ImageResponse`, for Next
  16.2.0 to 16.3.5. It never reached this site, which does not import `next/og` (its
  link-preview images are fixed PNG files). On the owner's word, Next went from 16.3.5 to
  **16.3.8** as a release of its own, with `eslint-config-next` alongside. 16.3.6 fixed
  that advisory; 16.3.8 is a security release fixing six more, among them a high
  server-side request forgery in image optimisation and an information disclosure in
  metadata image routes (this site serves `opengraph-image.png`, `twitter-image.png` and
  `icon.png` that way). The full check and the browser check passed before the push.
- **One more development-only alert (seen 2026-10-04).** GHSA-vfj7-8cjw-p6xm: `braces`
  up to 3.0.3, the newest there is, can exhaust the stack on deeply nested patterns. It is
  reached only through the linter (`eslint-config-next` → `@next/eslint-plugin-next` →
  `fast-glob` → `micromatch` → `braces`), which runs on the laptop over this repository's
  own files with its own patterns; none of it is in what the live site runs, and the
  lockfile held the same `braces` before the Next upgrade, so the upgrade did not bring it.
  **Do not take npm's suggested fix:** it would move `eslint-config-next` back to 14. The
  fix is a `braces` release; check again at each release.

## 2. Hosting assumptions ledger

Everything Vercel, Supabase and the other hosts do for us today. The self-hosted
phase must replace each line. **Add a line whenever new code relies on one.**

| We rely on                                | Who provides it today                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | The self-hosted setup must                                                                                                                                        | Since |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| TLS certificates, renewal, HTTPS only     | Vercel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Run a reverse proxy with automatic certificates and redirect http. The app already sends HSTS.                                                                    | M1    |
| Absorbing floods                          | Vercel's edge                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Put a provider or CDN in front, or accept the risk. App rate limits do not help here.                                                                             | M1    |
| A client IP that cannot be forged         | Vercel sets the forwarding header itself                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Make the reverse proxy overwrite, never append to, the header named in the trusted-header variable. Otherwise every IP limit can be dodged.                       | M2    |
| Secret storage                            | Vercel's encrypted variables; `.env.local` on the laptop                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Use host-level secrets with tight file permissions, and rotate everything during the move.                                                                        | M1    |
| Scheduled jobs                            | Vercel cron, once a day, at some point within the hour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Use a system timer calling the same route with the same bearer secret.                                                                                            | M2    |
| Work that runs after the response         | Next's `after()`, which on Vercel relies on the platform keeping the function alive (`waitUntil`). Every email goes out this way.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Nothing extra: a long-running Node server finishes the work by itself. Check it after the move by signing up once.                                                | M2    |
| Database reachable only by us             | **Not true today.** Supabase databases accept connections from the internet, guarded by password + TLS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Bind Postgres to a private network with no public port.                                                                                                           | M2    |
| Connection pooling                        | Supabase's pooler in transaction mode (hence `prepare: false`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Run a pooler or connect directly, and revisit `prepare`.                                                                                                          | M2    |
| The app running next to the database      | `"regions": ["cle1"]` in `vercel.json` runs Vercel's functions in Cleveland, which is the database's own cloud region (AWS `us-east-2`, read from the pooler host on 2026-09-20). A sign-up makes about eight database round trips, so distance is paid eight times. Vercel's default would be `iad1`, Washington.                                                                                                                                                                                                                                                                                                                                                                                             | Keep the app and Postgres on the same machine or private network. If either one moves, move the other with it.                                                    | M2    |
| The lesson files shipping with the site   | Next's output file tracing, told by `outputFileTracingIncludes` in `next.config.ts` to put `content/academy/**/*.md` beside the server code that reads it at run time. Vercel builds and serves that bundle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Any `next build` does the same (`next start`, or `output: "standalone"` with the same trace). Check after a self-hosted build that the Academy lists its lessons. | M7    |
| Linking Discord and giving rank roles     | Discord's OAuth2 (scope `identify`) and its REST API, reached with the site's own application: its client id and secret for linking, its bot token (Manage Roles only) for roles. Secrets live in Vercel and `.env.local` only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Nothing to move: Discord stays Discord. Keep the bot's permissions to Manage Roles, and rotate its token and the client secret if the site is ever compromised.   | M6    |
| The Data API staying off                  | A switch in Supabase's dashboard. Supabase also grants its API roles (`anon`, `authenticated`, `service_role`) rights on new tables by default; with the API off nothing can use them, and row-level security gives the first two no rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Nothing: plain Postgres has no such roles or API. Do not recreate them.                                                                                           | M2    |
| An encrypted, verified database link      | TLS is always on, and since 2026-09-21 it is verified. Supabase's pooler presents a certificate signed by Supabase's own authority, which the public ones cannot vouch for, so that root certificate (from the owner's dashboard, kept in `certs/`) is pinned in `src/lib/db-ca.ts`. The app and every `db:` command check the chain and the host name against that list only and fail closed; `npm run db:check` proves it. **The pin is ours to maintain:** when Supabase changes its authority, or the certificate expires (2031-04-26), connections stop until the list is updated. `db:check` and the tests warn from 90 days before. Runbook: "Database connections fail after Supabase rotates its CA". | Issue our own certificate, pin that one in the same list, and keep the same fail-closed check. The pin moves with us: it names whoever runs Postgres.             | M2    |
| Database backups                          | **Nobody.** The Free plan has none. Our manual encrypted backup is the only copy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Schedule encrypted backups, keep a copy off-site, rehearse restores.                                                                                              | M2    |
| The database staying up                   | Supabase, which pauses idle Free projects. Accepted until the upgrade trigger: before the academy is promoted publicly or any money is taken. Until then the daily cron touches it every day.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Monitor it.                                                                                                                                                       | M2    |
| A database just for development           | **Nobody.** The laptop and the live site share one database (owner's decision).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Give development its own database, so that a mistake on the laptop cannot touch members' data.                                                                    | M2    |
| Logs we can look back through             | Vercel keeps runtime logs only briefly. `auth_events` in our database is the durable record.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Collect logs centrally with a retention rule.                                                                                                                     | M2    |
| Builds come from our code only            | GitHub → Vercel's Git integration, from `main`. `dev` is pushed as a backup and is not built: `git.deploymentEnabled` in `vercel.json`, proven on its first push (2026-09-20), when GitHub recorded no deployment for it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Build in our own pipeline, from a protected branch.                                                                                                               | M1    |
| Email delivery and sender reputation      | Resend, with its own SPF and DKIM records                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Use a relay or another provider behind the same `sendEmail()` wrapper.                                                                                            | M2    |
| `send` and `rsend` answering for us       | Both names are CNAMEs into Resend's zone (`send.forge.rmta.net`, `rsend.forge.rmta.net`), so **Resend publishes the SPF and the bounce `MX` that receiving servers read under our name.** Whoever controls that zone decides which servers may send mail that passes SPF, and through it DMARC, as `zerocorps.org`. Checked 2026-09-20: the SPF there lists an address block that ARIN registers to Resend.                                                                                                                                                                                                                                                                                                    | Publish our own SPF and bounce `MX` for the return-path name, or delete both CNAMEs the same day (runbook "Stop using Resend"). Never leave one dangling.         | M2    |
| Decoding profile pictures                 | sharp's prebuilt libvips binary for Vercel's Linux, installed by the build's `npm ci`. It is patched only when we move the pinned `sharp`; a self-hosted server installs the binary for its own platform the same way.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Install sharp for the server's own platform (`npm ci` on it does), and keep moving the pin when libvips is patched.                                               | M3    |
| Room for profile pictures                 | Supabase's database size (500 MB on the Free plan). A picture is at most 128 KB and usually 10 to 40 KB, so a thousand members take about 30 MB.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Give Postgres the disk; the same rule holds at about 30 MB per thousand members.                                                                                  | M3    |
| Patching of the runtime                   | Vercel maintains Node and the OS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Patch the host, the base image and Node ourselves.                                                                                                                | M1    |
| Request size and time limits              | Vercel's function limits cut off huge or endless requests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Set body-size and timeout limits on the reverse proxy.                                                                                                            | M2    |
| A read-only login role through the pooler | Supavisor accepts `brain_reader.<project-ref>` on the transaction pooler (port 6543) as it does the app's role, checked against the role's SCRAM secret in Postgres. `npm run brain:setup` proves it, and waits a minute for the pooler if a new password is not accepted at once.                                                                                                                                                                                                                                                                                                                                                                                                                             | Let the brain's role connect directly, or through our own pooler, over TLS pinned like the app's connection; keep it read-only and limited to the `brain` schema. | M9    |
| Correct clocks                            | Both hosts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Run time sync. Code expiry and TOTP depend on it.                                                                                                                 | M2    |

## 3. Runbooks

Each runbook is written out in full when the thing it covers exists. The outline is
fixed now so nothing is forgotten.

### Rotate a secret

General rule: change it at the provider, update Vercel's Production variable and
`.env.local`, redeploy (Vercel only reads variables at deploy time), then confirm
the old value no longer works.

| Secret                                                       | Rotating it means                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                                         | Every session cookie and sign-up-in-progress cookie stops validating: everyone is signed out, and anyone mid-sign-up starts again. **Since milestone 5 it also decrypts every two-factor secret and backup code, so it must NOT simply be replaced:** that locks out every member with two-factor on. First make `createAuth` pass Better Auth a `secrets` list, newest first (`[{ version: 2, value: new }, { version: 1, value: old }]`), and keep the old value as `secret`: Better Auth 1.7.5 then encrypts with the new one and still reads what the old one encrypted. Test it on PGlite before touching production. |
| The HMAC secret                                              | Codes in flight fail (15-minute window), rate-limit counters restart, and old `auth_events` hashes can no longer be matched to new ones.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| The app role's password (`zerocorps_app`, in `DATABASE_URL`) | Set by hand with `ALTER ROLE`, never in a migration. The site is down between the change and the redeploy. The laptop's `.env.local` needs it too.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| The owner role's password (in `DATABASE_URL_MIGRATIONS`)     | Reset in Supabase. Only the laptop uses it, for migrations and backups, so the site is not affected. Letters and numbers only keep the URL valid.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `RESEND_API_KEY`                                             | No email is sent between revoking the old key and the redeploy: sign-ups and resets stall.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `CRON_SECRET`                                                | The daily cleanup is refused until the redeploy. Harmless for a day.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| The brain role's password                                    | `npm run brain:setup` again: a new random password, never shown, and a new `BRAIN_DATABASE_URL` in `.env.local`; the old password stops working at once. Only the brain export uses it. Never in a migration.                                                                                                                                                                                                                                                                                                                                                                                                              |
| Later: Discord, storage keys, `INTERNAL_API_SECRET`          | Written when each arrives. The internal secret must be changed in Agent Zero at the same moment.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### Change the database schema (every migration, no exceptions)

1. `npm run db:backup`. It asks for the backup passphrase twice, reads the whole
   database in one read-only snapshot, encrypts it and checks that the file decrypts
   again.
2. `npm run db:restore:check`. It restores that backup into a throwaway Postgres
   inside the command and prints the row counts. The real database is not touched.
3. `npm run db:migrate`. It shows the target host and the pending migrations, refuses
   unless a backup of this database from the last hour exists, and asks for a typed
   confirmation.

All three need a person at a terminal. `drizzle-kit push` is never used, and
`drizzle.config.ts` deliberately holds no database address, so it could not connect
if someone tried.

### Give the app role its password (once, by hand)

The first migration creates `zerocorps_app` without a password and unable to log in,
so that no secret is ever committed. To switch it on:

1. In the Supabase dashboard open the SQL editor, start a new query and paste this
   one statement:

   ```sql
   ALTER ROLE zerocorps_app WITH LOGIN PASSWORD 'REPLACE_THIS_WITH_LETTERS_AND_NUMBERS_ONLY';
   ```

2. Replace the placeholder, between the quotes, with a new password from your
   password manager: **32 or more letters and numbers, nothing else.** Characters such
   as `/ ? # @ : % $` break the connection URL. Run it. "Success. No rows returned" is
   the right answer.
3. **Delete that query from the SQL editor** (it contains the password), and check
   that it is not left among the saved or private snippets. The statement can also
   sit in the project's Postgres logs for a short while. Only your Supabase account
   can read those, which is one more reason that account has 2FA.
4. **Do not edit the connection string by hand.** Close `.env.local` in your editor
   and run `npm run env:app-url -- --ask`. It asks for the role's password (hidden)
   and writes `DATABASE_URL` for you: the host and project ref are copied from
   `DATABASE_URL_MIGRATIONS`, which `npm run db:check` has already proven, the role is
   `zerocorps_app` and the port is `6543`. It shows nothing, and it does not touch
   `DATABASE_URL_MIGRATIONS`, which keeps the owner role. (Hand-editing went wrong the
   first time: an example host from the instructions ended up in the real file.)
5. `npm run db:check` should now say `connected as role "zerocorps_app"`.
6. `npm run db:check-role` must pass every line. It proves the role cannot create,
   alter or drop, holds no special attribute, and sees only the app's tables.
7. At release, Vercel's `DATABASE_URL` gets the same role and password. Vercel never
   gets `DATABASE_URL_MIGRATIONS`.

`brain_reader` (milestone 9) does not: `npm run brain:setup` gives it its password from
the laptop, without the SQL editor and without the password ever reaching the database
(next runbook).

### Set up the brain (milestone 9, once)

The brain is the owner's Obsidian vault of every member, rebuilt from the database by
`npm run brain:export`. It reads as `brain_reader`, which can read the three views in the
`brain` schema and nothing else.

1. The migration `0008_brain_export` must be applied first: `npm run db:backup`, then
   `npm run db:migrate`. It creates the views and the role, without a password and unable
   to log in.
2. `npm run brain:setup`, in a terminal. It asks for the vault folder (Enter takes
   `C:\Users\<you>\ZeroCorps Brain`; never inside the repository or OneDrive), then for
   the typed confirmation `set up the brain`. It gives `brain_reader` a random password,
   sent as a SCRAM secret so the password itself never reaches the database, writes
   `BRAIN_DATABASE_URL` and `BRAIN_VAULT_PATH` into `.env.local`, and proves the new
   connection: `brain_reader`, the views, no table of the app. Nothing is shown.
3. `npm run brain:export`. Then in Obsidian: "Open folder as vault", that folder, and the
   note "ZeroCorps Brain". Run the export again whenever a fresh view is wanted.

`BRAIN_DATABASE_URL` and `BRAIN_VAULT_PATH` are the laptop's only: they never go into
Vercel, and the site refuses to start if `BRAIN_DATABASE_URL` is set there. To switch the
brain off: `ALTER ROLE brain_reader NOLOGIN;` in the SQL editor.

### Close signups

Set `SIGNUP_MODE=closed` in Vercel's Production variables and redeploy. The sign-up
endpoints refuse on the server, sign-ups in progress cannot finish, and sign-in
keeps working. `allowlist` is the halfway setting: only the addresses in
`SIGNUP_ALLOWLIST` can sign up.

### Revoke every session

Sessions are rows in the database, so deleting them signs people out immediately:
all rows for everyone, or the rows for one user. A confirmed command for this is
part of milestone 2. Rotating `BETTER_AUTH_SECRET` has the same effect for everyone
and is the step to take if the secret itself may have leaked, but only the way "Rotate
a secret" describes: replaced outright, it also locks out every member with two-factor.

### Turn two-factor off for a member

For a member who has lost both their authenticator app and every backup code. Anyone who
talks you into this gets past that member's second factor, so it is a security decision,
not a favour.

1. **Make sure it is really them, through something the attacker would not have.** The
   best check: a message from the Discord account that is linked to their ZeroCorps account
   (the command shows which one). An email alone proves little: whoever took over the
   account may control the mailbox too. If you cannot be sure, say no; they can create a
   new account.
2. On the laptop, in a terminal: `npm run 2fa:reset -- <their username>`. It shows the
   account (username, masked email, member since, linked Discord, two-factor on or off)
   and asks you to type `reset <username>`.
3. In one transaction it removes the app's secret and the backup codes, forgets every
   trusted browser and signs every device out. The member's security activity shows
   "Two-factor turned off by ZeroCorps, at your request", and they are emailed (sent
   through Resend from the laptop, so `RESEND_API_KEY` must be filled in `.env.local`;
   otherwise the command says so, and you tell them yourself).
4. Tell them to sign in with their password and switch two-factor on again straight away.

### Restore from backup

**Reverting a git push restores code, never data. Only a backup restores data.**

- **The drill, which touches nothing real:** `npm run db:restore:check` decrypts the
  newest backup with its passphrase and loads it into a Postgres running inside the
  command, built from the migrations in this repository. It reports the row count of
  every table. Run it after every backup that matters; a backup that has never been
  restored is a hope, not a backup.
- **A real restore** never overwrites: the restore command refuses any table that
  already has rows. After a disaster the target is a new, empty database (a new
  Supabase project, or the self-hosted server): run the migrations, restore into it,
  set the app role's password, and point `DATABASE_URL` at it.
- The passphrase lives in the owner's password manager. Without it a backup cannot
  be read by anyone, the owner included.
- **Two-factor needs one more secret.** The app secrets and backup codes inside a backup
  are still encrypted with the live site's `BETTER_AUTH_SECRET`. Restored under a
  different one, every member with two-factor is locked out, so keep that secret in the
  password manager beside the backup passphrase.

### The laptop is lost or compromised

From another device: change the passwords of the provider accounts and end their
other sessions; rotate every secret that was in `.env.local`, the database password
first; stop the brain role (`ALTER ROLE brain_reader NOLOGIN;` in the SQL editor, or
`npm run brain:setup` from a new laptop); revoke every session. Treat the backups and
the brain vault on that disk as exposed unless the disk was encrypted.

### A secret was committed or pasted somewhere

Rotate it first. Removing it from history comes second and does not make the old
value safe again.

### Database connections fail after Supabase rotates its CA

The database connection trusts only the certificates pinned in `src/lib/db-ca.ts` and
fails closed. So when Supabase moves to a new certificate authority, or a pinned
certificate expires, nothing is leaked, but nothing connects either.

**The symptom:** the auth pages say "temporarily unavailable", sign-in and sign-up stop,
and `npm run db:check` reports FAIL with "the server's certificate was NOT verified
against the pinned certificates". A wrong password or an unreachable host reads
differently, so that sentence is the tell.

**The warning comes first.** `npm run db:check` and `npm run check` print a loud warning
from 90 days before a pinned certificate expires, and fail once one has expired. Supabase
also announces a change of authority ahead of time. Act on either one and there is no
outage: the list holds several certificates on purpose.

**The fix, staged so that nothing breaks:**

1. Download the new certificate from the Supabase dashboard: Database settings, "SSL
   Configuration", "Download certificate". Only from the dashboard, signed in, never
   from a link in an email or a chat.
2. Put the file in `certs/` beside the old one and add its text to the list in
   `src/lib/db-ca.ts`, **next to the old certificate, not in place of it**. Add its name
   and fingerprint to `src/lib/db-ca.test.ts`.
3. `npm run check`, then `npm run db:check`. Both URLs must say "VERIFIED against the
   pinned certificates".
4. Release it the normal way. While both certificates are in the list, the old and the
   new server certificate are both accepted, so the order of events does not matter.
5. Remove the old certificate in a later release, once `db:check` has passed for a
   while without it being needed. Never before.

**If it has already broken,** the fix is the same five steps, done at once. There is no
switch that turns verification off, on purpose: an attacker in the middle of the
connection would look exactly like this. If a release itself caused the break, Vercel's
previous deployment is the rollback while the list is corrected.

**After the move to self-hosting** the pin stays and names our own certificate authority
instead. Pinning is not something Vercel or Supabase does for us; it is ours on any host.

### Stop using Resend (or move to another email provider)

**Delete both CNAMEs, `send` and `rsend`, on the same day, so they never dangle.** A
CNAME left pointing at a provider we no longer use hands those names to whoever holds
the target next, and with them the right to send mail that passes our SPF and DMARC.
Then delete the `resend._domainkey` `TXT` (the key that signs as us), revoke the API
key in Resend, remove `RESEND_API_KEY` from Vercel and close the Resend account. The
single `_dmarc` record stays. Every deletion gets a before-and-after note in
[DNS.md](DNS.md), and each name is looked up afterwards to prove it is gone. The new
provider's records go in behind the same `sendEmail()` wrapper.

### Provider accounts (owner's checklist)

Authenticator-app 2FA and a unique password on GitHub, Vercel, Supabase, Namecheap,
Resend, Proton, and later Twilio and Discord. Recovery codes stored offline. On
GitHub: Dependabot alerts, secret scanning and push protection switched on for this
repository.
