import { parseEnv } from "node:util";
import { describe, expect, it } from "vitest";
import { setEnvValues, singleQuoted } from "./env-lines.ts";

describe("setEnvValues", () => {
  it("adds a new key at the end and keeps every other line, comments included", () => {
    const text = "# the laptop\nDATABASE_URL=postgres://fixture\n\nAPP_ENV=local\n";
    expect(setEnvValues(text, { BRAIN_VAULT_PATH: "'C:\\Brain'" })).toBe(
      "# the laptop\nDATABASE_URL=postgres://fixture\n\nAPP_ENV=local\nBRAIN_VAULT_PATH='C:\\Brain'\n",
    );
  });

  it("replaces a key where it stands, removes later copies, and leaves look-alikes alone", () => {
    const text = "DATABASE_URL=old\nDATABASE_URL_MIGRATIONS=keep\nDATABASE_URL=older\n";
    expect(setEnvValues(text, { DATABASE_URL: "new" })).toBe(
      "DATABASE_URL=new\nDATABASE_URL_MIGRATIONS=keep\n",
    );
  });

  it("keeps Windows line endings", () => {
    expect(setEnvValues("A=1\r\nB=2\r\n", { B: "3" })).toBe("A=1\r\nB=3\r\n");
  });

  it("refuses a bad name or a value with a line break", () => {
    expect(() => setEnvValues("", { "bad-name": "x" })).toThrow();
    expect(() => setEnvValues("", { GOOD: "a\nINJECTED=1" })).toThrow();
  });
});

describe("singleQuoted", () => {
  it("is read back exactly, backslashes and spaces included", () => {
    const path = "C:\\Users\\someone\\ZeroCorps Brain\\new";
    expect(parseEnv(`BRAIN_VAULT_PATH=${singleQuoted(path)}`).BRAIN_VAULT_PATH).toBe(path);
  });

  it("refuses what single quotes cannot hold", () => {
    expect(() => singleQuoted("it's")).toThrow();
    expect(() => singleQuoted("a\nb")).toThrow();
  });
});
