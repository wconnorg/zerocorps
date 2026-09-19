<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ZeroCorps: project rules

zerocorps.org is the website for ZeroCorps, a trading education brand. A separate
repo holds "Agent Zero", a private Discord bot that talks to this site.

Read these before doing anything:

- [docs/BRIEF.md](docs/BRIEF.md) is the owner's brief and the contract for the build.
- [docs/DECISIONS.md](docs/DECISIONS.md) records what the owner approved afterwards.
  Where the two differ, DECISIONS.md wins.

## Working agreement

- Build **one milestone at a time**. Reply with a plan and questions before
  writing code for a milestone, then **stop for the owner's testing** when it is
  done. Do not start the next milestone in the same pass.
- Make **one local commit at the end of each milestone. Never push.** The owner
  pushes after testing.
- Items under "Design for later, do NOT build now" in the brief get schema room
  or a placeholder only.
- Update the status table below when a milestone is finished.

| #   | Milestone                                                | Status               |
| --- | -------------------------------------------------------- | -------------------- |
| 1   | Skeleton, theme system, home ad page, `/academy` landing | Done, live on Vercel |
| 2   | Auth                                                     | Not started          |
| 3   | Onboarding                                               | Not started          |
| 4   | Dashboard and settings                                   | Not started          |
| 5   | Phone and 2FA                                            | Not started          |
| 6   | Discord link and unlink                                  | Not started          |
| 7   | Academy: MDX lessons, progress, rank, heatmap            | Not started          |
| 8   | `syncDiscordRoles` and the internal API for Agent Zero   | Not started          |

Deployment, DNS and the launch checklist are described in DECISIONS.md. A push to
`main` deploys to production, so never push without being asked.

## Hard rules (from the brief; never trade these away)

1. Accounts are created only with email and password. No social login, no
   magic-link-only accounts. Email must be verified before access.
2. Discord is never a login method. It is an optional link on an existing account.
3. A phone number is never a login or signup identifier. It is an optional
   verified attribute used only as a second factor.
4. Postgres is the single source of truth for users, progress and ranks.
5. Store only `discord_id`, `discord_username` and `linked_at` from Discord.
   OAuth scope is `identify` only, and tokens are never stored.
6. Users are referenced internally by ID, never by username.
7. No SMS is ever sent for an account whose email is not verified.

## Constraints

- **Portable.** Postgres is plain Postgres through `DATABASE_URL`. Never use the
  Supabase SDK or Supabase Auth. Nothing Vercel-specific in the code (no
  `VERCEL_*` variables, no Vercel-only packages). Email, SMS and file storage
  each sit behind a small wrapper so the provider can be swapped.
- **Better Auth.** Check the docs, and the plugin source for the installed
  version, before configuring anything. Do not use its phone-number or username
  plugins: they register sign-in endpoints that break hard rules 1 and 3. The
  findings so far are in DECISIONS.md.
- **The repo may go public.** No secrets, real emails or phone numbers in code,
  tests, fixtures or commit messages.

## Conventions

- **Colours are semantic tokens only**, defined per theme in
  `src/app/globals.css` (`bg-surface`, `text-muted`, `bg-accent`, ...). Tailwind's
  built-in palette is removed on purpose, so `bg-red-500` does not exist. Anything
  new must work in both themes. `src/styles/tokens.test.ts` enforces WCAG AA
  contrast, so keep token values as 6-digit hex.
- **Theme**: `data-theme` on `<html>`, dark by default, saved in the `zc-theme`
  cookie and applied by an inline script before first paint. Do not read that
  cookie in a layout on the server: it would make every page dynamic.
- **Environment variables** are declared in `src/env.ts` and listed in
  `.env.example`. A test fails if the two lists differ. A key becomes required in
  the milestone that first needs it. Import `env` instead of reading `process.env`.
- **Security headers** come from `src/lib/security-headers.ts`. Add new CSP
  origins there and nowhere else.
- **Links are type-checked** (`typedRoutes`). Wrap `next/link` the way
  `ButtonLink` does.
- **Tests** sit next to the code as `*.test.ts` and run with Vitest.
- Copy on the marketing pages is placeholder text for the owner to edit.

## Commands

```bash
npm run dev         # dev server
npm run check       # typecheck + lint + tests + production build (run before committing)
npm run typecheck   # next typegen + tsc
npm run lint
npm run test
npm run format      # prettier --write
npm run verify      # headless-browser checks and screenshots (start a server first)
```

`npm run verify` drives the real app in headless Edge. Run it at the end of every
milestone and look at the screenshots in `.verify/`. The `verify-site` skill in
`.claude/skills/` has the full procedure. Pass a URL to check the live site:
`npm run verify -- https://zerocorps.org live`.
