import { afterEach, describe, expect, it, vi } from "vitest";
import { authFetch, safeNextPath, UNAVAILABLE_MESSAGE } from "./auth-fetch";

afterEach(() => vi.unstubAllGlobals());

const respondWith = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body === null ? "" : JSON.stringify(body), { status, headers })),
  );

describe("safeNextPath", () => {
  it("accepts a path on this site", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/academy?lesson=1#top")).toBe("/academy?lesson=1#top");
  });

  it("falls back for anything that could leave the site", () => {
    for (const hostile of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "evil.example",
      "/ok\r\nLocation: https://evil.example",
      "",
      null,
      undefined,
    ]) {
      expect(safeNextPath(hostile), String(hostile)).toBe("/dashboard");
    }
  });

  it("falls back when normalising the path would CREATE a way off the site", () => {
    // Each of these starts with a single "/", so it passes a check of the input alone. A
    // browser drops the dot segments (and reads "\" as "/"), which leaves "//evil.example".
    for (const hostile of [
      "/.//evil.example",
      "/..//evil.example",
      "/x/..//evil.example",
      "/././/evil.example",
      "/.\\/evil.example",
      "/./\\evil.example",
      "/x/..\\/evil.example",
      "/%2e//evil.example",
      "/.//evil.example/dashboard?x=1#y",
    ]) {
      expect(safeNextPath(hostile), hostile).toBe("/dashboard");
    }
  });

  it("whatever goes in, the browser stays on this site", () => {
    const tricky = [
      "/dashboard",
      "/academy?lesson=1#top",
      "/a/../b",
      "/%2F/evil.example",
      "/@evil.example",
      "/?next=//evil.example",
      "/.//evil.example",
      "/\t/evil.example",
      "/ /evil.example",
      "/..%2f..%2f/evil.example",
      "////evil.example",
      "/\\\\evil.example",
      "https:/evil.example",
      "/https://evil.example",
    ];
    for (const input of tricky) {
      const path = safeNextPath(input);
      expect(path.startsWith("/") && !path.startsWith("//"), input).toBe(true);
      for (const page of ["https://zerocorps.org/sign-in", "https://zerocorps.org/"]) {
        expect(new URL(path, page).origin, input).toBe("https://zerocorps.org");
      }
    }
  });

  it("keeps an ordinary path, tidied", () => {
    expect(safeNextPath("/a/../dashboard")).toBe("/dashboard");
    expect(safeNextPath("/settings/./security?tab=2fa")).toBe("/settings/security?tab=2fa");
  });
});

describe("authFetch", () => {
  it("posts JSON to /api/auth with same-origin credentials", async () => {
    respondWith(200, { ok: true });
    const result = await authFetch("/sign-in/email", { email: "a@example.com", password: "x" });
    expect(result).toEqual({ ok: true, data: { ok: true } });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/sign-in/email");
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin" });
    expect(JSON.parse(String(init.body))).toEqual({ email: "a@example.com", password: "x" });
  });

  it("says the same thing for an unknown address and a wrong password, because the server does", async () => {
    respondWith(401, { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" });
    const result = await authFetch("/sign-in/email", {});
    expect(result).toMatchObject({
      ok: false,
      message: "That email address and password don't match.",
    });
  });

  it("keeps our own messages, and passes on the attempts that are left", async () => {
    respondWith(400, { code: "INVALID_CODE", message: "That code is not right.", attemptsLeft: 3 });
    expect(await authFetch("/email-signup/verify", {})).toMatchObject({
      ok: false,
      code: "INVALID_CODE",
      message: "That code is not right.",
      attemptsLeft: 3,
    });
  });

  it("turns a limit into a sentence with a wait, from the body or from the header", async () => {
    respondWith(429, { code: "TOO_MANY_REQUESTS", message: "x", retryAfterSeconds: 1500 });
    expect((await authFetch("/x", {})) as { message: string }).toMatchObject({
      message:
        "Too many attempts. Please wait a while and try again. Try again in about 25 minutes.",
    });
    respondWith(429, null, { "x-retry-after": "42" });
    expect(await authFetch("/x", {})).toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message:
        "Too many attempts. Please wait a while and try again. Try again in about 50 seconds.",
    });
  });

  it("shows the friendly unavailable message when the server or the network is down", async () => {
    respondWith(503, null);
    expect(await authFetch("/x", {})).toMatchObject({
      ok: false,
      code: "UNAVAILABLE",
      message: UNAVAILABLE_MESSAGE,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("network"))),
    );
    expect(await authFetch("/x", {})).toMatchObject({ ok: false, code: "UNAVAILABLE", status: 0 });
  });
});
