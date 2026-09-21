import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * There is one real database, shared by the laptop and the live site. A test must
 * never be able to reach it. These checks fail the build if that ever becomes possible.
 */

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|mts)$/.test(entry.name) ? [path] : [];
  });
}

const testFiles = sourceFiles("src").filter(
  (path) => /\.test\.tsx?$/.test(path) || path.split(/[\\/]/).includes("test"),
);

describe("tests and the real database", () => {
  it("runs with unreachable database URLs, whatever .env.local says", () => {
    expect(process.env.DATABASE_URL).toMatch(/\.invalid:/);
    expect(process.env.DATABASE_URL_MIGRATIONS).toMatch(/\.invalid:/);
  });

  it("never imports the real database client, the postgres driver or the real environment", () => {
    expect(testFiles.length).toBeGreaterThan(5);
    const forbidden = [
      /from\s+["']postgres["']/,
      /from\s+["']drizzle-orm\/postgres-js/,
      /from\s+["'](@\/|(\.\.?\/)+)env(\.ts)?["']/,
      /from\s+["'](@\/|(\.\.?\/)+)(db\/)?client(\.ts)?["']/,
      /from\s+["'](@\/|(\.\.?\/)+)(lib\/)?auth(\/index)?(\.ts)?["']/,
    ];
    const offenders = testFiles
      .filter((path) => !path.endsWith("no-real-database.test.ts"))
      .filter((path) => forbidden.some((pattern) => pattern.test(readFileSync(path, "utf8"))));
    expect(offenders).toEqual([]);
  });
});
