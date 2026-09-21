// npm run db:cleanup-test-accounts
//
// Removes YOUR test accounts: the addresses in EMAIL_ALLOWLIST, and nothing else.
//
// There is one database, shared by the laptop and the live site, so an account made
// while testing on the laptop is a real account on the live site too. This removes each
// listed address's account (with its sessions, password, known devices and events), any
// sign-up still waiting for a code, and its limit counters. Addresses are matched
// exactly, never by pattern.
//
// Do NOT put the address of an account you want to keep into EMAIL_ALLOWLIST.

import { parseEmailList } from "../src/lib/email-address.ts";
import { deleteTestAccounts, findTestAccounts } from "../src/lib/db-tools/test-accounts.ts";
import { connect, explainConnectionError, queryOf, readDatabaseUrl } from "./lib/database.mjs";
import { readEnvFile } from "./lib/env-file.mjs";
import { ask, requireTerminal } from "./lib/prompt.mjs";

requireTerminal("npm run db:cleanup-test-accounts");
const env = readEnvFile();
const addresses = parseEmailList(env.get("EMAIL_ALLOWLIST"));
if (addresses === null || addresses.length === 0) {
  console.error(
    "EMAIL_ALLOWLIST is empty or malformed. It lists the test addresses this command removes.",
  );
  process.exit(1);
}
if (env.get("HMAC_SECRET") === "") {
  console.error(
    "HMAC_SECRET is blank. It is needed to find the events and counters of these addresses.",
  );
  process.exit(1);
}

const { url } = readDatabaseUrl("app");
const sql = connect(url);
try {
  const found = await findTestAccounts(queryOf(sql), addresses);
  console.log("EMAIL_ALLOWLIST holds these test addresses:\n");
  for (const entry of found) {
    const account = !entry.hasAccount
      ? "no account"
      : entry.madeOn === "laptop"
        ? "has an account (made on the laptop)"
        : entry.madeOn === "live-site"
          ? "has an account made on the LIVE SITE: it will be KEPT"
          : "has an account of unknown origin: it will be KEPT";
    const state = [account, `${entry.pendingSignUps} sign-up(s) waiting`];
    console.log(`  ${entry.address.padEnd(40)} ${state.join(", ")}`);
  }
  // Only accounts made on the laptop are ever deleted.
  const accounts = found.filter((entry) => entry.hasAccount && entry.madeOn === "laptop").length;
  console.log(
    `\nThis is the ONE database. ${accounts} account(s) would be deleted, for good, on the live site too.`,
  );

  const phrase = `delete ${accounts}`;
  if ((await ask(`Type "${phrase}" to go ahead, or anything else to stop: `)) !== phrase) {
    console.log("Stopped. Nothing was changed.");
    process.exit(0);
  }

  const removed = await sql.begin((transaction) =>
    deleteTestAccounts(queryOf(transaction), addresses, env.get("HMAC_SECRET")),
  );
  console.log(
    `\nRemoved ${removed.users} account(s), ${removed.pendingSignUps} waiting sign-up(s), ` +
      `${removed.events} event(s) and ${removed.counters} limit counter(s).`,
  );
  if (removed.kept > 0) {
    console.log(
      `Kept ${removed.kept} account(s) that were not made on the laptop, with everything about them.`,
    );
  }
} catch (error) {
  console.error(`Nothing was changed: ${explainConnectionError(error, url)}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
