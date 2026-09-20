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

export type TestAccountSummary = { address: string; hasAccount: boolean; pendingSignUps: number }[];

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
    summary.push({ address, hasAccount: Number(user?.n) > 0, pendingSignUps: Number(pending?.n) });
  }
  return summary;
}

export type TestAccountCleanup = {
  users: number;
  pendingSignUps: number;
  events: number;
  counters: number;
};

/** The caller supplies the transaction, so it is all or nothing. */
export async function deleteTestAccounts(
  query: Query,
  addresses: readonly string[],
  hmacSecret: string,
): Promise<TestAccountCleanup> {
  const result: TestAccountCleanup = { users: 0, pendingSignUps: 0, events: 0, counters: 0 };
  for (const address of addresses) {
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
