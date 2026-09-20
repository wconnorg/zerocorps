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

| Threat                                                               | Control                                                                                                                                                                                                  | Status   |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Credential stuffing and password guessing                            | Sign-in limits per address + IP with a per-address ceiling; 12-character minimum; slow password hash (scrypt); one error message for every failure; new-device email; the event log                      | M2       |
|                                                                      | Second factor: TOTP (recommended) or SMS, backup codes, lockout after repeated bad codes                                                                                                                 | M5       |
| Taking over an account at sign-up (registering someone else's email) | Nothing is written to `users` until an emailed code is entered in the browser that started the sign-up; the code is never accepted by email alone; pending sign-ups are independent; CSRF check on start | M2       |
| Finding out who has an account                                       | Same response and same screen for a registered address; "you already have an account" goes to the mailbox instead; same work done on both paths; reset answers identically for unknown emails            | M2       |
| Email bombing and sign-up abuse                                      | Per-address limits, 10 emails a day per address across all types, 3 sends per pending row, `SIGNUPS_OPEN` kill switch                                                                                    | M2       |
| SMS pumping                                                          | No SMS to an unverified account (hard rule 7); limits per user, phone and IP; a verification API, not raw SMS                                                                                            | M5       |
| Stolen session                                                       | `httpOnly`, `secure`, `sameSite=lax`, host-only cookies; CSP; HSTS; reset signs out every session                                                                                                        | M2       |
|                                                                      | Users see and revoke their own sessions; sensitive actions need the password again                                                                                                                       | M4       |
| Cross-site request forgery                                           | Better Auth's origin and CSRF checks on every auth endpoint, including first-visit requests; `form-action 'self'`; `sameSite=lax`                                                                        | M2       |
| Cross-site scripting                                                 | React's escaping, no third-party scripts, CSP (`object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`)                                                                                         | live     |
| Harassment and doxxing of members                                    | Minimal data; no public profiles; the internal API never returns emails or phones; the brain export is restricted to an allowlist inside the database                                                    | M2 to M9 |
| A leaked secret                                                      | Secrets only in `.env.local` and the host's settings; GitHub secret scanning and push protection; rotation runbook below                                                                                 | M2       |
| A stolen or compromised laptop                                       | Full-disk encryption; encrypted backups; the brain role can read one view and nothing else; rotation runbook                                                                                             | Owner    |
| A compromised provider account                                       | Authenticator-app 2FA and a unique password on every provider; recovery codes kept offline                                                                                                               | Owner    |
| A malicious or vulnerable dependency                                 | Few dependencies, `fetch` instead of SDKs, exact pins on security-critical packages, committed lockfile, `npm audit` report, Dependabot alerts                                                           | M2       |
| Mistakes on our side                                                 | Separate dev and prod databases; the prod migration needs a typed confirmation; a fixed release order; nothing is pushed without the owner's word                                                        | M2       |
| Spoofed email and hijacked hostnames                                 | SPF, DKIM and DMARC; one web hostname only; every record documented in [DNS.md](DNS.md)                                                                                                                  | Owner    |
| Floods and denial of service                                         | Absorbed by the host today (see the ledger); rate limits only cover abuse that reaches the app                                                                                                           | live     |

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

### Open items carried from earlier decisions

- **The production database must not be able to pause.** Supabase pauses a Free
  project after about a week of low activity, and a paused database means nobody can
  sign in. A daily cron query alone may not count as enough activity. Decide before
  real members depend on the site: a paid plan, or self-hosting.
- **The hosting plan must permit commercial use** before anything is sold. Vercel
  Hobby is for non-commercial use.
- **Bot protection is reconsidered** if rate limits prove too weak in practice.

## 2. Hosting assumptions ledger

Everything Vercel, Supabase and the other hosts do for us today. The self-hosted
phase must replace each line. **Add a line whenever new code relies on one.**

| We rely on                            | Who provides it today                                                                                  | The self-hosted setup must                                                                                                                  | Since |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| TLS certificates, renewal, HTTPS only | Vercel                                                                                                 | Run a reverse proxy with automatic certificates and redirect http. The app already sends HSTS.                                              | M1    |
| Absorbing floods                      | Vercel's edge                                                                                          | Put a provider or CDN in front, or accept the risk. App rate limits do not help here.                                                       | M1    |
| A client IP that cannot be forged     | Vercel sets the forwarding header itself                                                               | Make the reverse proxy overwrite, never append to, the header named in the trusted-header variable. Otherwise every IP limit can be dodged. | M2    |
| Secret storage                        | Vercel's encrypted variables; `.env.local` on the laptop                                               | Use host-level secrets with tight file permissions, and rotate everything during the move.                                                  | M1    |
| Scheduled jobs                        | Vercel cron, once a day, at some point within the hour                                                 | Use a system timer calling the same route with the same bearer secret.                                                                      | M2    |
| Database reachable only by us         | **Not true today.** Supabase databases accept connections from the internet, guarded by password + TLS | Bind Postgres to a private network with no public port.                                                                                     | M2    |
| Connection pooling                    | Supabase's pooler in transaction mode (hence `prepare: false`)                                         | Run a pooler or connect directly, and revisit `prepare`.                                                                                    | M2    |
| Database backups                      | **Nobody.** The Free plan has none. Our manual encrypted backup is the only copy.                      | Schedule encrypted backups, keep a copy off-site, rehearse restores.                                                                        | M2    |
| The database staying up               | Supabase, which pauses idle Free projects                                                              | Monitor it.                                                                                                                                 | M2    |
| Logs we can look back through         | Vercel keeps runtime logs only briefly. `auth_events` in our database is the durable record.           | Collect logs centrally with a retention rule.                                                                                               | M2    |
| Builds come from our code only        | GitHub → Vercel's Git integration, from `main`                                                         | Build in our own pipeline, from a protected branch.                                                                                         | M1    |
| Email delivery and sender reputation  | Resend, with its own SPF and DKIM records                                                              | Use a relay or another provider behind the same `sendEmail()` wrapper.                                                                      | M2    |
| Patching of the runtime               | Vercel maintains Node and the OS                                                                       | Patch the host, the base image and Node ourselves.                                                                                          | M1    |
| Request size and time limits          | Vercel's function limits cut off huge or endless requests                                              | Set body-size and timeout limits on the reverse proxy.                                                                                      | M2    |
| Correct clocks                        | Both hosts                                                                                             | Run time sync. Code expiry and TOTP depend on it.                                                                                           | M2    |

## 3. Runbooks

Each runbook is written out in full when the thing it covers exists. The outline is
fixed now so nothing is forgotten.

### Rotate a secret

General rule: change it at the provider, update Vercel's Production variable and
`.env.local`, redeploy (Vercel only reads variables at deploy time), then confirm
the old value no longer works.

| Secret                                                      | Rotating it means                                                                                                                                   |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                                        | Every session cookie and sign-up-in-progress cookie stops validating: everyone is signed out, and anyone mid-sign-up starts again. Nothing is lost. |
| The HMAC secret                                             | Codes in flight fail (15-minute window), rate-limit counters restart, and old `auth_events` hashes can no longer be matched to new ones.            |
| Database password                                           | The site is down between the change at Supabase and the redeploy. Update `DATABASE_URL`, the migrations URL and the backup command together.        |
| `RESEND_API_KEY`                                            | No email is sent between revoking the old key and the redeploy: sign-ups and resets stall.                                                          |
| `CRON_SECRET`                                               | The daily cleanup is refused until the redeploy. Harmless for a day.                                                                                |
| The brain role's password                                   | Only the owner's export command stops. Set by hand in the database, never in a migration.                                                           |
| Later: Twilio, Discord, storage keys, `INTERNAL_API_SECRET` | Written when each arrives. The internal secret must be changed in Agent Zero at the same moment.                                                    |

### Close signups

Set `SIGNUPS_OPEN=false` in Vercel's Production variables and redeploy. The sign-up
endpoints refuse on the server, sign-ups in progress cannot finish, and sign-in
keeps working.

### Revoke every session

Sessions are rows in the database, so deleting them signs people out immediately:
all rows for everyone, or the rows for one user. A confirmed command for this is
part of milestone 2. Rotating `BETTER_AUTH_SECRET` has the same effect for everyone
and is the step to take if the secret itself may have leaked.

### Restore from backup

Decrypt the backup with its passphrase, restore into `zerocorps-dev` first, check
it, and only then restore production. Written out in full, and tested, when the
backup command is built.

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
