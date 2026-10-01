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

/** The roles the migrations create. The test process itself runs as a superuser. */
export type MigrationRole = "zerocorps_app" | "brain_reader";

export async function createTestDatabase() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });

  /** Runs the callback as one of the migrations' roles, then switches back. */
  async function asRole<T>(role: MigrationRole, work: () => Promise<T>): Promise<T> {
    await client.exec(`SET ROLE ${role}`);
    try {
      return await work();
    } finally {
      await client.exec("RESET ROLE");
    }
  }

  return {
    client,
    db,
    /** Runs the callback as `zerocorps_app`, the role the app really connects as. */
    asAppRole: <T>(work: () => Promise<T>) => asRole("zerocorps_app", work),
    /** Runs the callback as another of the migrations' roles, such as `brain_reader`. */
    asRole,
    close: () => client.close(),
  };
}

export type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>;
