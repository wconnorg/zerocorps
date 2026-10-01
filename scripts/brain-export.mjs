// npm run brain:export
//
// Rebuilds the brain (milestone 9): the owner's Obsidian vault of every ZeroCorps member,
// from the database, read as brain_reader, the role that can read the brain's three views
// and nothing else. Run it whenever you want a fresh view; Obsidian picks the changes up.
//
// Pull, never push: the site has no part in this, and nothing leaves this laptop. Only
// notes this command wrote are ever replaced or deleted, inside the vault's ZeroCorps
// folder. It prints counts only, never a name.
//
// It reads the database and writes only on this laptop, so it asks no question and can be
// run by a scheduled task. First time: npm run brain:setup.

import { homedir } from "node:os";
import { join } from "node:path";
import { ContentError, loadCatalog } from "../src/lib/academy/content.ts";
import { buildBrain } from "../src/lib/brain/notes.ts";
import { assertBrainRole, BRAIN_ROLE, BrainReadError, readBrain } from "../src/lib/brain/read.ts";
import {
  BrainVaultError,
  checkVaultPath,
  prepareVault,
  syncBrainFolder,
  syncedFoldersFrom,
  writeGraphSettings,
} from "../src/lib/brain/vault.ts";
import { diagnoseDatabaseUrl } from "../src/lib/db-url.ts";
import { connect, explainConnectionError, queryOf } from "./lib/database.mjs";
import { readEnvFile, ROOT } from "./lib/env-file.mjs";

const env = readEnvFile();
const stop = (message) => {
  console.error(message);
  process.exit(1);
};

const url = env.get("BRAIN_DATABASE_URL");
if (url === "") stop("BRAIN_DATABASE_URL is blank. Run: npm run brain:setup");
const diagnosis = diagnoseDatabaseUrl(url, "brain");
if (!diagnosis.ok)
  stop(
    `BRAIN_DATABASE_URL cannot be used:\n  - ${diagnosis.problems.join("\n  - ")}\nRun: npm run brain:setup`,
  );
if (diagnosis.role !== BRAIN_ROLE)
  stop(`BRAIN_DATABASE_URL must connect as ${BRAIN_ROLE}. Run: npm run brain:setup`);

const vault = checkVaultPath(env.get("BRAIN_VAULT_PATH"), {
  repoRoot: ROOT,
  home: homedir(),
  syncedFolders: syncedFoldersFrom(process.env),
  caseInsensitive: process.platform === "win32" || process.platform === "darwin",
});
if (!vault.ok) stop(vault.problem);

let catalog;
try {
  catalog = loadCatalog(join(ROOT, "content", "academy"));
} catch (error) {
  if (error instanceof ContentError)
    stop(
      "The Academy's files have problems, so the brain was not rebuilt. Run: npm run academy:check",
    );
  throw error;
}

const sql = connect(url);
let data;
try {
  const query = queryOf(sql);
  await assertBrainRole(query);
  data = await readBrain(query);
} catch (error) {
  stop(
    `The brain was not rebuilt: ${error instanceof BrainReadError ? error.message : explainConnectionError(error, url)}`,
  );
} finally {
  await sql.end({ timeout: 5 });
}

try {
  const brain = buildBrain({ data, catalog, now: new Date() });
  const { created } = prepareVault(vault.path);
  const result = syncBrainFolder(vault.path, brain.files);
  const graph = writeGraphSettings(vault.path, brain.colorGroups);

  console.log(`The brain is up to date in ${vault.path}${created ? " (a new vault)" : ""}.`);
  console.log(
    `  ${brain.counts.members} member(s), ${brain.counts.lessonNotes} lesson(s), ${brain.counts.completions} lesson(s) completed in all.`,
  );
  console.log(
    `  Notes: ${result.created} new, ${result.updated} changed, ${result.unchanged} unchanged, ${result.removed} removed.`,
  );
  if (result.kept > 0)
    console.log(
      `  Kept ${result.kept} note(s) in the ZeroCorps folder that this command did not write.`,
    );
  if (result.conflicts.length > 0) {
    console.log(
      `  Left ${result.conflicts.length} note(s) alone: a note of your own, or a link, is in their place.`,
    );
  }
  if (typeof graph === "object") console.log(`  ${graph.problem}`);
  if (created)
    console.log(
      `\nIn Obsidian: Open folder as vault, and choose ${vault.path}. Start from the note "ZeroCorps Brain".`,
    );
} catch (error) {
  stop(
    `The brain was not rebuilt: ${error instanceof BrainVaultError ? error.message : `unexpected error (${error?.code ?? error?.name ?? "error"}).`}`,
  );
}
