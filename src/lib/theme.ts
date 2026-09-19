/**
 * Theme constants and helpers shared by the server-rendered inline script and
 * the client toggle. There are exactly two themes; dark is the default.
 *
 * The choice is stored in a cookie rather than localStorage so that, from
 * milestone 4, the server can set it from the user's saved preference at login
 * and the very first paint on a new device is already correct.
 */

export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "dark";
export const THEME_ATTRIBUTE = "data-theme";
export const THEME_COOKIE = "zc-theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function otherTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/** Reads the theme from a `Cookie` header or `document.cookie` string. */
export function parseThemeCookie(cookies: string | null | undefined): Theme | null {
  if (!cookies) return null;
  for (const part of cookies.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== THEME_COOKIE) continue;
    const value = part.slice(separator + 1).trim();
    return isTheme(value) ? value : null;
  }
  return null;
}

export function serializeThemeCookie(theme: Theme, options: { secure?: boolean } = {}): string {
  const attributes = [
    `${THEME_COOKIE}=${theme}`,
    "Path=/",
    `Max-Age=${THEME_COOKIE_MAX_AGE}`,
    "SameSite=Lax",
  ];
  if (options.secure) attributes.push("Secure");
  return attributes.join("; ");
}

/** Browser only. The theme currently applied to `<html>`. */
export function readAppliedTheme(): Theme {
  const value = document.documentElement.getAttribute(THEME_ATTRIBUTE);
  return isTheme(value) ? value : DEFAULT_THEME;
}

/** Browser only. Switches the theme now and remembers it for the next visit. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  document.cookie = serializeThemeCookie(theme, { secure: window.location.protocol === "https:" });
}

/**
 * Source of the blocking inline script placed in `<head>`. It runs while the
 * HTML is parsed, before first paint, so a saved light theme never flashes dark.
 * Only the two known theme names are accepted; anything else is ignored.
 */
export function themeInitScript(): string {
  const pattern = `(?:^|; )${THEME_COOKIE}=(${THEMES.join("|")})(?:;|$)`;
  return `(function(){try{var m=document.cookie.match(/${pattern}/);if(m)document.documentElement.setAttribute("${THEME_ATTRIBUTE}",m[1])}catch(e){}})()`;
}
