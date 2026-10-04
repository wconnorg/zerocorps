import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { BRAIN_FOLDER, GENERATED_BY, PICTURES_FOLDER, type ColorGroup } from "./notes.ts";
import { PICTURE_VERSION } from "./read.ts";

/**
 * The brain's vault on the owner's laptop (milestone 9): where it may live, and how its
 * notes are written. The vault holds member data, so the rules are strict:
 *
 * - It is never inside the public repository, never contains it, is never the home folder
 *   or anything above it, and is never in a folder a sync service uploads (OneDrive and
 *   the like): the brief keeps the vault local, or on end-to-end encrypted sync only.
 * - The command takes over only a folder it made itself (a marker file says so) or an empty
 *   one, and rebuilds only its own `ZeroCorps` folder inside it.
 * - Inside that folder it deletes and overwrites only notes that carry its own marker, so
 *   a note the owner puts there is kept, and never follows a link out of the folder.
 * - A note that has not changed is not written again, so Obsidian re-reads only what did.
 * - Members' pictures (owner, 2026-10-04) live in `ZeroCorps/Pictures`, each named by a hash
 *   of its own bytes: a picture's file proves it is the export's, and one already there is
 *   never read from the database again.
 *
 * This module imports nothing from the app, so `npm run brain:export` can load it.
 */

export const MARKER_FILE = ".zerocorps-brain";
const MARKER_TEXT =
  `This folder is the ZeroCorps brain, an Obsidian vault written by ${GENERATED_BY}.\n` +
  `Its ${BRAIN_FOLDER} folder is rebuilt on every run: keep your own notes outside it.\n`;

/** What Obsidian and the operating system may put in a new folder before the first run. */
const HARMLESS_ENTRIES = new Set([".obsidian", ".trash", ".DS_Store", "desktop.ini", "Thumbs.db"]);

/** Folder names of the common sync services, wherever they sit. */
const SYNC_NAMES =
  /^(onedrive( - .+)?|dropbox|google ?drive|my drive|icloud ?drive|icloud|box|box sync|nextcloud|owncloud|mega)$/i;

/** A fixed sentence for the owner. */
export class BrainVaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrainVaultError";
  }
}

export type VaultContext = {
  repoRoot: string;
  home: string;
  /** Folders a sync service uploads, as this machine names them. */
  syncedFolders: string[];
  /** Windows and macOS compare paths without regard to case. */
  caseInsensitive: boolean;
};

/** The folders OneDrive syncs, from the environment variables OneDrive sets. */
export function syncedFoldersFrom(env: Record<string, string | undefined>): string[] {
  return ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"]
    .map((key) => env[key])
    .filter((value): value is string => typeof value === "string" && isAbsolute(value));
}

/** The real path of a path that may not exist yet: its nearest existing ancestor, resolved through links. */
function realPath(path: string): string {
  let existing = resolve(path);
  const rest: string[] = [];
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) break;
    rest.unshift(basename(existing));
    existing = parent;
  }
  let real = existing;
  try {
    real = realpathSync.native(existing);
  } catch {
    // Unreadable: compare the path as written.
  }
  return join(real, ...rest);
}

/** Checks BRAIN_VAULT_PATH. The answer's path is the real one, links resolved. */
export function checkVaultPath(
  raw: string,
  context: VaultContext,
): { ok: true; path: string } | { ok: false; problem: string } {
  const fail = (problem: string) => ({ ok: false as const, problem });
  const value = raw.trim();
  if (value === "") return fail("BRAIN_VAULT_PATH is blank. Run: npm run brain:setup");
  if ([...value].some((character) => character.charCodeAt(0) < 32) || /['"$`]/.test(value)) {
    return fail(
      "BRAIN_VAULT_PATH holds quotes, a $ sign or a control character. Choose a plain folder name.",
    );
  }
  if (!isAbsolute(value)) {
    return fail("BRAIN_VAULT_PATH must be a full path, starting with a drive letter such as C:\\.");
  }
  const path = realPath(value);
  if (parse(path).root === path) return fail("BRAIN_VAULT_PATH cannot be the top of a drive.");

  const normal = (entry: string) => (context.caseInsensitive ? entry.toLowerCase() : entry);
  const inside = (child: string, parent: string) => {
    const between = relative(normal(parent), normal(child));
    // Outside means ".." itself or a path that climbs with "../": a folder NAMED "..x" is inside.
    const climbs = between === ".." || between.startsWith(`..${sep}`) || between.startsWith("../");
    return between === "" || (!climbs && !isAbsolute(between));
  };
  const repo = realPath(context.repoRoot);
  if (inside(path, repo)) {
    return fail(
      "BRAIN_VAULT_PATH is inside the repository, which is public. Choose a folder outside it.",
    );
  }
  if (inside(repo, path)) {
    return fail(
      "BRAIN_VAULT_PATH contains the repository. Choose a folder of its own, outside it.",
    );
  }
  if (inside(realPath(context.home), path)) {
    return fail(
      "BRAIN_VAULT_PATH is your home folder or above it. Choose a new folder of its own.",
    );
  }
  const synced =
    context.syncedFolders.some((folder) => inside(path, realPath(folder))) ||
    path.split(/[\\/]/).some((part) => SYNC_NAMES.test(part));
  if (synced) {
    return fail(
      "BRAIN_VAULT_PATH is in a folder a sync service uploads (OneDrive or the like). The brain " +
        "holds member data and stays on this laptop: choose a folder outside it.",
    );
  }
  return { ok: true, path };
}

/** Makes the vault folder, or confirms one the export made. Refuses any other folder. */
export function prepareVault(path: string): { created: boolean } {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, MARKER_FILE), MARKER_TEXT);
    return { created: true };
  }
  if (!lstatSync(path).isDirectory())
    throw new BrainVaultError("BRAIN_VAULT_PATH is not a folder.");
  if (existsSync(join(path, MARKER_FILE))) return { created: false };
  if (readdirSync(path).every((entry) => HARMLESS_ENTRIES.has(entry))) {
    writeFileSync(join(path, MARKER_FILE), MARKER_TEXT);
    return { created: true };
  }
  throw new BrainVaultError(
    "BRAIN_VAULT_PATH already holds other files, and brain:export did not make it. Point it at a " +
      "new or empty folder: the export rebuilds part of it on every run.",
  );
}

/** True for a note this command wrote: it starts with the command's own marker. */
export function isGenerated(content: string): boolean {
  return [
    `---\ngenerated_by: "${GENERATED_BY}"\n`,
    `---\r\ngenerated_by: "${GENERATED_BY}"\r\n`,
  ].some((marker) => content.startsWith(marker));
}

const SAFE_PATH = new RegExp(`^${BRAIN_FOLDER}/(?:[A-Za-z0-9 _-]+/)*[A-Za-z0-9 _-]+\\.md$`);

/** Windows can refuse a moment while another program reads a file; then it is tried again. */
function retried(action: () => void) {
  for (let attempt = 0; ; attempt++) {
    try {
      action();
      return;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (attempt >= 5 || !["EBUSY", "EPERM", "EACCES"].includes(code ?? "")) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 * (attempt + 1));
    }
  }
}

/** Every regular .md file under `folder`, vault-relative with forward slashes. Links are not followed. */
function listNotes(vault: string, folder: string): { notes: string[]; folders: string[] } {
  const notes: string[] = [];
  const folders: string[] = [];
  const walk = (relativeFolder: string) => {
    for (const entry of readdirSync(join(vault, relativeFolder), { withFileTypes: true })) {
      const entryPath = `${relativeFolder}/${entry.name}`;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        folders.push(entryPath);
        walk(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        notes.push(entryPath);
      }
    }
  };
  walk(folder);
  return { notes, folders };
}

export type SyncResult = {
  created: number;
  updated: number;
  unchanged: number;
  removed: number;
  /** Notes in the folder the command did not write: kept as they are. */
  kept: number;
  /** Paths it should write but found taken by a note it did not write: left alone. */
  conflicts: string[];
};

/**
 * Makes the vault's ZeroCorps folder hold exactly `files`: writes what is new or changed,
 * deletes its own notes that are no longer wanted (a deleted account's, say), and removes
 * folders that end up empty. The result is what a rebuild from scratch would give.
 */
export function syncBrainFolder(vault: string, files: ReadonlyMap<string, string>): SyncResult {
  for (const path of files.keys()) {
    if (!SAFE_PATH.test(path) || path.split("/").some((part) => part === "." || part === "..")) {
      throw new BrainVaultError(
        "A note's path was not one the export may write. Nothing was written.",
      );
    }
  }
  const root = join(vault, BRAIN_FOLDER);
  if (existsSync(root) && !lstatSync(root).isDirectory()) {
    throw new BrainVaultError(
      `The vault's ${BRAIN_FOLDER} entry is not a plain folder. Nothing was written.`,
    );
  }
  mkdirSync(root, { recursive: true });
  const realRoot = realpathSync.native(root);
  /** True when a folder, or its nearest existing ancestor, really is inside ZeroCorps. */
  const contained = (folder: string) => {
    let existing = folder;
    while (!existsSync(existing)) existing = dirname(existing);
    const between = relative(realRoot, realpathSync.native(existing));
    return !between.startsWith("..") && !isAbsolute(between);
  };
  const result: SyncResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    removed: 0,
    kept: 0,
    conflicts: [],
  };
  const { notes, folders } = listNotes(vault, BRAIN_FOLDER);

  for (const path of notes) {
    if (files.has(path)) continue;
    const full = join(vault, path);
    if (isGenerated(readFileSync(full, "utf8"))) {
      retried(() => unlinkSync(full));
      result.removed++;
    } else {
      result.kept++;
    }
  }

  for (const [path, content] of files) {
    const full = join(vault, path);
    // Never through a link: the note's folder must really be inside ZeroCorps, checked
    // before a folder is made, so nothing is created or written anywhere else.
    if (!contained(dirname(full))) {
      result.conflicts.push(path);
      continue;
    }
    // lstat, not exists: a link in the note's place counts as taken even when it points nowhere.
    const entry = lstatSync(full, { throwIfNoEntry: false });
    if (entry) {
      if (!entry.isFile()) {
        result.conflicts.push(path);
        continue;
      }
      const current = readFileSync(full, "utf8");
      if (current === content) {
        result.unchanged++;
        continue;
      }
      if (!isGenerated(current)) {
        result.conflicts.push(path);
        continue;
      }
      retried(() => writeFileSync(full, content, "utf8"));
      result.updated++;
      continue;
    }
    mkdirSync(dirname(full), { recursive: true });
    // "wx": refuse anything that appeared in the note's place meanwhile.
    retried(() => writeFileSync(full, content, { encoding: "utf8", flag: "wx" }));
    result.created++;
  }

  // Deepest first, so a folder emptied of folders goes too. The root itself stays.
  for (const folder of [...folders].sort((a, b) => b.split("/").length - a.split("/").length)) {
    const full = join(vault, folder);
    if (existsSync(full) && readdirSync(full).length === 0) retried(() => rmdirSync(full));
  }
  return result;
}

/** The largest picture the site stores: its table allows no more. */
export const MAX_PICTURE_BYTES = 128 * 1024;
/** How many pictures are read from the database at a time: at most about 3 MB in memory. */
const PICTURES_PER_READ = 25;
const PICTURE_FILE = /^([A-Za-z0-9_-]{22})\.webp$/;
/** A picture being written; renamed into place once complete. */
const PICTURE_PARTIAL = /^\.([A-Za-z0-9_-]{22})\.webp\.partial$/;

/** A picture's version, exactly as the site computes it (`avatarVersion` in avatars.ts). */
export const pictureVersionOf = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("base64url").slice(0, 22);

/**
 * Creates `path` ("wx": never through anything already there, a link included), writes
 * every byte and flushes it to the disk before returning, so a power cut after the rename
 * cannot leave a damaged file under a picture's name.
 */
function writeFlushed(path: string, bytes: Uint8Array) {
  const descriptor = openSync(path, "wx");
  try {
    let written = 0;
    while (written < bytes.length) {
      written += writeSync(descriptor, bytes, written, bytes.length - written);
    }
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

/** What the site stores is a WebP: "RIFF", the size, then "WEBP". Anything else is not written. */
export function looksLikeWebp(bytes: Uint8Array): boolean {
  const ascii = (from: number, to: number) =>
    Buffer.from(bytes.subarray(from, to)).toString("latin1");
  return (
    bytes.length >= 12 &&
    bytes.length <= MAX_PICTURE_BYTES &&
    ascii(0, 4) === "RIFF" &&
    ascii(8, 12) === "WEBP"
  );
}

export type PictureResult = {
  created: number;
  unchanged: number;
  removed: number;
  /** Files in the pictures folder that this command did not write: kept as they are. */
  kept: number;
  /** Pictures whose place is taken by something this command did not write: left alone. */
  conflicts: number;
  /** Pictures that changed or went while being read, or were not a WebP: the next run. */
  skipped: number;
};

/**
 * Makes the vault's pictures folder hold exactly the pictures `wanted` names (each version,
 * with a member to read it by), the way `syncBrainFolder` does for the notes.
 *
 * A picture's file is named by its version, and its version is a hash of its bytes, so a
 * file proves by itself that the export wrote it: only such a file is ever deleted, and an
 * unchanged picture is never read from the database again. A new picture is written under
 * a temporary name, flushed to the disk and renamed into place, so neither a run that stops
 * halfway nor a power cut leaves a broken file under a picture's name. Never through a
 * link, never outside the folder; something in the way is a conflict, left for the owner.
 */
export async function syncBrainPictures(
  vault: string,
  wanted: ReadonlyMap<string, string>,
  read: (userIds: string[]) => Promise<Map<string, Uint8Array>>,
): Promise<PictureResult> {
  for (const version of wanted.keys()) {
    if (!PICTURE_VERSION.test(version)) {
      throw new BrainVaultError(
        "A picture's name was not one the export may write. No picture was written.",
      );
    }
  }
  const result: PictureResult = {
    created: 0,
    unchanged: 0,
    removed: 0,
    kept: 0,
    conflicts: 0,
    skipped: 0,
  };
  const root = join(vault, BRAIN_FOLDER);
  if (!lstatSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    throw new BrainVaultError(
      `The vault's ${BRAIN_FOLDER} entry is not a plain folder. No picture was written.`,
    );
  }
  const folder = join(vault, PICTURES_FOLDER);
  const entry = lstatSync(folder, { throwIfNoEntry: false });
  if (!entry) {
    if (wanted.size === 0) return result;
    mkdirSync(folder);
  } else if (!entry.isDirectory()) {
    // A link (a Windows junction included) or a file in the folder's place.
    result.conflicts = wanted.size;
    return result;
  }
  const between = relative(realpathSync.native(root), realpathSync.native(folder));
  if (between === "" || between.startsWith("..") || isAbsolute(between)) {
    result.conflicts = wanted.size;
    return result;
  }

  const present = new Set<string>();
  const taken = new Set<string>();
  for (const item of readdirSync(folder, { withFileTypes: true })) {
    // What the operating system leaves in a folder someone opened: neither ours nor the owner's.
    if (HARMLESS_ENTRIES.has(item.name)) continue;
    const full = join(folder, item.name);
    // A write that never finished, under the name only this command uses.
    if (PICTURE_PARTIAL.test(item.name) && item.isFile()) {
      retried(() => unlinkSync(full));
      continue;
    }
    const version = PICTURE_FILE.exec(item.name)?.[1];
    if (version === undefined) {
      result.kept++;
      continue;
    }
    // Ours only if it is a plain file whose bytes hash to its own name.
    if (item.isFile() && pictureVersionOf(readFileSync(full)) === version) {
      if (wanted.has(version)) {
        present.add(version);
        result.unchanged++;
      } else {
        retried(() => unlinkSync(full));
        result.removed++;
      }
    } else if (wanted.has(version)) {
      taken.add(version);
      result.conflicts++;
    } else {
      result.kept++;
    }
  }

  const missing = [...wanted].filter(([version]) => !present.has(version) && !taken.has(version));
  for (let start = 0; start < missing.length; start += PICTURES_PER_READ) {
    const batch = missing.slice(start, start + PICTURES_PER_READ);
    const pictures = await read(batch.map(([, userId]) => userId));
    for (const [version, userId] of batch) {
      const bytes = pictures.get(userId);
      // Gone, or changed since the list of members was read, or not a picture.
      if (!bytes || !looksLikeWebp(bytes) || pictureVersionOf(bytes) !== version) {
        result.skipped++;
        continue;
      }
      const final = join(folder, `${version}.webp`);
      const partial = join(folder, `.${version}.webp.partial`);
      try {
        writeFlushed(partial, bytes);
      } catch (error) {
        const code = (error as { code?: string }).code;
        // A link, a folder or another run's write is in the temporary file's place: nothing
        // was written through it. This picture waits for the next run.
        if (code === "EEXIST" || code === "EISDIR") {
          result.conflicts++;
          continue;
        }
        throw error;
      }
      if (lstatSync(final, { throwIfNoEntry: false })) {
        retried(() => unlinkSync(partial));
        result.conflicts++;
        continue;
      }
      try {
        retried(() => renameSync(partial, final));
        result.created++;
      } catch (error) {
        if ((error as { code?: string }).code !== "ENOENT") {
          try {
            unlinkSync(partial);
          } catch {
            // Gone already; the next run clears it away otherwise.
          }
          throw error;
        }
        // Another run took the temporary file: the picture is in place if its bytes hash to
        // its own name.
        const done = lstatSync(final, { throwIfNoEntry: false });
        if (done?.isFile() && pictureVersionOf(readFileSync(final)) === version) result.unchanged++;
        else result.skipped++;
      }
    }
  }

  if (readdirSync(folder).length === 0) retried(() => rmdirSync(folder));
  return result;
}

/** Our colour groups are the ones whose query names one of our tags. */
const isOurs = (group: unknown) =>
  typeof group === "object" &&
  group !== null &&
  typeof (group as { query?: unknown }).query === "string" &&
  (group as { query: string }).query.startsWith("tag:#zc/");

/**
 * Obsidian's graph settings with our colour groups first and the owner's own kept after
 * them; every other setting is left as Obsidian wrote it. Null text: nothing to write.
 */
export function mergeGraphSettings(
  existing: string | null,
  groups: ColorGroup[],
): { text: string | null; problem?: string } {
  let settings: Record<string, unknown> = {};
  if (existing !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(existing);
    } catch {
      return {
        text: null,
        problem: "Obsidian's graph settings could not be read, so the colours were not set.",
      };
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {
        text: null,
        problem:
          "Obsidian's graph settings were not in the expected shape, so the colours were not set.",
      };
    }
    settings = parsed as Record<string, unknown>;
  }
  const theirs = Array.isArray(settings.colorGroups)
    ? settings.colorGroups.filter((group) => !isOurs(group))
    : [];
  const next = { ...settings, colorGroups: [...groups, ...theirs] };
  if (existing !== null && JSON.stringify(next) === JSON.stringify(settings)) return { text: null };
  return { text: `${JSON.stringify(next, null, 2)}\n` };
}

/** Writes the graph's colour groups into the vault's `.obsidian/graph.json`. */
export function writeGraphSettings(
  vault: string,
  groups: ColorGroup[],
): "written" | "unchanged" | { problem: string } {
  const folder = join(vault, ".obsidian");
  const file = join(folder, "graph.json");
  if (existsSync(folder) && !lstatSync(folder).isDirectory()) {
    return { problem: "The vault's .obsidian entry is not a folder, so the colours were not set." };
  }
  mkdirSync(folder, { recursive: true });
  const current = lstatSync(file, { throwIfNoEntry: false });
  if (current && !current.isFile()) {
    return {
      problem: "Obsidian's graph settings are not a plain file, so the colours were not set.",
    };
  }
  const merged = mergeGraphSettings(current ? readFileSync(file, "utf8") : null, groups);
  if (merged.problem) return { problem: merged.problem };
  if (merged.text === null) return "unchanged";
  const text = merged.text;
  retried(() => writeFileSync(file, text, { encoding: "utf8", flag: current ? "w" : "wx" }));
  return "written";
}
