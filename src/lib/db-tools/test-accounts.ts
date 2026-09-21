import { createHmac } from "node:crypto";
import type { Query } from "../backup/dump.ts";

/**
 * Removes the owner's test accounts. `npm run db:cleanup-test-accounts`.
 *
 * There is one database, shared by the laptop and the live site, so an account made
 * while testing on the laptop is a real account on the live site too. Test accounts
 * use only the owner's own addresses (EMAIL_ALLOWLIST), and this removes exactly those:
 * the user (and with it, by cascade, the sessions, the credential, the known devices and
 * the events about that user), any sign-up still waiting for a code, and the events and
 * limit counters that were keyed by the address.
 *
 * It matches addresses exactly. It never deletes by pattern.
 *
 * **It never deletes an account that was made on the live site.** The owner's real account
 * uses one of the owner's own addresses, so after the first real sign-up the list of test
 * addresses named a real account. The event log records where every sign-up was completed
 * (`app_env`), and the rule fails closed: an account is deleted only when its sign-up was
 * completed on the laptop. One made on the live site, or one whose origin cannot be told
 * (no sign-up event left), is KEPT, together with everything keyed by its address.
 *
 * This module imports nothing from the app, so the script in `scripts/` can load it.
 */

// Must stay identical to `keyedHash` in src/lib/auth/keyed-hash.ts (a test checks that).
const keyedHash = (secret: string, purpose: string, value: string) =>
  createHmac("sha256", secret).update(`${purpose}\n${value}`).digest("base64url");

/** The limits that are keyed by the address alone. Must match LIMITS in src/lib/auth/limits.ts. */
const ADDRESS_LIMITS = [
  "signUpStartPerAddress",
  "signInPerAddress",
  "passwordResetPerAddress",
  "emailsPerAddressPerDay",
];

/** Where an account's sign-up was completed. Only "laptop" accounts are ever deleted. */
export type AccountOrigin = "laptop" | "live-site" | "unknown";

export type TestAccountSummary = {
  address: string;
  hasAccount: boolean;
  pendingSignUps: number;
  /** `null` when there is no account. */
  madeOn: AccountOrigin | null;
}[];

async function originOf(query: Query, address: string): Promise<AccountOrigin | null> {
  const rows = await query(
    `SELECT e.app_env AS app_env
       FROM users u
       LEFT JOIN auth_events e ON e.user_id = u.id AND e.type = 'signup_completed'
      WHERE u.email = $1`,
    [address],
  );
  if (rows.length === 0) return null;
  const places = rows.map((row) => row.app_env);
  // Anything that is not plainly the laptop counts against deleting.
  if (places.some((place) => place !== null && place !== "local")) return "live-site";
  return places.some((place) => place === "local") ? "laptop" : "unknown";
}

export async function findTestAccounts(
  query: Query,
  addresses: readonly string[],
): Promise<TestAccountSummary> {
  const summary: TestAccountSummary = [];
  for (const address of addresses) {
    const [user] = await query("SELECT count(*)::int AS n FROM users WHERE email = $1", [address]);
    const [pending] = await query(
      "SELECT count(*)::int AS n FROM pending_signups WHERE email = $1",
      [address],
    );
    summary.push({
      address,
      hasAccount: Number(user?.n) > 0,
      pendingSignUps: Number(pending?.n),
      madeOn: await originOf(query, address),
    });
  }
  return summary;
}

export type TestAccountCleanup = {
  users: number;
  pendingSignUps: number;
  events: number;
  counters: number;
  /** Accounts that were left alone because they were not made on the laptop. */
  kept: number;
};

/** The caller supplies the transaction, so it is all or nothing. */
export async function deleteTestAccounts(
  query: Query,
  addresses: readonly string[],
  hmacSecret: string,
): Promise<TestAccountCleanup> {
  const result: TestAccountCleanup = {
    users: 0,
    pendingSignUps: 0,
    events: 0,
    counters: 0,
    kept: 0,
  };
  for (const address of addresses) {
    // Checked here again, inside the caller's transaction, and not taken from the summary.
    const madeOn = await originOf(query, address);
    if (madeOn !== null && madeOn !== "laptop") {
      result.kept += 1;
      continue;
    }

    const identifierHash = keyedHash(hmacSecret, "event-identifier", address);
    const counterKeys = ADDRESS_LIMITS.map((name) =>
      keyedHash(hmacSecret, "abuse-limit", `${name}\n${address}`),
    );

    result.events += (
      await query("DELETE FROM auth_events WHERE identifier_hash = $1 RETURNING id", [
        identifierHash,
      ])
    ).length;
    result.counters += (
      await query("DELETE FROM abuse_counters WHERE key = ANY($1::text[]) RETURNING key", [
        counterKeys,
      ])
    ).length;
    result.pendingSignUps += (
      await query("DELETE FROM pending_signups WHERE email = $1 RETURNING id", [address])
    ).length;
    // Sessions, the credential, known devices and the user's own events go with the user.
    result.users += (
      await query("DELETE FROM users WHERE email = $1 RETURNING id", [address])
    ).length;
  }
  return result;
}
