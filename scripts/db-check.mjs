// npm run db:check
//
// Tests both database URLs in .env.local and reports PASS or FAIL for each, with the
// KIND of failure: the URL does not parse, the host is unreachable, or the password is
// rejected. It never prints a URL, a host, a username or a password. Read-only.

import { diagnoseDatabaseUrl } from "../src/lib/db-url.ts";
import { APP_ROLE } from "../src/lib/db-tools/role-check.ts";
import { connect, explainConnectionError, isCertificateError } from "./lib/database.mjs";
import { readEnvFile } from "./lib/env-file.mjs";

const env = readEnvFile();
let failed = false;

async function probe(url, verifyCertificate) {
  const sql = connect(url, { verifyCertificate });
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
  let certificate = "verified against the public certificate authorities";
  try {
    row = await probe(url, true);
  } catch (error) {
    if (!isCertificateError(error)) {
      failed = true;
      return console.log(`  FAIL  ${explainConnectionError(error, url)}`);
    }
    certificate =
      "ENCRYPTED, but the server's certificate is NOT verifiable with public authorities";
    try {
      row = await probe(url, false);
    } catch (second) {
      failed = true;
      return console.log(`  FAIL  ${explainConnectionError(second, url)}`);
    }
  }

  console.log(`  PASS  connected as role "${row.role}", Postgres ${row.major}.`);
  console.log(`        TLS: ${certificate}.`);
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
