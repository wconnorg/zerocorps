import { randomBytes } from "node:crypto";
import { diagnoseDatabaseUrl } from "./db-url.ts";

/**
 * Decides what the owner carries from the laptop to the host's settings, for
 * `npm run env:handoff`. The command puts one value at a time on the clipboard and never
 * shows it; this module is the part that can be tested.
 *
 * Three rules, each of which has gone wrong on other projects:
 *
 * - **The host gets its OWN secrets.** `BETTER_AUTH_SECRET`, `HMAC_SECRET` and
 *   `CRON_SECRET` are generated fresh here. The laptop's values are never handed over,
 *   so a lost laptop cannot forge a session or a cron call on the live site.
 * - **Only the app's database URL ever leaves the laptop**, and only if its role is
 *   `zerocorps_app`. The migrations URL carries the owner role, which can drop tables;
 *   on the host it would undo the main protection the one shared database has.
 * - **Everything else is refused by name**, so a typo cannot hand over the wrong thing.
 *
 * This module imports nothing from the app, so the script in `scripts/` can load it.
 */

export const FRESH_SECRETS = ["BETTER_AUTH_SECRET", "HMAC_SECRET", "CRON_SECRET"] as const;
export const HANDOFF_KEYS = [...FRESH_SECRETS, "DATABASE_URL"] as const;
export type HandoffKey = (typeof HANDOFF_KEYS)[number];

/** Laptop-only keys. The command names them so the owner knows they were left out on purpose. */
export const NEVER_ON_THE_HOST = ["DATABASE_URL_MIGRATIONS", "BACKUP_DIR", "EMAIL_ALLOWLIST"];

const APP_ROLE = "zerocorps_app";
const MIN_SECRET_LENGTH = 32;

export type Handoff =
  | { ok: true; key: HandoffKey; value: string; what: string }
  | { ok: false; key: string; reason: string };

/** 32 random bytes as base64url: 43 characters, the same shape `npm run env:secrets` writes. */
const freshSecret = () => randomBytes(32).toString("base64url");

/**
 * `laptop(key)` returns the value in `.env.local`, or "" when it is blank or missing.
 * The returned `value` is for the clipboard only. `what` and `reason` never contain it.
 */
export function valueForHost(
  key: string,
  laptop: (key: string) => string,
  generate: () => string = freshSecret,
): Handoff {
  if (NEVER_ON_THE_HOST.includes(key)) {
    return { ok: false, key, reason: `${key} stays on the laptop. It is never set on the host.` };
  }
  if (!(HANDOFF_KEYS as readonly string[]).includes(key)) {
    return {
      ok: false,
      key,
      reason: `${key} is not handed over by this command. It handles: ${HANDOFF_KEYS.join(", ")}.`,
    };
  }

  if (key === "DATABASE_URL") {
    const url = laptop("DATABASE_URL");
    const diagnosis = diagnoseDatabaseUrl(url, "app");
    if (!diagnosis.ok) {
      return {
        ok: false,
        key,
        reason: "DATABASE_URL on the laptop has a problem. Run `npm run db:check` first.",
      };
    }
    if (diagnosis.role !== APP_ROLE) {
      return {
        ok: false,
        key,
        reason: `DATABASE_URL does not connect as ${APP_ROLE}, so it is NOT handed over. The host must never get the owner role.`,
      };
    }
    if (url === laptop("DATABASE_URL_MIGRATIONS")) {
      return {
        ok: false,
        key,
        reason: "DATABASE_URL is the same as the migrations URL, so it is NOT handed over.",
      };
    }
    return {
      ok: true,
      key,
      value: url,
      what: `the app's database URL (role ${APP_ROLE}, transaction pooler). The same value as the laptop's: there is one database.`,
    };
  }

  // A fresh secret. Never the laptop's, and never one this call has already seen there.
  let value = generate();
  for (
    let attempt = 0;
    attempt < 5 && FRESH_SECRETS.some((name) => laptop(name) === value);
    attempt++
  ) {
    value = generate();
  }
  if (value.length < MIN_SECRET_LENGTH || FRESH_SECRETS.some((name) => laptop(name) === value)) {
    return { ok: false, key, reason: `Could not generate a usable value for ${key}.` };
  }
  return {
    ok: true,
    key: key as HandoffKey,
    value,
    what: "a NEW random value, made just now. It is different from the laptop's, on purpose.",
  };
}
