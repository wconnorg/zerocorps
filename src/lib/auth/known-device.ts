import { randomToken, sha256 } from "./keyed-hash.ts";

/**
 * "Known device": a long-lived, httpOnly cookie holding a random token. Only the
 * token's SHA-256 is stored, per user. A sign-in from a browser without a known token
 * sends the account's owner an alert.
 *
 * Known is NOT trusted. This cookie never skips a check; the 2FA plugin's "trust this
 * device" cookie in milestone 5 is a separate thing with a separate name.
 */

export const KNOWN_DEVICE_COOKIE = "known_device";
/** 400 days, the longest lifetime browsers honour. */
export const KNOWN_DEVICE_MAX_AGE = 60 * 60 * 24 * 400;

type CookieContext = {
  context: {
    createAuthCookie: (
      name: string,
      attributes?: { maxAge?: number },
    ) => { name: string; attributes: Record<string, unknown> };
  };
  getCookie: (name: string) => string | null | undefined;
  setCookie: (name: string, value: string, attributes?: Record<string, unknown>) => unknown;
};

/**
 * Returns this browser's device token, creating and setting one if it has none, plus
 * the hash that is safe to store. The cookie is refreshed on every use so that it
 * does not lapse on a device that is in regular use.
 */
export function ensureDeviceToken(ctx: CookieContext): { hash: string } {
  const cookie = ctx.context.createAuthCookie(KNOWN_DEVICE_COOKIE, {
    maxAge: KNOWN_DEVICE_MAX_AGE,
  });
  const existing = ctx.getCookie(cookie.name);
  const token = existing && /^[A-Za-z0-9_-]{43}$/.test(existing) ? existing : randomToken();
  ctx.setCookie(cookie.name, token, cookie.attributes);
  return { hash: sha256(token) };
}
