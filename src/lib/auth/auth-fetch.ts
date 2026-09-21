/**
 * How the forms talk to /api/auth: plain same-origin `fetch`, no client library. The
 * browser adds the Origin header and the cookies itself, which is what the server's
 * origin and CSRF checks look at.
 *
 * Every failure comes back as a code and a sentence a person can act on. Nothing here
 * ever distinguishes "no such account" from "wrong password": the server does not say,
 * so neither do we.
 */

export type AuthFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
  retryAfterSeconds?: number;
  attemptsLeft?: number;
};

export type AuthResult<T> = { ok: true; data: T } | AuthFailure;

export const UNAVAILABLE_MESSAGE =
  "ZeroCorps is temporarily unavailable. Nothing was lost. Please try again in a few minutes.";

/** Friendlier words for the codes Better Auth itself returns. Ours already read well. */
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "That email address and password don't match.",
  INVALID_EMAIL: "That does not look like an email address.",
  INVALID_PASSWORD: "That email address and password don't match.",
  INVALID_TOKEN: "This reset link is no longer valid. Ask for a new one.",
  PASSWORD_TOO_SHORT: "Use at least 12 characters.",
  PASSWORD_TOO_LONG: "Use at most 128 characters.",
  EMAIL_NOT_VERIFIED: "This email address has not been verified yet.",
  INVALID_ORIGIN: "This request did not come from zerocorps.org, so it was refused.",
  TOO_MANY_REQUESTS: "Too many attempts. Please wait a while and try again.",
};

function waitPhrase(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return "";
  if (seconds < 90) return ` Try again in about ${Math.ceil(seconds / 10) * 10} seconds.`;
  const minutes = Math.ceil(seconds / 60);
  return ` Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

export async function authFetch<T = Record<string, unknown>>(
  path: string,
  body?: Record<string, unknown>,
  method: "GET" | "POST" = "POST",
): Promise<AuthResult<T>> {
  let response: Response;
  try {
    response = await fetch(`/api/auth${path}`, {
      method,
      credentials: "same-origin",
      headers: method === "POST" ? { "content-type": "application/json" } : undefined,
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    });
  } catch {
    return { ok: false, status: 0, code: "UNAVAILABLE", message: UNAVAILABLE_MESSAGE };
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = ((await response.json()) as Record<string, unknown> | null) ?? {};
  } catch {
    // An empty or non-JSON body: the status decides.
  }
  if (response.ok) return { ok: true, data: payload as T };

  if (response.status >= 500) {
    return {
      ok: false,
      status: response.status,
      code: "UNAVAILABLE",
      message: UNAVAILABLE_MESSAGE,
    };
  }

  const headerWait = Number(
    response.headers.get("x-retry-after") ?? response.headers.get("retry-after"),
  );
  const retryAfterSeconds =
    typeof payload.retryAfterSeconds === "number"
      ? payload.retryAfterSeconds
      : Number.isFinite(headerWait) && headerWait > 0
        ? headerWait
        : undefined;
  const code =
    typeof payload.code === "string"
      ? payload.code
      : response.status === 429
        ? "TOO_MANY_REQUESTS"
        : "REQUEST_FAILED";
  const base =
    MESSAGES[code] ??
    (typeof payload.message === "string" && payload.message
      ? payload.message
      : "That did not work. Please try again.");

  return {
    ok: false,
    status: response.status,
    code,
    message: response.status === 429 ? base + waitPhrase(retryAfterSeconds) : base,
    retryAfterSeconds,
    attemptsLeft: typeof payload.attemptsLeft === "number" ? payload.attemptsLeft : undefined,
  };
}

const leavesTheSite = (path: string) =>
  !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\");

/**
 * Where to go after signing in. Only a path on this site is ever accepted: a full URL,
 * or one that starts with `//` or `/\`, would let a link send someone elsewhere.
 *
 * The check runs on what goes in AND on what comes out. Normalising a path can CREATE a
 * leading `//`: `/.//host` and `/x/..//host` both become `//host`, which a browser reads
 * as another site. Last, the result must still resolve to this site from any page.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || leavesTheSite(next)) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const site = "https://zerocorps.invalid";
    const url = new URL(next, site);
    if (url.origin !== site) return fallback;
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (leavesTheSite(path) || new URL(path, `${site}/sign-in`).origin !== site) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
