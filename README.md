# zerocorps.org

The website for ZeroCorps, a trading education brand. It hosts ZeroCorps Academy
and connects to the ZeroCorps Discord through a separate bot, Agent Zero.

Next.js (App Router) · TypeScript · Tailwind CSS · Drizzle ORM · Postgres · Better Auth

## Getting started

Requires Node.js 22 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in what the current milestone needs
npm run dev                  # http://localhost:3000
```

Environment variables are validated at startup. If one is missing or malformed,
`next dev`, `next build` and `next start` stop straight away and name the key.

## Scripts

| Command             | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Development server                                  |
| `npm run build`     | Production build                                    |
| `npm run start`     | Serve the production build                          |
| `npm run check`     | Type check, lint, unit tests and a production build |
| `npm run typecheck` | Generate route types, then run `tsc`                |
| `npm run lint`      | ESLint                                              |
| `npm run test`      | Unit tests (Vitest)                                 |
| `npm run format`    | Prettier                                            |

## Layout

```
docs/                 The brief (the contract) and the decisions made since
src/app/(marketing)/  Public pages: home and the /academy landing
src/app/(auth)/       Sign in, sign up and the other account screens
src/components/       UI, site chrome, theme toggle, marketing illustrations
src/lib/              Theme helpers, security headers, small utilities
src/env.ts            Environment variable schema and validation
```

## Themes

There are exactly two themes, dark (the default) and light. Every colour is a
semantic CSS variable defined per theme in `src/app/globals.css`. To rebrand,
change `--accent` and `--accent-fg` in both theme blocks and run `npm run test`:
the token tests fail if any text and background pair drops below WCAG AA contrast.

## Status

The project is built one milestone at a time. See [docs/BRIEF.md](docs/BRIEF.md)
for the plan, [docs/DECISIONS.md](docs/DECISIONS.md) for decisions made since, and
[AGENTS.md](AGENTS.md) for the current milestone and the project rules.
