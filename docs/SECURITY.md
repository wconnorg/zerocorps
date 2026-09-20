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

- **Credentials:** password hashes, and later TOTP secrets and backup codes.
- **Personal data:** email addresses now; usernames, avatars, phone numbers and
  Discord IDs later. We hold as little as possible.
- **Sessions**, and the secrets that sign them.
- **Integrity of progress and rank.** Rank unlocks Discord channels, so forging it
  is worth something.
- **The owner's provider accounts:** GitHub, Vercel, Supabase, Namecheap, Resend,
  Proton, and later Twilio and the Discord developer account. Any one of them is a
  way into the whole site.
- **The owner's laptop:** `.env.local`, database backups and, from milestone 9, the
  brain vault.

### Who attacks it, and what answers them

| Threat                                                               | Control                                                                                                                                                                                                                                                                             | Status   |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Credential stuffing and password guessing                            | Sign-in limits per address + IP with a per-address ceiling; 12-character minimum; slow password hash (scrypt); one error message for every failure; new-device email; the event log                                                                                                 | M2       |
|                                                                      | Second factor: TOTP (recommended) or SMS, backup codes, lockout after repeated bad codes                                                                                                                                                                                            | M5       |
| Taking over an account at sign-up (registering someone else's email) | Nothing is written to `users` until an emailed code is entered in the browser that started the sign-up; the code is never accepted by email alone; pending sign-ups are independent; CSRF check on start                                                                            | M2       |
| Finding out who has an account                                       | Same response and same screen for a registered address; "you already have an account" goes to the mailbox instead; same work done on both paths; reset answers identically for unknown emails                                                                                       | M2       |
| Email bombing and sign-up abuse                                      | Per-address limits, 10 emails a day per address across all types, 3 sends per pending row, `SIGNUP_MODE` (`closed`, `allowlist`, `open`) as the kill switch                                                                                                                         | M2       |
| SMS pumping                                                          | No SMS to an unverified account (hard rule 7); limits per user, phone and IP; a verification API, not raw SMS                                                                                                                                                                       | M5       |
| Stolen session                                                       | `httpOnly`, `secure`, `sameSite=lax`, host-only cookies; CSP; HSTS; reset signs out every session                                                                                                                                                                                   | M2       |
|                                                                      | Users see and revoke their own sessions; sensitive actions need the password again                                                                                                                                                                                                  | M4       |
| Cross-site request forgery                                           | Better Auth's origin and CSRF checks on every auth endpoint, including first-visit requests; `form-action 'self'`; `sameSite=lax`                                                                                                                                                   | M2       |
| Cross-site scripting                                                 | React's escaping, no third-party scripts, CSP (`object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`)                                                                                                                                                                    | live     |
| Harassment and doxxing of members                                    | Minimal data; no public profiles; the internal API never returns emails or phones; the brain export is restricted to an allowlist inside the database                                                                                                                               | M2 to M9 |
| A leaked secret                                                      | Secrets only in `.env.local` and the host's settings; GitHub secret scanning and push protection; rotation runbook below                                                                                                                                                            | M2       |
| A stolen or compromised laptop                                       | Full-disk encryption; encrypted backups; the brain role can read one view and nothing else; rotation runbook                                                                                                                                                                        | Owner    |
| A compromised provider account                                       | Authenticator-app 2FA and a unique password on every provider; recovery codes kept offline                                                                                                                                                                                          | Owner    |
| A malicious or vulnerable dependency                                 | Few dependencies, `fetch` instead of SDKs, exact pins on security-critical packages, committed lockfile, `npm audit` report, Dependabot alerts                                                                                                                                      | M2       |
| Mistakes on our side, with one database shared by laptop and live    | The app connects as a role that cannot create, alter or drop; one guarded migrate command with a typed confirmation that refuses to run without a backup from the last hour; tests never touch the real database; a fixed release order; nothing is pushed without the owner's word | M2       |
| Spoofed email and hijacked hostnames                                 | SPF, DKIM and DMARC; one web hostname only; every record documented in [DNS.md](DNS.md)                                                                                                                                                                                             | Owner    |
| Floods and denial of service                                         | Absorbed by the host today (see the ledger); rate limits only cover abuse that reaches the app                                                                                                                                                                                      | live     |

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
- **SMS is the weaker second factor** (SIM swapping). TOTP is the recommended one.
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
`SECURITY_CONTACT` and `PRIVACY_CONTACT` (a published address must not bounce); and
the GitHub security settings are on. The live site runs in `allowlist` mode first.

### Open items carried from earlier decisions

- **The hosting plan must permit commercial use** before anything is sold. Vercel
  Hobby is for non-commercial use.
- **Bot protection is reconsidered** if rate limits prove too weak in practice.

## 2. Hosting assumptions ledger

Everything Vercel, Supabase and the other hosts do for us today. The self-hosted
phase must replace each line. **Add a line whenever new code relies on one.**

| We rely on                            | Who provides it today                                                                                                                                                                                                                                                                                                                          | The self-hosted setup must                                                                                                                  | Since |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| TLS certificates, renewal, HTTPS only | Vercel                                                                                                                                                                                                                                                                                                                                         | Run a reverse proxy with automatic certificates and redirect http. The app already sends HSTS.                                              | M1    |
| Absorbing floods                      | Vercel's edge                                                                                                                                                                                                                                                                                                                                  | Put a provider or CDN in front, or accept the risk. App rate limits do not help here.                                                       | M1    |
| A client IP that cannot be forged     | Vercel sets the forwarding header itself                                                                                                                                                                                                                                                                                                       | Make the reverse proxy overwrite, never append to, the header named in the trusted-header variable. Otherwise every IP limit can be dodged. | M2    |
| Secret storage                        | Vercel's encrypted variables; `.env.local` on the laptop                                                                                                                                                                                                                                                                                       | Use host-level secrets with tight file permissions, and rotate everything during the move.                                                  | M1    |
| Scheduled jobs                        | Vercel cron, once a day, at some point within the hour                                                                                                                                                                                                                                                                                         | Use a system timer calling the same route with the same bearer secret.                                                                      | M2    |
| Database reachable only by us         | **Not true today.** Supabase databases accept connections from the internet, guarded by password + TLS                                                                                                                                                                                                                                         | Bind Postgres to a private network with no public port.                                                                                     | M2    |
| Connection pooling                    | Supabase's pooler in transaction mode (hence `prepare: false`)                                                                                                                                                                                                                                                                                 | Run a pooler or connect directly, and revisit `prepare`.                                                                                    | M2    |
| The Data API staying off              | A switch in Supabase's dashboard. Supabase also grants its API roles (`anon`, `authenticated`, `service_role`) rights on new tables by default; with the API off nothing can use them, and row-level security gives the first two no rows.                                                                                                     | Nothing: plain Postgres has no such roles or API. Do not recreate them.                                                                     | M2    |
| An encrypted, verified database link  | TLS is always on. `npm run db:check` showed on 2026-09-20 that Supabase's pooler presents a certificate signed by Supabase's own authority, which the public ones cannot vouch for. So today the link is encrypted but the server is not proven to be Supabase. Open item: pin Supabase's published CA certificate before members' data flows. | Issue our own certificate and verify it (`verify-full`).                                                                                    | M2    |
| Database backups                      | **Nobody.** The Free plan has none. Our manual encrypted backup is the only copy.                                                                                                                                                                                                                                                              | Schedule encrypted backups, keep a copy off-site, rehearse restores.                                                                        | M2    |
| The database staying up               | Supabase, which pauses idle Free projects. Accepted until the upgrade trigger: before the academy is promoted publicly or any money is taken. Until then the daily cron touches it every day.                                                                                                                                                  | Monitor it.                                                                                                                                 | M2    |
| A database just for development       | **Nobody.** The laptop and the live site share one database (owner's decision).                                                                                                                                                                                                                                                                | Give development its own database, so that a mistake on the laptop cannot touch members' data.                                              | M2    |
| Logs we can look back through         | Vercel keeps runtime logs only briefly. `auth_events` in our database is the durable record.                                                                                                                                                                                                                                                   | Collect logs centrally with a retention rule.                                                                                               | M2    |
| Builds come from our code only        | GitHub → Vercel's Git integration, from `main`                                                                                                                                                                                                                                                                                                 | Build in our own pipeline, from a protected branch.                                                                                         | M1    |
| Email delivery and sender reputation  | Resend, with its own SPF and DKIM records                                                                                                                                                                                                                                                                                                      | Use a relay or another provider behind the same `sendEmail()` wrapper.                                                                      | M2    |
| Patching of the runtime               | Vercel maintains Node and the OS                                                                                                                                                                                                                                                                                                               | Patch the host, the base image and Node ourselves.                                                                                          | M1    |
| Request size and time limits          | Vercel's function limits cut off huge or endless requests                                                                                                                                                                                                                                                                                      | Set body-size and timeout limits on the reverse proxy.                                                                                      | M2    |
| Correct clocks                        | Both hosts                                                                                                                                                                                                                                                                                                                                     | Run time sync. Code expiry and TOTP depend on it.                                                                                           | M2    |

## 3. Runbooks

Each runbook is written out in full when the thing it covers exists. The outline is
fixed now so nothing is forgotten.

### Rotate a secret

General rule: change it at the provider, update Vercel's Production variable and
`.env.local`, redeploy (Vercel only reads variables at deploy time), then confirm
the old value no longer works.

| Secret                                                       | Rotating it means                                                                                                                                   |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                                         | Every session cookie and sign-up-in-progress cookie stops validating: everyone is signed out, and anyone mid-sign-up starts again. Nothing is lost. |
| The HMAC secret                                              | Codes in flight fail (15-minute window), rate-limit counters restart, and old `auth_events` hashes can no longer be matched to new ones.            |
| The app role's password (`zerocorps_app`, in `DATABASE_URL`) | Set by hand with `ALTER ROLE`, never in a migration. The site is down between the change and the redeploy. The laptop's `.env.local` needs it too.  |
| The owner role's password (in `DATABASE_URL_MIGRATIONS`)     | Reset in Supabase. Only the laptop uses it, for migrations and backups, so the site is not affected. Letters and numbers only keep the URL valid.   |
| `RESEND_API_KEY`                                             | No email is sent between revoking the old key and the redeploy: sign-ups and resets stall.                                                          |
| `CRON_SECRET`                                                | The daily cleanup is refused until the redeploy. Harmless for a day.                                                                                |
| The brain role's password                                    | Only the owner's export command stops. Set by hand in the database, never in a migration.                                                           |
| Later: Twilio, Discord, storage keys, `INTERNAL_API_SECRET`  | Written when each arrives. The internal secret must be changed in Agent Zero at the same moment.                                                    |

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
4. In `.env.local`, change `DATABASE_URL` in exactly two places and nowhere else:
   - the username, from `postgres.<project-ref>` to `zerocorps_app.<project-ref>`
     (the part after the dot stays as it is);
   - the password, to the one you just set.
     The host, the port `6543` and `/postgres` do not change.
     `DATABASE_URL_MIGRATIONS` does not change at all: it keeps the owner role.
5. `npm run db:check` should now say `connected as role "zerocorps_app"`.
6. `npm run db:check-role` must pass every line. It proves the role cannot create,
   alter or drop, holds no special attribute, and sees only the app's tables.
7. At release, Vercel's `DATABASE_URL` gets the same role and password. Vercel never
   gets `DATABASE_URL_MIGRATIONS`.

`brain_reader` in milestone 9 follows the same procedure.

### Close signups

Set `SIGNUP_MODE=closed` in Vercel's Production variables and redeploy. The sign-up
endpoints refuse on the server, sign-ups in progress cannot finish, and sign-in
keeps working. `allowlist` is the halfway setting: only the addresses in
`SIGNUP_ALLOWLIST` can sign up.

### Revoke every session

Sessions are rows in the database, so deleting them signs people out immediately:
all rows for everyone, or the rows for one user. A confirmed command for this is
part of milestone 2. Rotating `BETTER_AUTH_SECRET` has the same effect for everyone
and is the step to take if the secret itself may have leaked.

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

### The laptop is lost or compromised

From another device: change the passwords of the provider accounts and end their
other sessions; rotate every secret that was in `.env.local`, the database password
first; change the brain role's password; revoke every session. Treat the backups and
the brain vault on that disk as exposed unless the disk was encrypted.

### A secret was committed or pasted somewhere

Rotate it first. Removing it from history comes second and does not make the old
value safe again.

### Provider accounts (owner's checklist)

Authenticator-app 2FA and a unique password on GitHub, Vercel, Supabase, Namecheap,
Resend, Proton, and later Twilio and Discord. Recovery codes stored offline. On
GitHub: Dependabot alerts, secret scanning and push protection switched on for this
repository.
