import { describe, expect, it } from "vitest";
import {
  checkUsername,
  isReserved,
  normalizeUsername,
  RESERVED_USERNAMES,
  USERNAME_MAX,
  USERNAME_MIN,
  USERNAME_SHAPE,
} from "./username.ts";

/**
 * The username rules, tested against the ways people try to get around them, not only
 * against names that were always going to work.
 */

const accepted = (input: string) => {
  const result = checkUsername(input);
  if (!result.ok) throw new Error(`"${input}" was refused: ${result.problem}`);
  return result.username;
};
const problemWith = (input: string) => {
  const result = checkUsername(input);
  return result.ok ? null : result.problem;
};

describe("a username's shape", () => {
  it("accepts an ordinary name, and stores it trimmed and lower-cased", () => {
    expect(accepted("trader")).toBe("trader");
    expect(accepted("  Trader_99  ")).toBe("trader_99");
    expect(accepted("ZERO_ONE")).toBe("zero_one");
    expect(normalizeUsername("  MiXeD  ")).toBe("mixed");
  });

  it("holds the length limits exactly", () => {
    expect(problemWith("ab")).toBe("too-short");
    expect(accepted("abc")).toBe("abc");
    expect(accepted("a".repeat(USERNAME_MAX))).toHaveLength(USERNAME_MAX);
    expect(problemWith("a".repeat(USERNAME_MAX + 1))).toBe("too-long");
    // Whitespace is trimmed BEFORE the length is judged, so padding does not buy length.
    expect(problemWith("  ab  ")).toBe("too-short");
    expect(accepted(`  ${"a".repeat(USERNAME_MAX)}  `)).toHaveLength(USERNAME_MAX);
    // Nothing throws on absurd input.
    expect(problemWith("a".repeat(100_000))).toBe("too-long");
  });

  it("refuses everything outside a-z, 0-9 and _", () => {
    for (const bad of [
      "has space",
      "has-dash",
      "has.dot",
      "has@at",
      "has/slash",
      "has\\backslash",
      "has:colon",
      "has#hash",
      "has%percent",
      "has'quote",
      'has"quote',
      "has<tag>",
      "emoji🙂here",
      "trader\u200bzero", // a zero-width space hiding between letters
      "trader\u00a0zero", // a non-breaking space, which looks like a plain one
      "trader\nzero",
      "trader\tzero",
      "trader\0zero",
    ]) {
      expect(problemWith(bad), bad).toBe("bad-characters");
    }
  });

  it("refuses letters that only LOOK like ours, so no name can impersonate another", () => {
    // Each of these reads as "admin" or "zero" to the eye and is not, in Unicode.
    for (const lookalike of [
      "аdmin", // Cyrillic а
      "adмin", // Cyrillic м
      "аdмin",
      "zеro", // Cyrillic е
      "ｚｅｒｏ", // full-width Latin
      "𝗮𝗱𝗺𝗶𝗻", // mathematical bold
      "adımin", // dotless i
    ]) {
      expect(problemWith(lookalike), lookalike).toBe("bad-characters");
    }
  });

  it("refuses a name that would read as blank", () => {
    for (const blank of ["___", "____________________", "_".repeat(USERNAME_MIN)]) {
      expect(problemWith(blank), blank).toBe("no-letter-or-digit");
    }
    expect(accepted("_a_")).toBe("_a_");
    expect(accepted("_1_")).toBe("_1_");
  });

  it("refuses nothing at all", () => {
    expect(problemWith("")).toBe("too-short");
    expect(problemWith("   ")).toBe("too-short");
  });
});

describe("reserved names", () => {
  it("refuses the brand, the people who run it and the site's own words", () => {
    for (const name of ["zerocorps", "admin", "support", "api", "dashboard", "settings", "bot"]) {
      expect(problemWith(name), name).toBe("reserved");
    }
  });

  it("carries no word that is too short to be a name anyway", () => {
    // "me" was in the list until this test found it: no name may be two letters, so
    // reserving it protected nothing and only hid the fact.
    for (const word of RESERVED_USERNAMES) {
      expect(word.length, word).toBeGreaterThanOrEqual(USERNAME_MIN);
      expect(word.length, word).toBeLessThanOrEqual(USERNAME_MAX);
    }
  });

  it("refuses them however they are dressed up", () => {
    for (const dressed of [
      "ADMIN",
      "  Admin  ",
      "a_d_m_i_n",
      "admin_",
      "_admin",
      "__admin__",
      "z_e_r_o_c_o_r_p_s",
      "zero_corps",
      "ZeroCorps",
    ]) {
      expect(problemWith(dressed), dressed).toBe("reserved");
    }
  });

  it("does not refuse an ordinary name that merely contains a reserved word", () => {
    // Blocking every name CONTAINING "mod" or "test" would take names people should have.
    for (const fine of ["moderna", "testament", "zeroed", "administrate_me", "my_api_notes"]) {
      expect(problemWith(fine), fine).toBeNull();
    }
  });

  it("every reserved word is itself a name that would otherwise be allowed", () => {
    // A reserved word that could never be typed anyway is dead weight and hides a mistake.
    for (const word of RESERVED_USERNAMES) {
      expect(USERNAME_SHAPE.test(word), word).toBe(true);
      expect(isReserved(word), word).toBe(true);
    }
    expect(RESERVED_USERNAMES.size).toBeGreaterThan(30);
  });
});

describe("the shape everything else must agree with", () => {
  it("is the same rule the pattern and the checker apply", () => {
    for (const name of ["abc", "a_1", "trader_99", "a".repeat(USERNAME_MAX), "___a"]) {
      expect(USERNAME_SHAPE.test(name), name).toBe(true);
    }
    for (const name of ["ab", "a".repeat(USERNAME_MAX + 1), "Trader", "a b", "a-b"]) {
      expect(USERNAME_SHAPE.test(name), name).toBe(false);
    }
  });

  it("is anchored at both ends, so nothing can be smuggled around it", () => {
    for (const smuggled of ["trader\nadmin", "\ntrader", "trader\n"]) {
      expect(USERNAME_SHAPE.test(smuggled), smuggled).toBe(false);
    }
  });

  it("says the same thing as the checker for every accepted name", () => {
    for (const name of ["abc", "trader_99", "___a", "a".repeat(USERNAME_MAX)]) {
      expect(checkUsername(name).ok, name).toBe(USERNAME_SHAPE.test(name) && !isReserved(name));
    }
  });
});
