import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit is used for ONE thing: `npm run db:generate`, which turns a change in
 * `src/db/schema.ts` into a SQL file under `drizzle/`. That works offline.
 *
 * There are deliberately no `dbCredentials` here. Without them `drizzle-kit push`,
 * `migrate`, `pull` and `studio` cannot reach the database at all, which is the
 * point: there is one database, shared with the live site, and the only way to change
 * it is `npm run db:migrate` (typed confirmation, backup from the last hour).
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // The app role is created by a hand-written migration, never by drizzle-kit.
  entities: { roles: false },
  strict: true,
  verbose: true,
});
