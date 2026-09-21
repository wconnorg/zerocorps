// npm run db:counts
//
// Prints how many rows each of the app's tables holds, and nothing else: no address,
// no id, no value from any row. There is ONE database, so `users` is the number of
// accounts on the live site too.
//
// It connects as the app's role (DATABASE_URL, zerocorps_app) and does all its reading
// inside a READ ONLY transaction. It changes nothing.

import { countRows } from "../src/lib/db-tools/counts.ts";
import { connect, explainConnectionError, queryOf, readDatabaseUrl } from "./lib/database.mjs";

const { url } = readDatabaseUrl("app");
const sql = connect(url);

try {
  const counts = await sql.begin("read only", (transaction) => countRows(queryOf(transaction)));
  const width = Math.max(...counts.map((entry) => entry.table.length));
  console.log("Rows in each table (this is the ONE database, so the live site too):\n");
  for (const { table, rows } of counts) {
    console.log(`  ${table.padEnd(width)}  ${rows === null ? "not readable by this role" : rows}`);
  }
  console.log("\nCounts only. Nothing was changed, and no value from any row was read out.");
} catch (error) {
  console.error(`Could not count: ${explainConnectionError(error, url)}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
