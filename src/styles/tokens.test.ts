import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guards the colour tokens in `src/app/globals.css`. Swap the accent or retune
 * a theme freely; this fails if a text/background pair stops being readable or
 * if one theme gains a token the other lacks.
 */

const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");

function tokensFor(theme: "dark" | "light"): Record<string, string> {
  const block = new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1];
  if (!block) throw new Error(`No [data-theme="${theme}"] block found in globals.css`);
  const tokens: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[match[1]!] = match[2]!;
  }
  return tokens;
}

function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(value >> 16) +
    0.7152 * channel((value >> 8) & 255) +
    0.0722 * channel(value & 255)
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const THEMES = ["dark", "light"] as const;
const BACKGROUNDS = ["bg", "surface", "raised"];
const TEXT = ["fg", "muted", "subtle", "accent"];
const STATUS = ["danger", "success", "warning"];
const HEAT = ["heat-0", "heat-1", "heat-2", "heat-3", "heat-4"];
const AA = 4.5;

describe("theme tokens", () => {
  it("defines the same tokens in both themes", () => {
    expect(Object.keys(tokensFor("light")).sort()).toEqual(Object.keys(tokensFor("dark")).sort());
  });

  it.each(THEMES)("%s: every token used for text meets WCAG AA on every background", (theme) => {
    const tokens = tokensFor(theme);
    const failures: string[] = [];
    for (const text of TEXT) {
      for (const background of BACKGROUNDS) {
        const ratio = contrast(tokens[text]!, tokens[background]!);
        if (ratio < AA) failures.push(`${text} on ${background}: ${ratio.toFixed(2)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it.each(THEMES)("%s: status colours are readable on the page and on cards", (theme) => {
    const tokens = tokensFor(theme);
    for (const status of STATUS) {
      expect(contrast(tokens[status]!, tokens.bg!)).toBeGreaterThanOrEqual(AA);
      expect(contrast(tokens[status]!, tokens.surface!)).toBeGreaterThanOrEqual(AA);
    }
  });

  it.each(THEMES)("%s: text on the accent (primary buttons) meets WCAG AA", (theme) => {
    const tokens = tokensFor(theme);
    expect(contrast(tokens["accent-fg"]!, tokens.accent!)).toBeGreaterThanOrEqual(AA);
  });

  it("the activity ramp gets steadily brighter on dark and darker on light", () => {
    const dark = HEAT.map((name) => luminance(tokensFor("dark")[name]!));
    const light = HEAT.map((name) => luminance(tokensFor("light")[name]!));
    for (let i = 1; i < HEAT.length; i++) {
      expect(dark[i]!).toBeGreaterThan(dark[i - 1]!);
      expect(light[i]!).toBeLessThan(light[i - 1]!);
    }
  });

  it.each(THEMES)("%s: the first active step stands apart from an empty cell", (theme) => {
    const tokens = tokensFor(theme);
    expect(contrast(tokens["heat-1"]!, tokens["heat-0"]!)).toBeGreaterThanOrEqual(1.25);
  });
});
