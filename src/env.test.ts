import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createEnvShape, parseEnv } from "./env-schema";

/** The keys milestone 2 requires everywhere. Obviously fake values. */
const base = {
  DATABASE_URL: "postgres://zerocorps_app.exampleref:fixture@db.example.com:6543/postgres",
  BETTER_AUTH_SECRET: "fixture-better-auth-secret-0000000000",
  HMAC_SECRET: "fixture-hmac-secret-000000000000000000",
  CRON_SECRET: "fixture-cron-secret-000000000000000000",
};

/** What the live site would set, on top of `base`. */
const production = {
  ...base,
  NODE_ENV: "production",
  APP_ENV: "production",
  NEXT_PUBLIC_APP_URL: "https://zerocorps.org",
  RESEND_API_KEY: "re_fixture",
  SECURITY_CONTACT: "https://example.com/security",
  PRIVACY_CONTACT: "mailto:privacy@example.com",
};

describe("parseEnv: app URL", () => {
  it("defaults the app URL to localhost outside production", () => {
    expect(parseEnv({ ...base, NODE_ENV: "development" }).NEXT_PUBLIC_APP_URL).toBe(
      "http://localhost:3000",
    );
    expect(parseEnv(base).NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("requires the app URL in a production build", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: "production", APP_ENV: "local" })).toThrow(
      /NEXT_PUBLIC_APP_URL: Required/,
    );
    expect(() =>
      parseEnv({ ...base, NODE_ENV: "production", APP_ENV: "local", NEXT_PUBLIC_APP_URL: "  " }),
    ).toThrow(/NEXT_PUBLIC_APP_URL: Required/);
  });

  it("normalises the app URL to its origin", () => {
    const env = parseEnv({ ...production, NEXT_PUBLIC_APP_URL: "https://ZeroCorps.org/" });
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://zerocorps.org");
  });

  it("rejects an app URL with a path, a bad scheme, or no scheme", () => {
    const parse = (url: string) => () => parseEnv({ ...base, NEXT_PUBLIC_APP_URL: url });
    expect(parse("https://zerocorps.org/academy")).toThrow(/origin only/);
    expect(parse("ftp://zerocorps.org")).toThrow(/http:\/\/ or https:\/\//);
    expect(parse("zerocorps.org")).toThrow(/full URL/);
  });

  it("requires https in a production build except on localhost", () => {
    expect(() => parseEnv({ ...production, NEXT_PUBLIC_APP_URL: "http://zerocorps.org" })).toThrow(
      /https/,
    );
    const local = parseEnv({
      ...base,
      NODE_ENV: "production",
      APP_ENV: "local",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });
    expect(local.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });
});

describe("parseEnv: APP_ENV", () => {
  it("defaults to local in development and is required for a production build", () => {
    expect(parseEnv(base).APP_ENV).toBe("local");
    expect(() =>
      parseEnv({ ...base, NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://zerocorps.org" }),
    ).toThrow(/APP_ENV: Required for a production build/);
  });

  it("refuses local with a public URL, so the live site can never run as the laptop", () => {
    expect(() =>
      parseEnv({ ...base, APP_ENV: "local", NEXT_PUBLIC_APP_URL: "https://zerocorps.org" }),
    ).toThrow(/APP_ENV: Is local/);
  });

  it("refuses production on a localhost or http address", () => {
    expect(() =>
      parseEnv({
        ...production,
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }),
    ).toThrow(/NEXT_PUBLIC_APP_URL: Must be the public https/);
  });

  it("accepts a complete production environment", () => {
    const env = parseEnv(production);
    expect(env.APP_ENV).toBe("production");
    expect(env.SIGNUP_MODE).toBe("closed");
  });

  it("requires the email key and both contacts in production", () => {
    const rest: Record<string, string> = { ...production };
    for (const key of ["RESEND_API_KEY", "SECURITY_CONTACT", "PRIVACY_CONTACT"]) delete rest[key];
    expect(() => parseEnv(rest)).toThrow(/RESEND_API_KEY: Required in production/);
    expect(() => parseEnv(rest)).toThrow(/SECURITY_CONTACT: Required in production/);
    expect(() => parseEnv(rest)).toThrow(/PRIVACY_CONTACT: Required in production/);
  });

  it("refuses an email allowlist in production", () => {
    expect(() => parseEnv({ ...production, EMAIL_ALLOWLIST: "owner@example.com" })).toThrow(
      /EMAIL_ALLOWLIST: Must be empty in production/,
    );
  });
});

describe("parseEnv: database and secrets", () => {
  it("requires the database URL and the three secrets", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL: Required/);
    expect(() => parseEnv({})).toThrow(/BETTER_AUTH_SECRET: Required/);
    expect(() => parseEnv({})).toThrow(/HMAC_SECRET: Required/);
    expect(() => parseEnv({})).toThrow(/CRON_SECRET: Required/);
  });

  it("rejects a database URL that does not parse, as a special character in the password causes", () => {
    const broken = "postgres://zerocorps_app.exampleref:pa/ss#word@db.example.com:6543/postgres";
    expect(() => parseEnv({ ...base, DATABASE_URL: broken })).toThrow(
      /DATABASE_URL: Must be a postgres/,
    );
    expect(() => parseEnv({ ...base, DATABASE_URL: "https://db.example.com" })).toThrow(
      /DATABASE_URL: Must be a postgres/,
    );
  });

  it("leaves the migrations URL optional, because only the laptop's scripts use it", () => {
    expect(parseEnv(base).DATABASE_URL_MIGRATIONS).toBeUndefined();
    expect(() => parseEnv({ ...base, DATABASE_URL_MIGRATIONS: "not a url" })).toThrow(
      /DATABASE_URL_MIGRATIONS/,
    );
  });

  it("rejects a short secret", () => {
    expect(() => parseEnv({ ...base, HMAC_SECRET: "too-short" })).toThrow(
      /HMAC_SECRET: Must be at least 32 characters/,
    );
  });

  it("rejects two secrets with the same value", () => {
    expect(() => parseEnv({ ...base, HMAC_SECRET: base.BETTER_AUTH_SECRET })).toThrow(
      /HMAC_SECRET: Must be different from BETTER_AUTH_SECRET/,
    );
    expect(() => parseEnv({ ...base, CRON_SECRET: base.HMAC_SECRET })).toThrow(
      /CRON_SECRET: Must be different from HMAC_SECRET/,
    );
  });
});

describe("parseEnv: sign-up mode and lists", () => {
  it("defaults sign-ups to closed", () => {
    expect(parseEnv(base).SIGNUP_MODE).toBe("closed");
    expect(() => parseEnv({ ...base, SIGNUP_MODE: "maybe" })).toThrow(/SIGNUP_MODE/);
  });

  it("requires an allowlist in allowlist mode", () => {
    expect(() => parseEnv({ ...base, SIGNUP_MODE: "allowlist" })).toThrow(
      /SIGNUP_ALLOWLIST: Required when SIGNUP_MODE is allowlist/,
    );
  });

  it("normalises allowlists: trimmed, lower-cased, de-duplicated", () => {
    const env = parseEnv({
      ...base,
      SIGNUP_MODE: "allowlist",
      SIGNUP_ALLOWLIST: " Owner@Example.com , owner@example.com,second@example.com ",
    });
    expect(env.SIGNUP_ALLOWLIST).toEqual(["owner@example.com", "second@example.com"]);
    expect(parseEnv(base).EMAIL_ALLOWLIST).toEqual([]);
  });

  it("rejects an allowlist entry that is not an address", () => {
    expect(() => parseEnv({ ...base, EMAIL_ALLOWLIST: "owner@example.com, nonsense" })).toThrow(
      /EMAIL_ALLOWLIST: Must be a comma-separated list/,
    );
  });

  it("defaults the trusted IP header and lower-cases a custom one", () => {
    expect(parseEnv(base).TRUSTED_IP_HEADER).toBe("x-forwarded-for");
    expect(parseEnv({ ...base, TRUSTED_IP_HEADER: "X-Real-IP" }).TRUSTED_IP_HEADER).toBe(
      "x-real-ip",
    );
    expect(() => parseEnv({ ...base, TRUSTED_IP_HEADER: "not a header" })).toThrow(
      /TRUSTED_IP_HEADER/,
    );
  });

  it("accepts only https:// or mailto: contacts", () => {
    expect(() => parseEnv({ ...base, SECURITY_CONTACT: "security@example.com" })).toThrow(
      /SECURITY_CONTACT: Must start with https:\/\/ or mailto:/,
    );
    expect(
      parseEnv({ ...base, SECURITY_CONTACT: "mailto:security@example.com" }).SECURITY_CONTACT,
    ).toBe("mailto:security@example.com");
  });
});

describe("parseEnv: general", () => {
  it("treats blank values as unset", () => {
    const env = parseEnv({ ...base, RESEND_API_KEY: "", SMS_PROVIDER: "" });
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.SMS_PROVIDER).toBe("console");
    expect(env.EMAIL_FROM).toBe("ZeroCorps <no-reply@zerocorps.org>");
  });

  it("rejects an unknown SMS provider", () => {
    expect(() => parseEnv({ ...base, SMS_PROVIDER: "carrier-pigeon" })).toThrow(/SMS_PROVIDER/);
  });

  it("never includes values in the error message", () => {
    const secretUrl = "postgres://user:hunter2@db example.com:6543/postgres";
    try {
      parseEnv({
        NEXT_PUBLIC_APP_URL: "not a url",
        DATABASE_URL: secretUrl,
        BETTER_AUTH_SECRET: "short-secret-value",
        SIGNUP_ALLOWLIST: "leaky@example.com, nonsense-entry",
      });
      expect.unreachable("parseEnv should have thrown");
    } catch (error) {
      const message = String(error);
      expect(message).not.toContain("hunter2");
      expect(message).not.toContain("not a url");
      expect(message).not.toContain("short-secret-value");
      expect(message).not.toContain("leaky@example.com");
      expect(message).not.toContain("nonsense-entry");
    }
  });
});

describe(".env.example", () => {
  it("lists exactly the keys the schema knows about", () => {
    const examplePath = fileURLToPath(new URL("../.env.example", import.meta.url));
    const exampleKeys = readFileSync(examplePath, "utf8")
      .split(/\r?\n/)
      .map((line) => /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1])
      .filter((key): key is string => Boolean(key));

    const schemaKeys = Object.keys(createEnvShape(false)).filter((key) => key !== "NODE_ENV");

    expect([...exampleKeys].sort()).toEqual([...schemaKeys].sort());
  });
});
