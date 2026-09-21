import type { Auth } from "../lib/auth/create-auth.ts";

/**
 * A browser stand-in for tests: it sends real HTTP requests to Better Auth's handler
 * and keeps the cookies it is given, the way a browser would. Going through HTTP
 * matters, because the origin check, the rate limiter and `disabledPaths` exist only
 * there (DECISIONS.md, finding 18).
 */
export function createTestClient(
  auth: Auth,
  options: {
    baseUrl: string;
    ip?: string;
    /** `null` sends no Origin header at all. */
    origin?: string | null;
    userAgent?: string;
    /** Extra request headers, for example the Sec-Fetch-* headers a real browser adds. */
    headers?: Record<string, string>;
  },
) {
  const cookies = new Map<string, string>();
  const ip = options.ip ?? "203.0.113.10";

  async function request(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    contentType = "application/json",
  ) {
    const headers = new Headers({
      "x-forwarded-for": ip,
      "user-agent": options.userAgent ?? "Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 Safari/537.36",
      ...options.headers,
    });
    const origin = options.origin === undefined ? options.baseUrl : options.origin;
    if (origin) headers.set("origin", origin);
    if (cookies.size > 0) {
      headers.set("cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));
    }
    if (body !== undefined) headers.set("content-type", contentType);

    const response = await auth.handler(
      new Request(`${options.baseUrl}/api/auth${path}`, {
        method,
        headers,
        body:
          body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      }),
    );

    for (const line of response.headers.getSetCookie()) {
      const [pair = "", ...attributes] = line.split(";");
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      const expired = attributes.some((attribute) => /^\s*max-age=0\s*$/i.test(attribute));
      if (expired || value === "") cookies.delete(name);
      else cookies.set(name, value);
    }

    const text = await response.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      json = null;
    }
    return { status: response.status, json, text, setCookies: response.headers.getSetCookie() };
  }

  return {
    cookies,
    get: (path: string) => request("GET", path),
    post: (path: string, body: unknown = {}) => request("POST", path, body),
    /** What an HTML form on another site would send: no JSON, no preflight. */
    postForm: (path: string, fields: Record<string, string>) =>
      request(
        "POST",
        path,
        new URLSearchParams(fields).toString(),
        "application/x-www-form-urlencoded",
      ),
  };
}

export type TestClient = ReturnType<typeof createTestClient>;
