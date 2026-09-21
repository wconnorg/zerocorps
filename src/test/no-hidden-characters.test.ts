import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No source file may contain a character that cannot be seen.
 *
 * Two of them are dangerous in code, not merely untidy:
 *
 * - a **direction override** (U+202A..U+202E, U+2066..U+2069) reverses how the rest of a
 *   line is drawn, so a reviewer can be shown one thing while the computer runs another.
 *   That is the "Trojan Source" trick, and it is exactly how a harmless-looking change
 *   hides a harmful one;
 * - a **zero-width character** can sit inside a name or a string and make two different
 *   pieces of code look identical.
 *
 * This repository is public, so a change is read by people who did not write it, and what
 * they read must be what runs. Escapes such as `\u200b` are fine and are what the display
 * name rules use: the character is then plain to see in the source.
 *
 * This is easy to do by accident. It happened on 2026-09-21: the tests for those very
 * rules were written with real invisible characters instead of escapes.
 */

const RISKY = [
  { from: 0x200b, to: 0x200f, what: "zero-width or direction mark" },
  { from: 0x202a, to: 0x202e, what: "direction override" },
  { from: 0x2060, to: 0x2064, what: "invisible operator" },
  { from: 0x2066, to: 0x2069, what: "direction isolate" },
  { from: 0x00ad, to: 0x00ad, what: "soft hyphen" },
  { from: 0x061c, to: 0x061c, what: "Arabic letter mark" },
  { from: 0x180e, to: 0x180e, what: "Mongolian vowel separator" },
  { from: 0xfeff, to: 0xfeff, what: "byte-order mark" },
];

const describeCharacter = (code: number) =>
  RISKY.find((range) => code >= range.from && code <= range.to)?.what ?? "invisible character";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(path);
    return /\.(ts|tsx|mts|mjs|js|css|json)$/.test(entry.name) ? [path] : [];
  });
}

describe("hidden characters in the source", () => {
  const files = [...sourceFiles("src"), ...sourceFiles("scripts")];

  it("finds the files to look at", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it("no file contains one, so what a reviewer reads is what runs", () => {
    const found: string[] = [];
    for (const path of files) {
      const text = readFileSync(path, "utf8");
      let line = 1;
      for (const character of text) {
        if (character === "\n") {
          line += 1;
          continue;
        }
        const code = character.codePointAt(0)!;
        if (RISKY.some((range) => code >= range.from && code <= range.to)) {
          const hex = code.toString(16).toUpperCase().padStart(4, "0");
          found.push(
            `${path.replace(/\\/g, "/")}:${line} has U+${hex} (${describeCharacter(code)}). ` +
              `Write it as an escape instead.`,
          );
        }
      }
    }
    expect(found).toEqual([]);
  });

  it("would catch one if it were there", () => {
    // Proof the check works: the same scan over text that does contain them.
    const planted = `const a = "admin\u202e";\nconst b = "Jane\u200bDoe";\n`;
    const hits = [...planted].filter((character) => {
      const code = character.codePointAt(0)!;
      return RISKY.some((range) => code >= range.from && code <= range.to);
    });
    expect(hits).toHaveLength(2);
    expect(describeCharacter(0x202e)).toBe("direction override");
    expect(describeCharacter(0x200b)).toBe("zero-width or direction mark");
  });
});
