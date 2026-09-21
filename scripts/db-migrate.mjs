// npm run db:migrate
//
// The ONLY way the database schema is changed. There is one database, shared by the
// laptop and the live site, so this command is careful on purpose:
//
//   1. it needs a person in a terminal;
//   2. it shows the target host and the pending migrations;
//   3. it REFUSES to run unless an encrypted backup of THIS database, made in the last
//      hour, exists (npm run db:backup);
//   4. it needs a typed confirmation.
//
// Migrations are additive. Reverting a git push restores code, never data: only a
// backup restores data.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { BACKUP_EXTENSION, readBackupHeader, targetFingerprint } from "../src/lib/backup/format.ts";
import { parseJournal, pendingMigrations } from "../src/lib/db-tools/migrations.ts";
import { APP_ROLE } from "../src/lib/db-tools/role-check.ts";
import { connect, explainConnectionError, queryOf, readDatabaseUrl } from "./lib/database.mjs";
import { ROOT, readEnvFile } from "./lib/env-file.mjs";
import { ask, requireTerminal } from "./lib/prompt.mjs";

const BACKUP_MAX_AGE_MINUTES = 60;
const MIGRATIONS_FOLDER = join(ROOT, "drizzle");

requireTerminal("npm run db:migrate");
const { url } = readDatabaseUrl("migrations");
const target = new URL(url);

function recentBackup() {
  const configured = readEnvFile().get("BACKUP_DIR");
  const directory =
    configured === ""
      ? join(ROOT, "backups")
      : isAbsolute(configured)
        ? configured
        : join(ROOT, configured);
  let names = [];
  try {
    names = readdirSync(directory).filter((name) => name.endsWith(BACKUP_EXTENSION));
  } catch {
    return null;
  }
  const fingerprint = targetFingerprint(url);
  const candidates = names
    .map((name) => ({
      name,
      path: join(directory, name),
      modified: statSync(join(directory, name)).mtimeMs,
    }))
    .filter((entry) => Date.now() - entry.modified <= BACKUP_MAX_AGE_MINUTES * 60_000)
    .sort((a, b) => b.modified - a.modified);
  for (const candidate of candidates) {
    try {
      // The header is readable without the passphrase. It must be a real backup of THIS database.
      if (readBackupHeader(readFileSync(candidate.path)).target === fingerprint) return candidate;
    } catch {
      // Not a valid backup file: keep looking.
    }
  }
  return null;
}

const sql = connect(url);
try {
  const journal = parseJournal(
    readFileSync(join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8"),
  );
  let pending;
  let role;
  try {
    pending = await pendingMigrations(queryOf(sql), journal);
    [{ role }] = await sql`SELECT current_user::text AS role`;
  } catch (error) {
    console.error(`Could not reach the database: ${explainConnectionError(error, url)}`);
    process.exit(1);
  }

  console.log(`Target host:  ${target.hostname}:${target.port}`);
  console.log(`Database:     ${target.pathname.slice(1)}   (connected as role "${role}")`);
  console.log("This is the ONE database. The live site uses it too.\n");

  if (role === APP_ROLE) {
    console.error(
      `Refusing: migrations need the owner role, and DATABASE_URL_MIGRATIONS connects as ${APP_ROLE}.`,
    );
    process.exit(1);
  }
  if (pending.length === 0) {
    console.log("Nothing to do: every migration is already applied.");
    process.exit(0);
  }

  console.log(`Pending migrations (${pending.length}):`);
  for (const entry of pending) console.log(`  ${entry.tag}`);
  console.log("");

  const backup = recentBackup();
  if (!backup) {
    console.error(
      `Refusing: there is no encrypted backup of this database from the last ${BACKUP_MAX_AGE_MINUTES} minutes.\n` +
        "Run `npm run db:backup` first, then run this again.",
    );
    process.exit(1);
  }
  console.log(
    `Backup found: ${backup.name} (${Math.round((Date.now() - backup.modified) / 60_000)} minutes old)\n`,
  );

  const phrase = `apply ${pending.length}`;
  const answer = await ask(`Type "${phrase}" to apply them, or anything else to stop: `);
  if (answer !== phrase) {
    console.log("Stopped. Nothing was changed.");
    process.exit(0);
  }

  await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER });
  console.log(`\nApplied ${pending.length} migration(s).`);

  const [appRole] = await sql`SELECT rolcanlogin FROM pg_roles WHERE rolname = ${APP_ROLE}`;
  if (appRole && appRole.rolcanlogin !== true) {
    console.log(
      `\nNext: the role ${APP_ROLE} exists but cannot log in yet. Give it a password by hand ` +
        '(docs/SECURITY.md, "Give the app role its password"), point DATABASE_URL at it, then run `npm run db:check-role`.',
    );
  }
} catch (error) {
  console.error(`The migration failed and was rolled back: ${explainConnectionError(error, url)}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
