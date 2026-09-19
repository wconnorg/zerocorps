import { describe, expect, it, vi } from "vitest";
import {
  THEME_COOKIE,
  isTheme,
  otherTheme,
  parseThemeCookie,
  serializeThemeCookie,
  themeInitScript,
} from "./theme";

describe("isTheme", () => {
  it("accepts only the two themes", () => {
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("light")).toBe(true);
    expect(isTheme("system")).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
});

describe("otherTheme", () => {
  it("flips between the two themes", () => {
    expect(otherTheme("dark")).toBe("light");
    expect(otherTheme("light")).toBe("dark");
  });
});

describe("parseThemeCookie", () => {
  it("finds the theme among other cookies", () => {
    expect(parseThemeCookie(`a=1; ${THEME_COOKIE}=light; b=2`)).toBe("light");
    expect(parseThemeCookie(`${THEME_COOKIE}=dark`)).toBe("dark");
  });

  it("returns null when missing or invalid", () => {
    expect(parseThemeCookie("")).toBeNull();
    expect(parseThemeCookie(null)).toBeNull();
    expect(parseThemeCookie("a=1; b=2")).toBeNull();
    expect(parseThemeCookie(`${THEME_COOKIE}=solarized`)).toBeNull();
    expect(parseThemeCookie(`not-${THEME_COOKIE}=light`)).toBeNull();
  });
});

describe("serializeThemeCookie", () => {
  it("is site-wide, long-lived and SameSite=Lax", () => {
    const cookie = serializeThemeCookie("light");
    expect(cookie).toContain(`${THEME_COOKIE}=light`);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Secure");
  });

  it("adds Secure on https", () => {
    expect(serializeThemeCookie("dark", { secure: true })).toContain("Secure");
  });

  it("round-trips through parseThemeCookie", () => {
    const pair = serializeThemeCookie("light").split(";")[0];
    expect(parseThemeCookie(pair)).toBe("light");
  });
});

describe("themeInitScript", () => {
  function run(cookie: string) {
    const setAttribute = vi.fn();
    const fakeDocument = { cookie, documentElement: { setAttribute } };
    new Function("document", themeInitScript())(fakeDocument);
    return setAttribute;
  }

  it("applies a saved theme before paint", () => {
    expect(run(`${THEME_COOKIE}=light`)).toHaveBeenCalledWith("data-theme", "light");
    expect(run(`x=1; ${THEME_COOKIE}=dark; y=2`)).toHaveBeenCalledWith("data-theme", "dark");
  });

  it("leaves the server default alone when there is no valid cookie", () => {
    expect(run("")).not.toHaveBeenCalled();
    expect(run(`${THEME_COOKIE}=solarized`)).not.toHaveBeenCalled();
    expect(run(`${THEME_COOKIE}=lightning`)).not.toHaveBeenCalled();
    expect(run(`not-${THEME_COOKIE}=light`)).not.toHaveBeenCalled();
  });

  it("swallows errors so a blocked cookie jar cannot break the page", () => {
    const hostile = {
      get cookie(): string {
        throw new Error("cookies are disabled");
      },
      documentElement: { setAttribute: vi.fn() },
    };
    expect(() => new Function("document", themeInitScript())(hostile)).not.toThrow();
  });
});
