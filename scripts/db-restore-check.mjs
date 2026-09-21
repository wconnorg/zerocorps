// npm run db:restore:check [path-to-backup]
//
// The restore drill. It decrypts a backup (the newest one by default) and restores it
// into a Postgres running INSIDE this command, built from the migrations in this
// repository. It touches nothing real, and it proves the backup can actually be
// restored. A backup that has never been restored is a hope, not a backup.

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { restoreDatabase } from "../src/lib/backup/dump.ts";
import { BACKUP_EXTENSION, decryptBackup } from "../src/lib/backup/format.ts";
import { ROOT, readEnvFile } from "./lib/env-file.mjs";
import { askHidden, requireTerminal } from "./lib/prompt.mjs";

requireTerminal("npm run db:restore:check");

function newestBackup() {
  const configured = readEnvFile().get("BACKUP_DIR");
  const directory =
    configured === ""
      ? join(ROOT, "backups")
      : isAbsolute(configured)
        ? configured
        : join(ROOT, configured);
  try {
    return readdirSync(directory)
      .filter((name) => name.endsWith(BACKUP_EXTENSION))
      .map((name) => join(directory, name))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  } catch {
    return undefined;
  }
}

const path = process.argv[2] ?? newestBackup();
if (!path) {
  console.error(
    "No backup found. Run `npm run db:backup` first, or pass the path to a backup file.",
  );
  process.exit(1);
}
console.log(`Backup: ${path}`);

let text;
try {
  const { header, plaintext } = decryptBackup(
    readFileSync(path),
    await askHidden("Backup passphrase (hidden): "),
  );
  text = plaintext.toString("utf8");
  console.log(`Decrypted. Made at ${header.createdAt}.`);
} catch (error) {
  console.error(error?.name === "BackupError" ? error.message : "Could not read the backup file.");
  process.exit(1);
}

console.log("Building an empty database from the migrations in this repository...");
const client = new PGlite();
try {
  await migrate(drizzle(client), { migrationsFolder: join(ROOT, "drizzle") });
  const query = async (sqlText, params) => (await client.query(sqlText, params)).rows;
  await client.exec("BEGIN");
  const summary = await restoreDatabase(query, text);
  await client.exec("COMMIT");

  console.log("\nRestored into the throwaway database:");
  const width = Math.max(12, ...summary.tables.map((table) => table.qualified.length));
  for (const table of summary.tables)
    console.log(`  ${table.qualified.padEnd(width)}  ${table.rows} rows`);
  if (summary.tables.length === 0) console.log("  (the backup is of an empty database)");
  console.log("\nPASS: this backup can be restored. The real database was not touched.");
} catch (error) {
  console.error(
    `\nFAIL: ${error?.name === "RestoreError" ? error.message : "the restore did not complete."}`,
  );
  process.exitCode = 1;
} finally {
  await client.close();
}
