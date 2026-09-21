import type { Query } from "../backup/dump.ts";

/**
 * How many rows each of the app's tables holds, and nothing else. `npm run db:counts`.
 *
 * There is one database, shared by the laptop and the live site, so `users` here is
 * the number of accounts on the live site too. The owner uses it to see whether a test
 * account is still around, and at a release to see exactly the accounts they expect.
 *
 * It returns table names and numbers only: never an address, an id or any other value
 * from a row. The table list comes from the database, so a new table cannot be
 * forgotten. Every policy opens a table fully to `zerocorps_app` (`USING (true)`), so
 * what that role counts is everything there is.
 *
 * The caller supplies the query function, and the script runs it in a READ ONLY
 * transaction. A table the role may not read is reported as `null`, not attempted: a
 * failed statement would abort that transaction.
 *
 * This module imports nothing from the app, so the script in `scripts/` can load it.
 */

export type TableCount = { table: string; rows: number | null };

// A table name goes into the statement itself, so only a plain identifier is accepted.
const PLAIN_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

export async function countRows(query: Query): Promise<TableCount[]> {
  const tables = await query(
    `SELECT tablename AS name,
            pg_catalog.has_table_privilege(
              pg_catalog.quote_ident(schemaname) || '.' || pg_catalog.quote_ident(tablename),
              'SELECT'
            ) AS readable
       FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename`,
  );

  const names = tables.map((row) => String(row.name));
  if (names.some((name) => !PLAIN_IDENTIFIER.test(name))) {
    throw new Error("a table in the public schema has an unexpected name, so nothing was counted.");
  }

  const counts: TableCount[] = [];
  for (const row of tables) {
    const table = String(row.name);
    if (row.readable !== true) {
      counts.push({ table, rows: null });
      continue;
    }
    const [result] = await query(`SELECT count(*)::int AS n FROM public.${table}`);
    counts.push({ table, rows: Number(result?.n) });
  }
  return counts;
}
