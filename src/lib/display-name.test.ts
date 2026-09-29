import { describe, expect, it } from "vitest";
import { checkDisplayName, DISPLAY_NAME_MAX, normalizeDisplayName } from "./display-name.ts";

const accepted = (input: string) => {
  const result = checkDisplayName(input);
  if (!result.ok) throw new Error(`"${input}" was refused: ${result.problem}`);
  return result.displayName;
};
const problemWith = (input: string) => {
  const result = checkDisplayName(input);
  return result.ok ? null : result.problem;
};

describe("a display name", () => {
  it("is optional, and keeps real names from anywhere", () => {
    expect(accepted("")).toBe("");
    expect(accepted("Jane Doe")).toBe("Jane Doe");
    expect(accepted("Zoë O'Neil")).toBe("Zoë O'Neil");
    expect(accepted("Ólafur Þór")).toBe("Ólafur Þór");
    expect(accepted("山田 太郎")).toBe("山田 太郎");
    expect(accepted("Ахмед")).toBe("Ахмед");
    expect(accepted("محمد")).toBe("محمد");
    expect(accepted("J.B. 🙂")).toBe("J.B. 🙂");
  });

  it("tidies spacing, so one name cannot be worn twice", () => {
    expect(accepted("  Jane   Doe  ")).toBe("Jane Doe");
    expect(normalizeDisplayName("a  b")).toBe("a b");
    expect(accepted(" ")).toBe("");
  });

  it("counts characters as a person would, not as bytes", () => {
    // Emoji and accented letters are one character each, whatever they cost to store.
    expect(accepted("🙂".repeat(DISPLAY_NAME_MAX))).toHaveLength(
      "🙂".repeat(DISPLAY_NAME_MAX).length,
    );
    expect(problemWith("🙂".repeat(DISPLAY_NAME_MAX + 1))).toBe("too-long");
    expect(problemWith("a".repeat(DISPLAY_NAME_MAX + 1))).toBe("too-long");
    expect(accepted("a".repeat(DISPLAY_NAME_MAX))).toHaveLength(DISPLAY_NAME_MAX);
    // Spacing is tidied BEFORE the length is judged, so padding does not fail a good name.
    expect(accepted(`   ${"a".repeat(DISPLAY_NAME_MAX)}   `)).toHaveLength(DISPLAY_NAME_MAX);
  });

  it("refuses characters that reverse how a name is drawn", () => {
    // Each of these can make what is stored read as something else on the screen.
    for (const trick of [
      "\u202eadmin",
      "nimda\u202e",
      "Jane\u202dDoe",
      "\u2066Jane\u2069\u2067admin\u2069",
      "\u202aJane",
    ]) {
      expect(problemWith(trick), JSON.stringify(trick)).toBe("hidden-characters");
    }
  });

  it("refuses characters that take up no room, so two names cannot look alike", () => {
    for (const trick of [
      "Jane\u200bDoe",
      "Jane\u200cDoe",
      "Jane\u2060Doe",
      "Jane\ufeffDoe",
      "Jane\u00adDoe",
      "\u200bJaneDoe",
    ]) {
      expect(problemWith(trick), JSON.stringify(trick)).toBe("hidden-characters");
    }
  });

  it("refuses control characters and anything that breaks a line", () => {
    for (const trick of ["Jane\nDoe", "Jane\rDoe", "Jane\tDoe", "Jane\0Doe", "Jane\u0085Doe"]) {
      expect(problemWith(trick), JSON.stringify(trick)).toBe("hidden-characters");
    }
  });

  it("refuses a hidden character even when trimming would have removed it", () => {
    // The check runs on what was typed, not on what is left after tidying.
    expect(problemWith("\u200b")).toBe("hidden-characters");
    expect(problemWith("Jane\u200b")).toBe("hidden-characters");
  });
});
