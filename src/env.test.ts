import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createEnvSchema, parseEnv } from "./env";

describe("parseEnv", () => {
  it("defaults the app URL to localhost outside production", () => {
    expect(parseEnv({ NODE_ENV: "development" }).NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(parseEnv({}).NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("requires the app URL in production", () => {
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow(/NEXT_PUBLIC_APP_URL: Required/);
    expect(() => parseEnv({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "  " })).toThrow(
      /NEXT_PUBLIC_APP_URL: Required/,
    );
  });

  it("normalises the app URL to its origin", () => {
    const env = parseEnv({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://ZeroCorps.org/" });
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://zerocorps.org");
  });

  it("rejects an app URL with a path, a bad scheme, or no scheme", () => {
    const parse = (url: string) => () => parseEnv({ NEXT_PUBLIC_APP_URL: url });
    expect(parse("https://zerocorps.org/academy")).toThrow(/origin only/);
    expect(parse("ftp://zerocorps.org")).toThrow(/http:\/\/ or https:\/\//);
    expect(parse("zerocorps.org")).toThrow(/full URL/);
  });

  it("requires https in production except on localhost", () => {
    expect(() =>
      parseEnv({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "http://zerocorps.org" }),
    ).toThrow(/https/);
    expect(
      parseEnv({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "http://localhost:3000" })
        .NEXT_PUBLIC_APP_URL,
    ).toBe("http://localhost:3000");
  });

  it("treats blank values as unset", () => {
    const env = parseEnv({ DATABASE_URL: "", SMS_PROVIDER: "" });
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.SMS_PROVIDER).toBe("console");
  });

  it("rejects an unknown SMS provider", () => {
    expect(() => parseEnv({ SMS_PROVIDER: "carrier-pigeon" })).toThrow(/SMS_PROVIDER/);
  });

  it("never includes values in the error message", () => {
    const secret = "postgres://user:hunter2@db.example.com:6543/postgres";
    try {
      parseEnv({ NEXT_PUBLIC_APP_URL: "not a url", DATABASE_URL: secret });
      expect.unreachable("parseEnv should have thrown");
    } catch (error) {
      expect(String(error)).not.toContain("hunter2");
      expect(String(error)).not.toContain("not a url");
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

    const schemaKeys = Object.keys(createEnvSchema(false).shape).filter(
      (key) => key !== "NODE_ENV",
    );

    expect([...exampleKeys].sort()).toEqual([...schemaKeys].sort());
  });
});
