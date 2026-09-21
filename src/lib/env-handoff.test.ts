import { describe, expect, it } from "vitest";
import { FRESH_SECRETS, HANDOFF_KEYS, NEVER_ON_THE_HOST, valueForHost } from "./env-handoff.ts";

/**
 * What may travel from the laptop to the host's settings. Nothing here touches a real
 * file or a real clipboard: the laptop's values are a plain object.
 */

// Built from parts, with a host that cannot exist, as the other tests do.
const HOST = "aws-0-eu-example-1.pooler.supabase.com";
const urlOf = (user: string, password: string, port: number) =>
  `postgresql://${user}:${password}@${HOST}:${port}/postgres`;
const APP_URL = urlOf("zerocorps_app.abcd1234", "lettersandnumbers123", 6543);
const OWNER_URL = urlOf("postgres.abcd1234", "lettersandnumbers456", 5432);

const laptopOf = (values: Record<string, string>) => (key: string) => values[key] ?? "";
const laptop = laptopOf({
  DATABASE_URL: APP_URL,
  DATABASE_URL_MIGRATIONS: OWNER_URL,
  BETTER_AUTH_SECRET: "laptop-better-auth-secret-0000000000000000",
  HMAC_SECRET: "laptop-hmac-secret-00000000000000000000000",
  CRON_SECRET: "laptop-cron-secret-00000000000000000000000",
});

describe("what the owner carries to the host", () => {
  it("makes a NEW secret every time, never the laptop's, and long enough for the schema", () => {
    const seen = new Set<string>();
    for (const key of FRESH_SECRETS) {
      for (let round = 0; round < 3; round++) {
        const handoff = valueForHost(key, laptop);
        if (!handoff.ok) throw new Error(handoff.reason);
        expect(handoff.value.length).toBeGreaterThanOrEqual(32);
        expect(handoff.value).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(handoff.value).not.toBe(laptop(key));
        expect(seen.has(handoff.value)).toBe(false);
        seen.add(handoff.value);
      }
    }
  });

  it("never hands over a laptop secret, even if the generator happens to produce it", () => {
    const stuck = valueForHost("HMAC_SECRET", laptop, () => laptop("HMAC_SECRET"));
    expect(stuck).toMatchObject({ ok: false, key: "HMAC_SECRET" });

    // Another key's laptop value is no better: the three must not be shared either.
    const crossed = valueForHost("CRON_SECRET", laptop, () => laptop("BETTER_AUTH_SECRET"));
    expect(crossed.ok).toBe(false);

    let calls = 0;
    const recovers = valueForHost("HMAC_SECRET", laptop, () =>
      calls++ === 0 ? laptop("HMAC_SECRET") : "a-fresh-value-that-is-long-enough-000000000",
    );
    expect(recovers).toMatchObject({
      ok: true,
      value: "a-fresh-value-that-is-long-enough-000000000",
    });
  });

  it("refuses a generated value that is too short", () => {
    expect(valueForHost("CRON_SECRET", laptop, () => "short").ok).toBe(false);
  });

  it("hands over the app's database URL, unchanged", () => {
    expect(valueForHost("DATABASE_URL", laptop)).toMatchObject({ ok: true, value: APP_URL });
  });

  it("NEVER hands over the owner role, whatever key it is stored under", () => {
    // The owner URL pasted into DATABASE_URL by mistake.
    const swapped = laptopOf({ DATABASE_URL: OWNER_URL, DATABASE_URL_MIGRATIONS: OWNER_URL });
    const refused = valueForHost("DATABASE_URL", swapped);
    expect(refused.ok).toBe(false);

    // The owner role on the app's port: it parses cleanly, and is still refused.
    const ownerOnAppPort = laptopOf({ DATABASE_URL: OWNER_URL.replace(":5432/", ":6543/") });
    const alsoRefused = valueForHost("DATABASE_URL", ownerOnAppPort);
    expect(alsoRefused).toMatchObject({ ok: false });
    if (!alsoRefused.ok) expect(alsoRefused.reason).toMatch(/NOT handed over/);

    // Asking for the migrations URL by name.
    expect(valueForHost("DATABASE_URL_MIGRATIONS", laptop)).toMatchObject({ ok: false });
  });

  it("refuses a database URL that is blank or malformed", () => {
    expect(valueForHost("DATABASE_URL", laptopOf({})).ok).toBe(false);
    expect(valueForHost("DATABASE_URL", laptopOf({ DATABASE_URL: "not a url" })).ok).toBe(false);
  });

  it("refuses every laptop-only key and anything it does not know, by name", () => {
    for (const key of [...NEVER_ON_THE_HOST, "RESEND_API_KEY", "PATH", "", "database_url"]) {
      expect(valueForHost(key, laptop).ok, key).toBe(false);
    }
    expect(HANDOFF_KEYS.filter((key) => NEVER_ON_THE_HOST.includes(key))).toEqual([]);
  });

  it("never puts a value into the words it shows", () => {
    for (const key of [...HANDOFF_KEYS, ...NEVER_ON_THE_HOST, "DATABASE_URL_MIGRATIONS"]) {
      const handoff = valueForHost(key, laptop);
      const shown = handoff.ok ? handoff.what : handoff.reason;
      for (const secret of [APP_URL, OWNER_URL, "lettersandnumbers", "abcd1234", HOST, "://"]) {
        expect(shown.includes(secret), `${key}: ${secret}`).toBe(false);
      }
      if (handoff.ok) expect(shown.includes(handoff.value)).toBe(false);
    }
  });
});
