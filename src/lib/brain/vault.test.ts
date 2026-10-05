import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { avatarVersion } from "../avatars/avatars.ts";
import type { ColorGroup } from "./notes.ts";
import {
  BrainVaultError,
  checkVaultPath,
  isGenerated,
  looksLikeWebp,
  MARKER_FILE,
  MAX_PICTURE_BYTES,
  mergeGraphSettings,
  pictureVersionOf,
  prepareVault,
  syncBrainFolder,
  syncBrainPictures,
  syncedFoldersFrom,
  type VaultContext,
  writeGraphSettings,
} from "./vault.ts";

/**
 * The vault's rules, in throwaway folders: where it may live, what it may take over, and
 * that it only ever deletes or overwrites the notes it wrote itself.
 */

let scratch: string;
let context: VaultContext;

beforeEach(() => {
  scratch = realpathSync.native(mkdtempSync(join(tmpdir(), "zc-brain-")));
  mkdirSync(join(scratch, "repo"));
  mkdirSync(join(scratch, "home"));
  context = {
    repoRoot: join(scratch, "repo"),
    home: join(scratch, "home"),
    syncedFolders: [join(scratch, "home", "OneDrive")],
    caseInsensitive: process.platform === "win32",
  };
});

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true });
});

const note = (body: string) =>
  `---\ngenerated_by: "zerocorps brain:export"\ntype: test\n---\n${body}\n`;
const read = (path: string) => readFileSync(join(scratch, "vault", path), "utf8");

describe("checkVaultPath", () => {
  const problem = (raw: string) => {
    const result = checkVaultPath(raw, context);
    return result.ok ? null : result.problem;
  };

  it("accepts a new folder of its own, and answers its real path", () => {
    expect(checkVaultPath(join(scratch, "home", "ZeroCorps Brain"), context)).toEqual({
      ok: true,
      path: join(scratch, "home", "ZeroCorps Brain"),
    });
  });

  it("refuses a blank, relative or oddly written path", () => {
    expect(problem("")).toMatch(/blank/);
    expect(problem("ZeroCorps Brain")).toMatch(/full path/);
    expect(problem(join(scratch, "it's"))).toMatch(/quotes/);
    expect(problem(join(scratch, "$HOME"))).toMatch(/\$ sign/);
    expect(problem(join(scratch, "a\tb"))).toMatch(/control character/);
    expect(problem(parse(scratch).root)).toMatch(/top of a drive/);
  });

  it("refuses the repository, anything inside it and anything around it", () => {
    expect(problem(join(scratch, "repo"))).toMatch(/inside the repository/);
    expect(problem(join(scratch, "repo", "brain"))).toMatch(/inside the repository/);
    expect(problem(scratch)).toMatch(/contains the repository/);
  });

  it("refuses the home folder and what is above it", () => {
    const elsewhere = { ...context, repoRoot: join(scratch, "elsewhere", "repo") };
    expect(checkVaultPath(join(scratch, "home"), elsewhere)).toMatchObject({
      ok: false,
      problem: expect.stringMatching(/home folder/),
    });
  });

  it("refuses a folder a sync service uploads", () => {
    expect(problem(join(scratch, "home", "OneDrive", "Brain"))).toMatch(/sync service/);
    expect(problem(join(scratch, "home", "Dropbox", "Brain"))).toMatch(/sync service/);
    expect(problem(join(scratch, "home", "OneDrive - Contoso", "Brain"))).toMatch(/sync service/);
    expect(
      syncedFoldersFrom({ OneDrive: "C:\\Users\\a\\OneDrive", OneDriveCommercial: "", Path: "x" }),
    ).toEqual(["C:\\Users\\a\\OneDrive"]);
  });

  it("follows a link to where it really points before deciding", () => {
    symlinkSync(join(scratch, "repo"), join(scratch, "home", "link"), "junction");
    expect(problem(join(scratch, "home", "link", "brain"))).toMatch(/inside the repository/);
  });

  it.runIf(process.platform === "win32")("compares paths without regard to case on Windows", () => {
    expect(problem(join(scratch, "REPO", "brain"))).toMatch(/inside the repository/);
  });
});

describe("prepareVault", () => {
  const vault = () => join(scratch, "vault");

  it("makes a new folder and marks it as the export's", () => {
    expect(prepareVault(vault())).toEqual({ created: true });
    expect(readdirSync(vault())).toEqual([MARKER_FILE]);
    expect(prepareVault(vault())).toEqual({ created: false });
  });

  it("takes an empty folder, or one Obsidian has only just opened", () => {
    mkdirSync(join(vault(), ".obsidian"), { recursive: true });
    expect(prepareVault(vault())).toEqual({ created: true });
    expect(existsSync(join(vault(), MARKER_FILE))).toBe(true);
  });

  it("refuses a folder that already holds other files, and anything that is not a folder", () => {
    mkdirSync(vault());
    writeFileSync(join(vault(), "My notes.md"), "mine");
    expect(() => prepareVault(vault())).toThrow(BrainVaultError);
    expect(readdirSync(vault())).toEqual(["My notes.md"]);
    writeFileSync(join(scratch, "a-file"), "x");
    expect(() => prepareVault(join(scratch, "a-file"))).toThrow(/not a folder/);
  });
});

describe("syncBrainFolder", () => {
  const vault = () => join(scratch, "vault");
  const files = (entries: Record<string, string>) => new Map(Object.entries(entries));
  beforeEach(() => {
    prepareVault(vault());
  });

  it("writes what is new, skips what is unchanged, rewrites what changed", () => {
    const first = files({
      "ZeroCorps/Members/a.md": note("a"),
      "ZeroCorps/ZeroCorps Brain.md": note("hub"),
    });
    expect(syncBrainFolder(vault(), first)).toMatchObject({ created: 2, updated: 0, unchanged: 0 });
    expect(syncBrainFolder(vault(), first)).toMatchObject({ created: 0, updated: 0, unchanged: 2 });
    const second = files({
      "ZeroCorps/Members/a.md": note("a, changed"),
      "ZeroCorps/ZeroCorps Brain.md": note("hub"),
    });
    expect(syncBrainFolder(vault(), second)).toMatchObject({ updated: 1, unchanged: 1 });
    expect(read("ZeroCorps/Members/a.md")).toBe(note("a, changed"));
  });

  it("deletes its own notes that are no longer wanted, and the folders they leave empty", () => {
    syncBrainFolder(
      vault(),
      files({
        "ZeroCorps/Members/gone.md": note("gone"),
        "ZeroCorps/Leaderboard.md": note("board"),
      }),
    );
    const result = syncBrainFolder(vault(), files({ "ZeroCorps/Leaderboard.md": note("board") }));
    expect(result.removed).toBe(1);
    expect(existsSync(join(vault(), "ZeroCorps", "Members"))).toBe(false);
    expect(existsSync(join(vault(), "ZeroCorps", "Leaderboard.md"))).toBe(true);
  });

  it("never deletes or overwrites a note it did not write", () => {
    mkdirSync(join(vault(), "ZeroCorps", "Members"), { recursive: true });
    writeFileSync(join(vault(), "ZeroCorps", "Members", "my own.md"), "my notes about someone");
    writeFileSync(join(vault(), "ZeroCorps", "Members", "taken.md"), "also mine");
    const result = syncBrainFolder(vault(), files({ "ZeroCorps/Members/taken.md": note("ours") }));
    expect(result).toMatchObject({
      kept: 1,
      conflicts: ["ZeroCorps/Members/taken.md"],
      created: 0,
    });
    expect(read("ZeroCorps/Members/my own.md")).toBe("my notes about someone");
    expect(read("ZeroCorps/Members/taken.md")).toBe("also mine");
  });

  it("still knows its own note after an editor changed its line endings", () => {
    syncBrainFolder(vault(), files({ "ZeroCorps/Members/a.md": note("a") }));
    writeFileSync(join(vault(), "ZeroCorps", "Members", "a.md"), note("a").replace(/\n/g, "\r\n"));
    expect(isGenerated(read("ZeroCorps/Members/a.md"))).toBe(true);
    expect(syncBrainFolder(vault(), files({}))).toMatchObject({ removed: 1 });
  });

  it("refuses a path outside its folder before writing anything", () => {
    for (const path of [
      "ZeroCorps/../escape.md",
      "Elsewhere/x.md",
      "ZeroCorps/x.txt",
      "ZeroCorps/.hidden/x.md",
    ]) {
      expect(
        () => syncBrainFolder(vault(), files({ [path]: note("x"), "ZeroCorps/ok.md": note("ok") })),
        path,
      ).toThrow(BrainVaultError);
    }
    expect(existsSync(join(vault(), "ZeroCorps", "ok.md"))).toBe(false);
  });

  it("never follows a link out of its folder, to write, to overwrite, to make or to delete", () => {
    const outside = join(scratch, "outside");
    mkdirSync(outside);
    // Even a file that looks exactly like one of the brain's own notes.
    writeFileSync(join(outside, "precious.md"), note("not the brain's"));
    mkdirSync(join(vault(), "ZeroCorps"), { recursive: true });
    symlinkSync(outside, join(vault(), "ZeroCorps", "Members"), "junction");
    const result = syncBrainFolder(
      vault(),
      files({
        "ZeroCorps/Members/a.md": note("a"),
        "ZeroCorps/Members/precious.md": note("overwritten"),
        "ZeroCorps/Members/Sub/b.md": note("b"),
      }),
    );
    expect(result.conflicts.sort()).toEqual([
      "ZeroCorps/Members/Sub/b.md",
      "ZeroCorps/Members/a.md",
      "ZeroCorps/Members/precious.md",
    ]);
    expect(readdirSync(outside)).toEqual(["precious.md"]);
    expect(readFileSync(join(outside, "precious.md"), "utf8")).toBe(note("not the brain's"));
  });
});

describe("syncBrainPictures", () => {
  const vault = () => join(scratch, "vault");
  const pictures = () => join(vault(), "ZeroCorps", "Pictures");
  /** A small file with a WebP's header, different for each seed. */
  const webp = (seed: string) => {
    const payload = Buffer.from(`VP8 ${seed}`, "latin1");
    const header = Buffer.alloc(12);
    header.write("RIFF", 0, "latin1");
    header.writeUInt32LE(payload.length + 4, 4);
    header.write("WEBP", 8, "latin1");
    return Buffer.concat([header, payload]);
  };
  const a = webp("a");
  const b = webp("b");
  const va = pictureVersionOf(a);
  const vb = pictureVersionOf(b);
  /** The database, as far as the pictures go, and every list of members read from it. */
  let stored: Map<string, Uint8Array>;
  let asked: string[][];
  const read = async (userIds: string[]) => {
    asked.push(userIds);
    return new Map(
      userIds.flatMap((id) => {
        const bytes = stored.get(id);
        return bytes ? [[id, bytes] as const] : [];
      }),
    );
  };
  beforeEach(() => {
    prepareVault(vault());
    mkdirSync(join(vault(), "ZeroCorps"));
    stored = new Map([
      ["u-a", a],
      ["u-b", b],
    ]);
    asked = [];
  });

  it("names a picture exactly as the site does, and knows a WebP", () => {
    expect(pictureVersionOf(a)).toBe(avatarVersion(a));
    expect(looksLikeWebp(a)).toBe(true);
    expect(looksLikeWebp(Buffer.from("GIF89a, not a WebP", "latin1"))).toBe(false);
    expect(looksLikeWebp(Buffer.concat([a, Buffer.alloc(MAX_PICTURE_BYTES)]))).toBe(false);
  });

  it("writes each picture under its own hash, and reads only the ones it lacks", async () => {
    const wanted = new Map([
      [va, "u-a"],
      [vb, "u-b"],
    ]);
    expect(await syncBrainPictures(vault(), wanted, read)).toMatchObject({
      created: 2,
      unchanged: 0,
    });
    expect(readFileSync(join(pictures(), `${va}.webp`))).toEqual(a);
    expect(asked).toEqual([["u-a", "u-b"]]);
    expect(await syncBrainPictures(vault(), wanted, read)).toMatchObject({
      created: 0,
      unchanged: 2,
    });
    expect(asked).toHaveLength(1);
  });

  it("deletes its own pictures that are no longer wanted, and the folder once empty", async () => {
    await syncBrainPictures(
      vault(),
      new Map([
        [va, "u-a"],
        [vb, "u-b"],
      ]),
      read,
    );
    expect(await syncBrainPictures(vault(), new Map([[vb, "u-b"]]), read)).toMatchObject({
      removed: 1,
      unchanged: 1,
    });
    expect(await syncBrainPictures(vault(), new Map(), read)).toMatchObject({ removed: 1 });
    expect(existsSync(pictures())).toBe(false);
  });

  it("never deletes or overwrites a file it did not write", async () => {
    mkdirSync(pictures());
    writeFileSync(join(pictures(), "holiday.webp"), "mine");
    // A file under a picture's very name, but not that picture's bytes.
    writeFileSync(join(pictures(), `${va}.webp`), webp("mine"));
    expect(await syncBrainPictures(vault(), new Map([[va, "u-a"]]), read)).toMatchObject({
      conflicts: 1,
      kept: 1,
      created: 0,
    });
    expect(asked).toEqual([]);
    expect(await syncBrainPictures(vault(), new Map(), read)).toMatchObject({
      removed: 0,
      kept: 2,
    });
    expect(readFileSync(join(pictures(), `${va}.webp`))).toEqual(webp("mine"));
    expect(readFileSync(join(pictures(), "holiday.webp"), "utf8")).toBe("mine");
  });

  it("skips a picture that changed or went while being read, or is not a WebP", async () => {
    const gif = Buffer.from("GIF89a, not a WebP", "latin1");
    stored = new Map([
      ["u-a", b],
      ["u-gif", gif],
    ]);
    const result = await syncBrainPictures(
      vault(),
      new Map([
        [va, "u-a"],
        [vb, "u-gone"],
        [pictureVersionOf(gif), "u-gif"],
      ]),
      read,
    );
    expect(result).toMatchObject({ created: 0, skipped: 3 });
    expect(existsSync(pictures())).toBe(false);
  });

  it("refuses a picture name that is not a version before writing anything", async () => {
    await expect(
      syncBrainPictures(vault(), new Map([["../../escape", "u-a"]]), read),
    ).rejects.toThrow(BrainVaultError);
    expect(existsSync(pictures())).toBe(false);
    expect(asked).toEqual([]);
  });

  it("never follows a link out of its folder", async () => {
    const outside = join(scratch, "outside");
    mkdirSync(outside);
    // Even a file that is exactly one of its own pictures.
    writeFileSync(join(outside, `${vb}.webp`), b);
    symlinkSync(outside, pictures(), "junction");
    expect(await syncBrainPictures(vault(), new Map([[va, "u-a"]]), read)).toMatchObject({
      conflicts: 1,
      created: 0,
      removed: 0,
    });
    expect(readdirSync(outside)).toEqual([`${vb}.webp`]);
    expect(asked).toEqual([]);
  });

  it("clears away a write that never finished", async () => {
    mkdirSync(pictures());
    writeFileSync(join(pictures(), `.${va}.webp.partial`), "half");
    expect(await syncBrainPictures(vault(), new Map([[va, "u-a"]]), read)).toMatchObject({
      created: 1,
    });
    expect(readdirSync(pictures())).toEqual([`${va}.webp`]);
  });

  it("leaves a link in a picture's or a temporary file's place alone, and carries on", async () => {
    const outside = join(scratch, "outside");
    mkdirSync(outside);
    mkdirSync(pictures());
    symlinkSync(outside, join(pictures(), `${va}.webp`), "junction");
    symlinkSync(outside, join(pictures(), `.${vb}.webp.partial`), "junction");
    const result = await syncBrainPictures(
      vault(),
      new Map([
        [va, "u-a"],
        [vb, "u-b"],
      ]),
      read,
    );
    expect(result).toMatchObject({ conflicts: 2, created: 0, removed: 0 });
    expect(readdirSync(outside)).toEqual([]);
  });

  it("does not count what the operating system leaves in the folder as the owner's", async () => {
    mkdirSync(pictures());
    writeFileSync(join(pictures(), "desktop.ini"), "[.ShellClassInfo]");
    writeFileSync(join(pictures(), "Thumbs.db"), "x");
    expect(await syncBrainPictures(vault(), new Map(), read)).toMatchObject({
      kept: 0,
      removed: 0,
    });
    expect(readFileSync(join(pictures(), "desktop.ini"), "utf8")).toBe("[.ShellClassInfo]");
  });
});

describe("the graph's colour groups", () => {
  const ours: ColorGroup[] = [
    { query: "tag:#zc/rank/bronze", color: { a: 1, rgb: 0xff3b47 } },
    { query: "tag:#zc/lesson", color: { a: 1, rgb: 0x4da3ff } },
  ];

  it("start a new settings file with just the colours", () => {
    expect(JSON.parse(mergeGraphSettings(null, ours).text ?? "")).toEqual({ colorGroups: ours });
  });

  it("keep every other setting and the owner's own groups, ours first", () => {
    const existing = JSON.stringify({
      showTags: true,
      scale: 1.2,
      colorGroups: [
        { query: "tag:#zc/rank/bronze", color: { a: 1, rgb: 1 } },
        { query: "path:Daily", color: { a: 1, rgb: 2 } },
      ],
    });
    const merged = JSON.parse(mergeGraphSettings(existing, ours).text ?? "");
    expect(merged).toEqual({
      showTags: true,
      scale: 1.2,
      colorGroups: [...ours, { query: "path:Daily", color: { a: 1, rgb: 2 } }],
    });
    // Run again: nothing to write.
    expect(mergeGraphSettings(JSON.stringify(merged), ours)).toEqual({ text: null });
  });

  it("leave a settings file they cannot read alone", () => {
    expect(mergeGraphSettings("{not json", ours)).toMatchObject({
      text: null,
      problem: expect.any(String),
    });
    expect(mergeGraphSettings("[1, 2]", ours)).toMatchObject({
      text: null,
      problem: expect.any(String),
    });
  });

  it("are written into the vault's .obsidian folder", () => {
    const vault = join(scratch, "vault");
    prepareVault(vault);
    expect(writeGraphSettings(vault, ours)).toBe("written");
    expect(writeGraphSettings(vault, ours)).toBe("unchanged");
    expect(JSON.parse(readFileSync(join(vault, ".obsidian", "graph.json"), "utf8"))).toEqual({
      colorGroups: ours,
    });
  });
});

describe("review fixes", () => {
  it("refuses a folder inside the repository whose name starts with two dots", () => {
    const result = checkVaultPath(join(scratch, "repo", "..brain"), context);
    expect(result).toMatchObject({
      ok: false,
      problem: expect.stringMatching(/inside the repository/),
    });
  });

  it("never writes through a link that points nowhere yet", () => {
    const vault = join(scratch, "vault");
    prepareVault(vault);
    mkdirSync(join(vault, "ZeroCorps", "Members"), { recursive: true });
    const target = join(scratch, "outside-new.md");
    try {
      symlinkSync(target, join(vault, "ZeroCorps", "Members", "a.md"), "file");
    } catch {
      return; // Windows without the right to make file links: nothing to prove here.
    }
    const result = syncBrainFolder(vault, new Map([["ZeroCorps/Members/a.md", note("a")]]));
    expect(result.conflicts).toEqual(["ZeroCorps/Members/a.md"]);
    expect(existsSync(target)).toBe(false);
  });
});
