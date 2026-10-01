import { describe, expect, it } from "vitest";
import { codeSpan, fileBase, plainTitle, wikilink, yamlOptional, yamlString } from "./markdown.ts";

describe("yamlString", () => {
  it("is a JSON string, so a value can never leave its line or its quotes", () => {
    for (const value of [
      "plain",
      'with "quotes" and \\ backslash',
      "x\n---\ninjected: true",
      "tab\there",
    ]) {
      const written = yamlString(value);
      expect(written).not.toContain("\n");
      expect(JSON.parse(written)).toBe(value);
    }
  });

  it("escapes what YAML refuses raw or reads as a line break", () => {
    expect(yamlString("a\u2028b\u2029c\u0085d\u007fe\ufeff")).toBe(
      '"a\\u2028b\\u2029c\\u0085d\\u007fe\\ufeff"',
    );
  });

  it("leaves an absent value empty", () => {
    expect(yamlOptional(null)).toBe("");
    expect(yamlOptional("x")).toBe(' "x"');
  });
});

describe("codeSpan", () => {
  it("wraps text so nothing in it is read as Markdown, HTML, a link or a tag", () => {
    expect(codeSpan('<img src=x onerror="alert(1)">')).toBe('`<img src=x onerror="alert(1)">`');
    expect(codeSpan("[[Leaderboard]] #tag %%hidden%%")).toBe("`[[Leaderboard]] #tag %%hidden%%`");
  });

  it("uses a longer fence than any run of backticks inside, padded at the ends", () => {
    expect(codeSpan("a`b")).toBe("``a`b``");
    expect(codeSpan("`x`")).toBe("`` `x` ``");
    expect(codeSpan("a``b")).toBe("```a``b```");
  });

  it("keeps it on one line", () => {
    expect(codeSpan("one\ntwo\r\nthree\u2028four")).toBe("`one two three four`");
  });
});

describe("plainTitle", () => {
  it("removes what would end or re-route a link, start a tag or open a comment", () => {
    expect(plainTitle("Orders | fills [1] #draft ^id `x` <b> %%c%%")).toBe(
      "Orders fills 1 draft id x b %c%",
    );
    expect(plainTitle(" [[ ]] ")).toBe("untitled");
  });
});

describe("wikilink", () => {
  it("links by full path, with the alias pipe escaped inside a table", () => {
    expect(wikilink("ZeroCorps/Members/trader_99", "trader_99")).toBe(
      "[[ZeroCorps/Members/trader_99|trader_99]]",
    );
    expect(wikilink("ZeroCorps/Members/trader_99", "trader_99", { inTable: true })).toBe(
      "[[ZeroCorps/Members/trader_99\\|trader_99]]",
    );
    expect(wikilink("ZeroCorps/ZeroCorps Brain")).toBe("[[ZeroCorps/ZeroCorps Brain]]");
  });

  it("refuses a path that could point anywhere else", () => {
    for (const path of [
      "ZeroCorps/../secret",
      "ZeroCorps/.hidden",
      "a]]b",
      "a|b",
      "a#b",
      "",
      "a//b",
    ]) {
      expect(() => wikilink(path), path).toThrow();
    }
  });
});

describe("fileBase", () => {
  it("passes usernames, member numbers and Academy ids", () => {
    for (const name of ["trader_99", "_under", "member-3", "orders-and-fills", "rookie"]) {
      expect(fileBase(name)).toBe(name);
    }
  });

  it("gives a name Windows reserves a hyphen, which no username has", () => {
    for (const name of ["con", "prn", "aux", "nul", "com1", "lpt9", "com0"]) {
      expect(fileBase(name)).toBe(`${name}-`);
    }
    expect(fileBase("console")).toBe("console");
  });

  it("refuses anything that could leave a folder or hide a file", () => {
    for (const name of [
      "../x",
      "a/b",
      "a\\b",
      ".hidden",
      "-dash",
      "",
      "Upper",
      "x".repeat(81),
      "a b",
    ]) {
      expect(() => fileBase(name), name).toThrow();
    }
  });
});
