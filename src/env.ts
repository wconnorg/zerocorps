import { parseEnv, type Env } from "./env-schema.ts";

/**
 * Validated environment variables. Server-only.
 *
 * `next.config.ts` imports this module, so a bad or missing value stops
 * `next dev`, `next build` and `next start` immediately with a readable message
 * instead of surfacing later as a confusing runtime error.
 *
 * The schema lives in `src/env-schema.ts`, which is safe to import anywhere. This
 * file is the only one that reads `process.env`, and it does so on import. Tests
 * must not import it: they build what they need from fixtures instead.
 */

if (typeof window !== "undefined") {
  throw new Error("src/env.ts is server-only and must not be imported from client code.");
}

export const env: Env = parseEnv(process.env);

export type { Env };
