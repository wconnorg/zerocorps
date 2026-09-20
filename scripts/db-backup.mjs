// npm run db:backup
//
// Writes an encrypted backup of every table's rows. Run it by hand in a terminal.
//
//   - It reads the database in ONE read-only snapshot, so every table is consistent.
//   - The passphrase is asked for, twice, and never shown. It is never taken from the
//     command line, so it cannot end up in your shell history.
//   - The file is then decrypted again and compared, so a backup that cannot be read
//     is caught now and not on the day it is needed.
//
// Without the passphrase nobody can read a backup, you included. Keep it in your
// password manager.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { dumpDatabase } from "../src/lib/backup/dump.ts";
import {
  BACKUP_EXTENSION,
  decryptBackup,
  encryptBackup,
  targetFingerprint,
} from "../src/lib/backup/format.ts";
import { connect, explainConnectionError, queryOf, readDatabaseUrl } from "./lib/database.mjs";
import { ROOT, readEnvFile } from "./lib/env-file.mjs";
import { askHidden, requireTerminal } from "./lib/prompt.mjs";

const MIN_PASSPHRASE = 12;

requireTerminal("npm run db:backup");
const { url } = readDatabaseUrl("migrations");

const configured = readEnvFile().get("BACKUP_DIR");
const directory =
  configured === ""
    ? join(ROOT, "backups")
    : isAbsolute(configured)
      ? configured
      : join(ROOT, configured);

const passphrase = await askHidden("Backup passphrase (hidden): ");
if (passphrase.length < MIN_PASSPHRASE) {
  console.error(
    `Use a passphrase of at least ${MIN_PASSPHRASE} characters. Several random words work well.`,
  );
  process.exit(1);
}
if ((await askHidden("Type it again: ")) !== passphrase) {
  console.error("The two entries differ. Nothing was written.");
  process.exit(1);
}

const createdAt = new Date().toISOString();
const sql = connect(url);
let dump;
try {
  console.log("Reading the database in one read-only snapshot...");
  dump = await sql.begin("isolation level repeatable read read only", (transaction) =>
    dumpDatabase(queryOf(transaction), createdAt),
  );
} catch (error) {
  console.error(`Could not read the database: ${explainConnectionError(error, url)}`);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}

console.log("Encrypting (this takes a moment: the key derivation is slow on purpose)...");
const plaintext = Buffer.from(dump.text, "utf8");
const file = encryptBackup(plaintext, passphrase, { createdAt, target: targetFingerprint(url) });

mkdirSync(directory, { recursive: true });
const name = `zerocorps-${createdAt.replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-")}${BACKUP_EXTENSION}`;
const path = join(directory, name);
writeFileSync(path, file, { flag: "wx" });

console.log("Checking that the file decrypts again...");
const readBack = decryptBackup(readFileSync(path), passphrase).plaintext;
const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");
if (sha(readBack) !== sha(plaintext)) {
  console.error("The file on disk does not decrypt to what was written. Do NOT rely on it.");
  process.exit(1);
}

console.log(`\nBackup written and verified: ${path}`);
const width = Math.max(12, ...dump.summary.tables.map((table) => table.qualified.length));
for (const table of dump.summary.tables)
  console.log(`  ${table.qualified.padEnd(width)}  ${table.rows} rows`);
if (dump.summary.tables.length === 0)
  console.log("  (no tables yet: this is a backup of an empty database)");
console.log(`  migrations applied: ${dump.summary.migrations.length}`);
console.log(
  "\nNext: `npm run db:restore:check` proves it can be restored, without touching the real database.",
);
