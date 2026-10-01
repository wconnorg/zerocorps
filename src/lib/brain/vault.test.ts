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
import type { ColorGroup } from "./notes.ts";
import {
  BrainVaultError,
  checkVaultPath,
  isGenerated,
  MARKER_FILE,
  mergeGraphSettings,
  prepareVault,
  syncBrainFolder,
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

describe("the graph's colour groups", () => {
  const ours: ColorGroup[] = [
    { query: "tag:#zc/rank/rookie", color: { a: 1, rgb: 0xff3b47 } },
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
        { query: "tag:#zc/rank/rookie", color: { a: 1, rgb: 1 } },
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
