// npm run brain:setup
//
// Switches on the brain export (milestone 9), once, and again whenever you want a new
// password:
//
//   1. asks where the brain's vault folder goes (outside this repository, not in OneDrive);
//   2. gives the database role brain_reader a new random password. It is sent as a SCRAM
//      secret computed on this laptop, the way psql's \password does it, so the password
//      itself never reaches the database, its logs or its statistics;
//   3. writes BRAIN_DATABASE_URL and BRAIN_VAULT_PATH into .env.local;
//   4. checks the new connection: brain_reader, the brain's views, nothing more.
//
// Nothing is shown: not the password, not the URL. brain_reader can read the brain's
// three views and nothing else (drizzle/0008_brain_export.sql). Running this again
// replaces the password, and the old one stops working.

import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { assertBrainRole, BRAIN_ROLE, BrainReadError } from "../src/lib/brain/read.ts";
import { checkVaultPath, syncedFoldersFrom } from "../src/lib/brain/vault.ts";
import { generatePassword, scramSecret } from "../src/lib/db-tools/scram.ts";
import { diagnoseDatabaseUrl } from "../src/lib/db-url.ts";
import { setEnvValues, singleQuoted } from "../src/lib/env-lines.ts";
import { connect, explainConnectionError, queryOf } from "./lib/database.mjs";
import { ENV_FILE, readEnvFile, ROOT } from "./lib/env-file.mjs";
import { ask, requireTerminal } from "./lib/prompt.mjs";

const POOLER_PORT = "6543";

requireTerminal("npm run brain:setup");
const env = readEnvFile();
const stop = (message) => {
  console.error(message);
  process.exit(1);
};

const migrationsUrl = env.get("DATABASE_URL_MIGRATIONS");
if (!diagnoseDatabaseUrl(migrationsUrl, "migrations").ok) {
  stop(
    "DATABASE_URL_MIGRATIONS must be correct first. Run `npm run db:check` and fix what it reports.",
  );
}

// 1. The vault folder.
const suggested = env.get("BRAIN_VAULT_PATH") || join(homedir(), "ZeroCorps Brain");
console.log("The brain is an Obsidian vault on this laptop, in a folder of its own.");
const typed = await ask(`Vault folder (press Enter for ${suggested}): `);
const vault = checkVaultPath(typed || suggested, {
  repoRoot: ROOT,
  home: homedir(),
  syncedFolders: syncedFoldersFrom(process.env),
  caseInsensitive: process.platform === "win32" || process.platform === "darwin",
});
if (!vault.ok) stop(`${vault.problem} Nothing was changed.`);

// The URL is built and checked BEFORE the password changes, so a mistake here changes nothing.
const password = generatePassword();
const migrations = new URL(migrationsUrl);
const projectRef = decodeURIComponent(migrations.username).split(".").slice(1).join(".");
const brainUrl = `${migrations.protocol}//${BRAIN_ROLE}.${projectRef}:${password}@${migrations.hostname}:${POOLER_PORT}/postgres`;
if (!diagnoseDatabaseUrl(brainUrl, "brain").ok)
  stop("The brain's URL did not pass its own check. Nothing was changed.");

// 2. Confirm.
console.log(`
This will:
  - give the database role ${BRAIN_ROLE} a new random password, which is never shown
    (${BRAIN_ROLE} can read the brain's three views and nothing else);
  - write BRAIN_DATABASE_URL and BRAIN_VAULT_PATH into .env.local
    (the vault folder: ${vault.path});
  - check the new connection.
Running it again later replaces the password; the old one then stops working.`);
const phrase = "set up the brain";
if ((await ask(`Type "${phrase}" to go on, or anything else to stop: `)) !== phrase) {
  console.log("Stopped. Nothing was changed.");
  process.exit(0);
}

// 3. The password, as a SCRAM secret, through the owner's connection.
const owner = connect(migrationsUrl);
try {
  const [role] =
    await owner`SELECT 1 AS present FROM pg_catalog.pg_roles WHERE rolname = ${BRAIN_ROLE}`;
  if (!role) {
    stop(
      `The role ${BRAIN_ROLE} does not exist yet. Apply the migration 0008_brain_export first (npm run db:backup, then npm run db:migrate). Nothing was changed.`,
    );
  }
  // Letters, digits and the secret's own $ : + / = only: nothing that could end the quote.
  const secret = scramSecret(password);
  if (!/^SCRAM-SHA-256\$[A-Za-z0-9+/=:$]+$/.test(secret))
    stop("The secret came out malformed. Nothing was changed.");
  await owner.unsafe(`ALTER ROLE ${BRAIN_ROLE} WITH LOGIN CONNECTION LIMIT 3 PASSWORD '${secret}'`);
} catch (error) {
  stop(`Nothing was changed: ${explainConnectionError(error, migrationsUrl)}`);
} finally {
  await owner.end({ timeout: 5 });
}

// 4. .env.local, without showing anything.
try {
  writeFileSync(
    ENV_FILE,
    setEnvValues(readEnvFile().text, {
      BRAIN_DATABASE_URL: brainUrl,
      BRAIN_VAULT_PATH: singleQuoted(vault.path),
    }),
  );
} catch (error) {
  stop(
    `The new password is set, but .env.local could not be written (${error?.code ?? "error"}; is it ` +
      "open in an editor?). Close it and run `npm run brain:setup` again: it sets a fresh password.",
  );
}
console.log(
  "\nThe password is set and .env.local holds the brain's connection. Nothing was shown.",
);

// 5. Prove it. The pooler can take a little while to accept a new password.
let proven = false;
for (let attempt = 1; attempt <= 6 && !proven; attempt++) {
  const brain = connect(brainUrl);
  try {
    await assertBrainRole(queryOf(brain));
    const [count] = await brain`SELECT count(*)::int AS members FROM brain.members`;
    console.log(
      `Connected as ${BRAIN_ROLE}: it reads the brain's views (${count.members} member(s)) and no table of the app.`,
    );
    proven = true;
  } catch (error) {
    if (error instanceof BrainReadError) stop(error.message);
    if (attempt === 6) {
      console.error(
        `The connection could not be proven: ${explainConnectionError(error, brainUrl)}`,
      );
      console.error(
        "The pooler sometimes needs a few minutes for a new password. Try `npm run brain:export` later.",
      );
      process.exitCode = 1;
    } else {
      console.log(`Waiting for the pooler to accept the new password (try ${attempt} of 6)…`);
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  } finally {
    await brain.end({ timeout: 5 });
  }
}
if (proven) console.log("\nNext: npm run brain:export");
