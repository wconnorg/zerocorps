// npm run brain:export
//
// Rebuilds the brain (milestone 9): the owner's Obsidian vault listing every ZeroCorps
// member, one note each with their username, display name, email, the day they signed
// up, their profile picture and their Discord name (owner, 2026-10-04), and nothing else.
// `-- --academy` builds the Academy's brain instead: the same members with their rank and
// lessons, and a note per lesson, chapter, course and rank, a hub and a leaderboard.
//
// It reads the database as brain_reader, the role that can read the brain's views and
// nothing else, and reads a picture only when the vault does not have it yet. Run it
// whenever you want a fresh view; Obsidian picks the changes up.
//
// Pull, never push: the site has no part in this, and nothing leaves this laptop. Only
// notes and pictures this command wrote are ever replaced or deleted, inside the vault's
// ZeroCorps folder. It prints counts only, never a name.
//
// It reads the database and writes only on this laptop, so it asks no question and can be
// run by a scheduled task. First time: npm run brain:setup.

import { homedir } from "node:os";
import { join } from "node:path";
import { ContentError, loadCatalog } from "../src/lib/academy/content.ts";
import { buildBrain } from "../src/lib/brain/notes.ts";
import {
  assertBrainRole,
  BRAIN_ROLE,
  BrainReadError,
  readBrain,
  readPictures,
} from "../src/lib/brain/read.ts";
import {
  BrainVaultError,
  checkVaultPath,
  prepareVault,
  syncBrainFolder,
  syncBrainPictures,
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
const academy = process.argv.includes("--academy");

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

// The Academy's lesson files matter only to the Academy's brain.
let catalog;
if (academy) {
  try {
    catalog = loadCatalog(join(ROOT, "content", "academy"));
  } catch (error) {
    if (error instanceof ContentError)
      stop(
        "The Academy's files have problems, so the brain was not rebuilt. Run: npm run academy:check",
      );
    throw error;
  }
}

const sql = connect(url);
const query = queryOf(sql);
/** Closes the connection, then stops with a sentence that names no value. */
const fail = async (error) => {
  await sql.end({ timeout: 5 }).catch(() => {});
  stop(
    `The brain was not rebuilt: ${
      error instanceof BrainReadError || error instanceof BrainVaultError
        ? error.message
        : error?.phase === "database"
          ? explainConnectionError(error.cause, url)
          : `unexpected error (${error?.code ?? error?.name ?? "error"}).`
    }`,
  );
};
/** A database error, marked so it is explained as one (its message is scrubbed of the URL). */
const fromDatabase = (cause) => Object.assign(new Error("database"), { phase: "database", cause });

let data;
/** Until the migration 0010 is applied, the brain is built without the pictures. */
let picturesReady = false;
try {
  ({ pictures: picturesReady } = await assertBrainRole(query));
  data = await readBrain(query, { academy, pictures: picturesReady });
} catch (error) {
  await fail(error instanceof BrainReadError ? error : fromDatabase(error));
}

const NO_PICTURES = { created: 0, unchanged: 0, removed: 0, kept: 0, conflicts: 0, skipped: 0 };

try {
  const brain = buildBrain({ data, now: new Date(), academy, catalog, pictures: picturesReady });
  const { created } = prepareVault(vault.path);
  const notes = syncBrainFolder(vault.path, brain.files);
  const pictures = picturesReady
    ? await syncBrainPictures(vault.path, brain.pictures, (userIds) =>
        readPictures(query, userIds).catch((error) => {
          throw error instanceof BrainReadError ? error : fromDatabase(error);
        }),
      )
    : NO_PICTURES;
  const graph = writeGraphSettings(vault.path, brain.colorGroups);
  await sql.end({ timeout: 5 });

  const { counts } = brain;
  console.log(`The brain is up to date in ${vault.path}${created ? " (a new vault)" : ""}.`);
  console.log(
    academy
      ? `  ${counts.members} member(s), ${counts.completions} lesson(s) completed in all, ${counts.lessonNotes} lesson note(s).`
      : picturesReady
        ? `  ${counts.members} member(s), ${counts.pictures} with a profile picture.`
        : `  ${counts.members} member(s).`,
  );
  if (!picturesReady)
    console.log(
      "  Profile pictures: not yet. They come with the database migration 0010_brain_pictures, applied after the release that names them on the privacy page.",
    );
  console.log(
    `  Notes: ${notes.created} new, ${notes.updated} changed, ${notes.unchanged} unchanged, ${notes.removed} removed.`,
  );
  if (pictures.created + pictures.unchanged + pictures.removed > 0)
    console.log(
      `  Pictures: ${pictures.created} new, ${pictures.unchanged} unchanged, ${pictures.removed} removed.`,
    );
  if (pictures.skipped > 0)
    console.log(
      `  ${pictures.skipped} picture(s) changed while being read: they come at the next refresh.`,
    );
  if (notes.kept > 0)
    console.log(
      `  Kept ${notes.kept} note(s) in the ZeroCorps folder that this command did not write.`,
    );
  if (pictures.kept > 0)
    console.log(
      `  Kept ${pictures.kept} file(s) in the Pictures folder that this command did not write.`,
    );
  if (notes.conflicts.length + pictures.conflicts > 0) {
    console.log(
      `  Left ${notes.conflicts.length + pictures.conflicts} note(s) or picture(s) alone: a file of your own, or a link, is in their place.`,
    );
  }
  if (typeof graph === "object") console.log(`  ${graph.problem}`);
  if (created)
    console.log(
      `\nIn Obsidian: Open folder as vault, and choose ${vault.path}. ${
        academy ? 'Start from the note "ZeroCorps Brain".' : "The members are in ZeroCorps/Members."
      }`,
    );
} catch (error) {
  await fail(error);
}
