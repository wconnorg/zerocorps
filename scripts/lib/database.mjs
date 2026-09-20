// Opens a connection for the owner's database commands, and explains a failed one
// without ever showing the URL.

import postgres from "postgres";
import { diagnoseDatabaseUrl } from "../../src/lib/db-url.ts";
import { readEnvFile, scrub } from "./env-file.mjs";

const TLS_CERTIFICATE_ERRORS = new Set([
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_GET_ISSUER_CERT",
  "CERT_UNTRUSTED",
]);

export const isCertificateError = (error) => TLS_CERTIFICATE_ERRORS.has(error?.code);

/**
 * Reads one database URL from .env.local. Exits with fixed sentences if it is blank
 * or cannot be parsed. `kind` is "app" (DATABASE_URL) or "migrations".
 */
export function readDatabaseUrl(kind) {
  const key = kind === "app" ? "DATABASE_URL" : "DATABASE_URL_MIGRATIONS";
  const url = readEnvFile().get(key);
  const diagnosis = diagnoseDatabaseUrl(url, kind);
  if (!diagnosis.parses) {
    console.error(`${key} cannot be used:`);
    for (const problem of diagnosis.problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  return { key, url, diagnosis };
}

/**
 * One connection, closed by the caller. `prepare: false` because the transaction
 * pooler does not support prepared statements. TLS is always on.
 */
export function connect(url, { verifyCertificate = false } = {}) {
  return postgres(url, {
    max: 1,
    prepare: false,
    ssl: verifyCertificate ? "verify-full" : "require",
    connect_timeout: 20,
    idle_timeout: 5,
    onnotice: () => {},
  });
}

/** The one-function interface the tested modules in src/lib use. */
export const queryOf = (sql) => (text, params) => sql.unsafe(text, params ?? []);

class RollBack extends Error {}

/** Runs one statement in a transaction that is ALWAYS rolled back. */
export const attemptAndRollBackOn = (sql) => async (statement) => {
  let outcome = { allowed: false, code: undefined };
  try {
    await sql.begin(async (transaction) => {
      try {
        await transaction.unsafe(statement);
        outcome = { allowed: true, code: undefined };
      } catch (error) {
        outcome = { allowed: false, code: error?.code };
      }
      throw new RollBack();
    });
  } catch (error) {
    if (!(error instanceof RollBack)) throw error;
  }
  return outcome;
};

/** Turns a connection error into the kind of failure, in fixed words. */
export function explainConnectionError(error, url) {
  const code = String(error?.code ?? "");
  const parsed = new URL(url);
  const hidden = [
    url,
    parsed.password,
    decodeURIComponent(parsed.password),
    parsed.username,
    decodeURIComponent(parsed.username),
    parsed.hostname,
  ];
  const message = scrub(error?.message ?? "", hidden);

  if (["ENOTFOUND", "EAI_AGAIN"].includes(code)) {
    return "the host is unreachable: its name does not resolve. Check the host part of the URL, and your internet connection.";
  }
  if (
    [
      "ECONNREFUSED",
      "ETIMEDOUT",
      "ECONNRESET",
      "EHOSTUNREACH",
      "ENETUNREACH",
      "CONNECT_TIMEOUT",
    ].includes(code)
  ) {
    return "the host is unreachable: no answer on that host and port. If the Supabase project is paused, restore it in the dashboard first.";
  }
  if (code === "28P01" || /password authentication failed/i.test(message)) {
    return "the password is rejected. Re-copy it, or reset it to letters and numbers only and update both URLs.";
  }
  if (/tenant or user not found/i.test(message)) {
    return "the pooler does not know this user. Check the username: role.projectref, with the project ref copied exactly.";
  }
  if (code === "28000")
    return "the role is not allowed to log in. For zerocorps_app: has its password been set yet?";
  if (code === "3D000")
    return "the database name at the end of the URL does not exist. It should be /postgres.";
  if (code === "53300")
    return "the database has no free connections right now. Wait a minute and try again.";
  if (isCertificateError(error)) return "the server's TLS certificate could not be verified.";
  return `unexpected error (code ${code || "none"}): ${message || "no message"}`;
}
