import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../db/schema.ts";

/**
 * A real Postgres inside the test process (PGlite), built from the SQL files in
 * `drizzle/`. So the tests prove the very migrations that will run on the real
 * database, the app role and its policies included.
 *
 * Tests NEVER read `DATABASE_URL`. There is one real database and it is production.
 */
export async function createTestDatabase() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });

  return {
    client,
    db,
    /** Runs the callback as `zerocorps_app`, the role the app really connects as. */
    async asAppRole<T>(work: () => Promise<T>): Promise<T> {
      await client.exec("SET ROLE zerocorps_app");
      try {
        return await work();
      } finally {
        await client.exec("RESET ROLE");
      }
    },
    close: () => client.close(),
  };
}

export type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>;
