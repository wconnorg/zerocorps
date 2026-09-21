import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import { databaseTls } from "@/lib/db-ca";
import * as schema from "./schema";

/**
 * The app's connection to the ONE database, which the laptop and the live site share.
 *
 * It connects as `zerocorps_app`, a role that cannot create, alter or drop anything
 * (`npm run db:check-role` proves it). Migrations and backups use a different URL and
 * a different role, and never run from here.
 *
 *   prepare: false   Supabase's transaction pooler does not support prepared statements.
 *   ssl              always encrypted AND verified: the server's chain and host name are
 *                    checked against the pinned certificates in `src/lib/db-ca.ts`, and
 *                    nothing else is trusted. There is no fallback. If the check fails,
 *                    no connection is made and every request that needs the database is
 *                    refused (runbook in docs/SECURITY.md).
 *
 * Tests never come here: they run on PGlite (`src/test/test-database.ts`).
 */

if (process.env.VITEST) {
  throw new Error("Tests must never open the real database. Use createTestDatabase() instead.");
}

// One pool per server process, surviving hot reloads in development.
const globalForDatabase = globalThis as unknown as { zerocorpsSql?: ReturnType<typeof postgres> };

const sql =
  globalForDatabase.zerocorpsSql ??
  postgres(env.DATABASE_URL, {
    prepare: false,
    ssl: databaseTls(),
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });

if (env.NODE_ENV !== "production") globalForDatabase.zerocorpsSql = sql;

export const db = drizzle(sql, { schema });
