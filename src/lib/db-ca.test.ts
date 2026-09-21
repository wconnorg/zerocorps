import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { databaseTls, PINNED_DATABASE_CAS } from "./db-ca.ts";
import { inspectPinnedCas, WARN_BELOW_DAYS } from "./db-tools/ca-status.ts";

/**
 * The database connection is pinned to Supabase's certificate authority and fails
 * closed. These checks keep the pin honest, warn before it runs out, and fail the build
 * if an unverified connection ever becomes possible again.
 */

const normalise = (pem: string) => pem.replace(/\r\n/g, "\n").trim();

describe("the pinned database certificates", () => {
  it("are exactly the files in certs/, with the fingerprints recorded here", () => {
    expect(PINNED_DATABASE_CAS.map(normalise)).toEqual([
      normalise(readFileSync("certs/prod-ca-2021.crt", "utf8")),
    ]);
    const pinned = inspectPinnedCas(PINNED_DATABASE_CAS, new Date("2026-09-21T00:00:00Z"));
    expect(pinned.map((ca) => [ca.name, ca.fingerprint256])).toEqual([
      [
        "Supabase Root 2021 CA",
        "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA",
      ],
    ]);
  });

  it("are handed to the driver as the ONLY trusted authorities, with verification on", () => {
    const tls = databaseTls();
    expect(tls.rejectUnauthorized).toBe(true);
    expect(tls.ca.map(normalise)).toEqual(PINNED_DATABASE_CAS.map(normalise));
    expect(Object.keys(tls).sort()).toEqual(["ca", "rejectUnauthorized"]);
  });

  it("reads ok, then expiring under 90 days, then expired", () => {
    const at = (date: string) => inspectPinnedCas(PINNED_DATABASE_CAS, new Date(date))[0];
    // The certificate is valid until 2031-04-26T10:56:53Z.
    expect(at("2026-09-21T00:00:00Z")).toMatchObject({ state: "ok" });
    expect(at("2031-01-25T00:00:00Z")).toMatchObject({ state: "ok", daysLeft: 91 });
    expect(at("2031-01-27T00:00:00Z")).toMatchObject({ state: "expiring", daysLeft: 89 });
    expect(at("2031-04-26T00:00:00Z")).toMatchObject({ state: "expiring", daysLeft: 0 });
    expect(at("2031-04-27T00:00:00Z")).toMatchObject({ state: "expired" });
  });

  it("refuses an empty list, and an entry that is not a certificate authority", () => {
    expect(() => inspectPinnedCas([], new Date())).toThrow(/No database certificate/);
    expect(() => inspectPinnedCas(["not a certificate"], new Date())).toThrow();
  });

  it("have not expired today, and warn loudly when one has under 90 days left", () => {
    const pinned = inspectPinnedCas(PINNED_DATABASE_CAS, new Date());
    for (const ca of pinned.filter((entry) => entry.state === "expiring")) {
      console.warn(
        `\n\n  ██ WARNING: the pinned database certificate "${ca.name}" has only ${ca.daysLeft} days left ` +
          `(under ${WARN_BELOW_DAYS}).\n  ██ Stage its replacement now: runbook "Database connections fail after ` +
          `Supabase rotates its CA" in docs/SECURITY.md.\n\n`,
      );
    }
    expect(pinned.filter((entry) => entry.state === "expired").map((entry) => entry.name)).toEqual(
      [],
    );
  });
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|mts|mjs)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

describe("no unverified database connection", () => {
  const files = [...sourceFiles("src"), ...sourceFiles("scripts")].map((path) => ({
    path: path.replace(/\\/g, "/"),
    text: readFileSync(path, "utf8"),
  }));

  it("every file that uses the postgres driver connects through databaseTls()", () => {
    const users = files.filter((file) => /from\s+["']postgres["']/.test(file.text));
    expect(users.map((file) => file.path).sort()).toEqual([
      "scripts/lib/database.mjs",
      "src/db/client.ts",
    ]);
    for (const file of users) expect(file.text, file.path).toMatch(/\bssl: databaseTls\(\),/);
  });

  it('never brings back "encrypt, don\'t verify", in any spelling', () => {
    const forbidden = [
      /\bssl\s*:\s*["'`](require|prefer|allow)["'`]/,
      /\bssl\s*:\s*(true|false)\b/,
      /rejectUnauthorized\s*:\s*false/,
      /NODE_TLS_REJECT_UNAUTHORIZED/,
      /checkServerIdentity/,
    ];
    const offenders = files
      .filter((file) => forbidden.some((pattern) => pattern.test(file.text)))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });
});
