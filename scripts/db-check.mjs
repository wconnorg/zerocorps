// npm run db:check
//
// Tests both database URLs in .env.local and reports PASS or FAIL for each, with the
// KIND of failure: the URL does not parse, the host is unreachable, or the password is
// rejected. It never prints a URL, a host, a username or a password. Read-only.
//
// Every connection is verified against the pinned certificates in src/lib/db-ca.ts.
// There is no unverified retry: a certificate that cannot be verified is a FAIL. It also
// says how long each pinned certificate has left, warns under 90 days, and fails once
// one has expired.

import { PINNED_DATABASE_CAS } from "../src/lib/db-ca.ts";
import { diagnoseDatabaseUrl } from "../src/lib/db-url.ts";
import { inspectPinnedCas, WARN_BELOW_DAYS } from "../src/lib/db-tools/ca-status.ts";
import { APP_ROLE } from "../src/lib/db-tools/role-check.ts";
import { connect, explainConnectionError } from "./lib/database.mjs";
import { readEnvFile } from "./lib/env-file.mjs";

const env = readEnvFile();
let failed = false;

const RUNBOOK = '"Database connections fail after Supabase rotates its CA" in docs/SECURITY.md';

function reportPinnedCertificates() {
  console.log("Pinned certificate authorities (the only ones a database connection trusts):");
  for (const ca of inspectPinnedCas(PINNED_DATABASE_CAS, new Date())) {
    const until = ca.validTo.toISOString().slice(0, 10);
    if (ca.state === "expired") {
      failed = true;
      console.log(`  FAIL     ${ca.name}: EXPIRED on ${until}. Runbook: ${RUNBOOK}.`);
    } else if (ca.state === "expiring") {
      console.log(
        `  WARNING  ${ca.name}: only ${ca.daysLeft} days left (under ${WARN_BELOW_DAYS}), until ${until}.`,
      );
      console.log(`           Stage its replacement now. Runbook: ${RUNBOOK}.`);
    } else {
      console.log(`  ok       ${ca.name}: ${ca.daysLeft} days left, until ${until}.`);
    }
  }
}

async function probe(url) {
  const sql = connect(url);
  try {
    const [row] = await sql`
      SELECT current_user::text AS role,
             split_part(current_setting('server_version'), '.', 1) AS major,
             current_setting('transaction_read_only') AS read_only`;
    return row;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function check(key, kind, label) {
  const url = env.get(key);
  console.log(`\n${key}  (${label})`);
  if (url === "") {
    failed = true;
    return console.log("  FAIL  it is blank.");
  }
  const diagnosis = diagnoseDatabaseUrl(url, kind);
  if (!diagnosis.parses) {
    failed = true;
    console.log("  FAIL  the URL does not parse.");
    for (const problem of diagnosis.problems) console.log(`        - ${problem}`);
    return;
  }
  for (const problem of diagnosis.problems) console.log(`  note  ${problem}`);

  let row;
  try {
    row = await probe(url);
  } catch (error) {
    failed = true;
    return console.log(`  FAIL  ${explainConnectionError(error, url)}`);
  }

  console.log(`  PASS  connected as role "${row.role}", Postgres ${row.major}.`);
  console.log("        TLS: encrypted, and VERIFIED against the pinned certificates.");
  if (kind === "app" && row.role !== APP_ROLE) {
    console.log(
      `  note  The app should connect as ${APP_ROLE}, not "${row.role}". That changes after the role walkthrough.`,
    );
  }
  if (kind === "migrations" && row.role === APP_ROLE) {
    failed = true;
    console.log(`  FAIL  migrations need the owner role, but this URL connects as ${APP_ROLE}.`);
  }
}

reportPinnedCertificates();
await check("DATABASE_URL", "app", "what the app uses: transaction pooler, port 6543");
await check(
  "DATABASE_URL_MIGRATIONS",
  "migrations",
  "migrations and backups: session pooler, port 5432",
);

console.log(
  failed
    ? "\nAt least one URL failed. No URL, host or password was printed."
    : "\nBoth URLs work. No URL, host or password was printed.",
);
process.exitCode = failed ? 1 : 0;
