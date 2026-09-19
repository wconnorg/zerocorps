import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  contentSecurityPolicyDirectives,
  securityHeaders,
} from "./security-headers";

describe("buildContentSecurityPolicy", () => {
  it("locks down the dangerous directives in production", () => {
    const csp = buildContentSecurityPolicy({ isDev: false });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("never allows eval or websockets in production", () => {
    const csp = buildContentSecurityPolicy({ isDev: false });
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("ws:");
  });

  it("relaxes only what the dev server needs", () => {
    const dev = contentSecurityPolicyDirectives({ isDev: true });
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toContain("ws:");
    expect(dev).not.toHaveProperty("upgrade-insecure-requests");
  });

  it("allows no third-party origins", () => {
    expect(buildContentSecurityPolicy({ isDev: false })).not.toMatch(/https?:\/\//);
  });

  it("is a single line, as an HTTP header must be", () => {
    expect(buildContentSecurityPolicy({ isDev: false })).not.toMatch(/[\r\n]/);
  });
});

describe("securityHeaders", () => {
  const names = (isDev: boolean) => securityHeaders({ isDev }).map((header) => header.key);

  it("sends the baseline set", () => {
    expect(names(false)).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Cross-Origin-Opener-Policy",
        "Permissions-Policy",
        "Strict-Transport-Security",
      ]),
    );
  });

  it("does not send HSTS from the http dev server", () => {
    expect(names(true)).not.toContain("Strict-Transport-Security");
  });

  it("keeps HSTS reversible until every subdomain is ready", () => {
    const hsts = securityHeaders({ isDev: false }).find(
      (header) => header.key === "Strict-Transport-Security",
    );
    expect(hsts?.value).not.toContain("preload");
    expect(hsts?.value).not.toContain("includeSubDomains");
  });
});
