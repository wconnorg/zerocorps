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
  deploy to zerocorps.org.** Pushes to any other branch create preview deploys.
  The owner does the pushing.
- **Canonical origin is `https://zerocorps.org`** (the apex). `www` redirects to
  it. `NEXT_PUBLIC_APP_URL` must be set to that value in Vercel for both the
  Production and Preview environments. If it is missing the build stops, by
  design (see `src/env.ts`).
- **DNS stays at Namecheap. Do not move the nameservers.** The same zone carries
  the owner's Proton Mail setup: two MX records, the SPF and
  `protonmail-verification` TXT records, three `protonmail*._domainkey` CNAMEs
  and a DMARC policy of `p=quarantine`. Only the apex `A` records and the `www`
  CNAME belong to the website.
- **Email sending in milestone 2 must respect that DMARC policy.** Resend's DKIM
  and return-path records are added next to Proton's, never in place of them, and
  mail from `@zerocorps.org` must pass DKIM alignment or it will be quarantined.
- **Commits use the owner's GitHub noreply address**, because the repository is
  public. It is set in this repository's local git config.
- Before this, zerocorps.org served a GitHub Pages site ("ZeroCorps LLC") from
  `zero-corps.github.io`.

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
