// npm run env:check
//
// Says which keys in .env.local are filled, blank or malformed, for the current
// milestone. It prints key names and fixed sentences only: never a value.

import { diagnoseDatabaseUrl } from "../src/lib/db-url.ts";
import { parseEmailList } from "../src/lib/email-address.ts";
import { readEnvFile } from "./lib/env-file.mjs";

const env = readEnvFile();
const rows = [];
let needsWork = false;

function row(key, status, detail = []) {
  if (status !== "ok" && status !== "optional") needsWork = true;
  rows.push({ key, status, detail });
}

function databaseUrl(key, kind, required) {
  if (!env.has(key))
    return row(key, required ? "MISSING" : "optional", ["The key is not in the file."]);
  if (env.get(key) === "")
    return row(key, required ? "BLANK" : "optional", required ? [] : ["Blank."]);
  const result = diagnoseDatabaseUrl(env.get(key), kind);
  if (result.ok) return row(key, "ok", [`Well-formed. Role: ${result.role}.`]);
  row(key, "MALFORMED", result.problems);
}

function secret(key) {
  if (!env.has(key))
    return row(key, "MISSING", ["Run: npm run env:secrets (it adds the key and fills it)"]);
  const value = env.get(key);
  if (value === "") return row(key, "BLANK", ["Run: npm run env:secrets"]);
  if (value.length < 32) return row(key, "MALFORMED", ["Shorter than 32 characters."]);
  row(key, "ok", ["Filled."]);
}

function emailList(key, note) {
  if (!env.has(key)) return row(key, "optional", ["The key is not in the file yet.", note]);
  const list = parseEmailList(env.get(key));
  if (list === null) return row(key, "MALFORMED", ["At least one entry is not an email address."]);
  row(key, list.length === 0 ? "optional" : "ok", [`${list.length} address(es).`, note]);
}

function plain(key, { required = false, check, note } = {}) {
  if (!env.has(key))
    return row(key, required ? "MISSING" : "optional", ["The key is not in the file yet.", note]);
  const value = env.get(key);
  if (value === "") return row(key, required ? "BLANK" : "optional", ["Blank.", note]);
  const problem = check?.(value);
  if (problem) return row(key, "MALFORMED", [problem]);
  row(key, "ok", ["Filled."]);
}

const appUrl = env.get("NEXT_PUBLIC_APP_URL");
row(
  "NEXT_PUBLIC_APP_URL",
  appUrl === "http://localhost:3000" || appUrl === "" ? "ok" : "MALFORMED",
  appUrl === "http://localhost:3000" || appUrl === ""
    ? ["Correct for the laptop."]
    : ["On the laptop this must be exactly http://localhost:3000"],
);
plain("APP_ENV", {
  required: true,
  check: (value) => (value === "local" ? null : "On the laptop this must be: local"),
});
plain("SIGNUP_MODE", {
  check: (value) =>
    ["closed", "allowlist", "open"].includes(value) ? null : "Must be closed, allowlist or open.",
  note: "Blank means closed.",
});
emailList("SIGNUP_ALLOWLIST", "Needed when SIGNUP_MODE is allowlist.");
databaseUrl("DATABASE_URL", "app", true);
databaseUrl("DATABASE_URL_MIGRATIONS", "migrations", false);
plain("BACKUP_DIR", { note: "Blank means ./backups." });
for (const key of ["BETTER_AUTH_SECRET", "HMAC_SECRET", "CRON_SECRET"]) secret(key);

const secrets = ["BETTER_AUTH_SECRET", "HMAC_SECRET", "CRON_SECRET"].map(env.get).filter(Boolean);
if (new Set(secrets).size !== secrets.length) {
  row("(the three secrets)", "MALFORMED", ["Two of them share a value. Each must be different."]);
}

plain("RESEND_API_KEY", {
  check: (value) =>
    value.startsWith("re_") ? null : "Does not look like a Resend key (they start with re_).",
  note: "Blank is fine on the laptop: emails go to the console and the outbox.",
});
plain("EMAIL_FROM", { note: "Blank uses the default sender." });
emailList("EMAIL_ALLOWLIST", "Your own test addresses. Laptop only.");
plain("TRUSTED_IP_HEADER", { note: "Blank means x-forwarded-for." });
for (const key of ["SECURITY_CONTACT", "PRIVACY_CONTACT"]) {
  plain(key, {
    check: (value) =>
      /^(https:\/\/|mailto:)/.test(value) ? null : "Must start with https:// or mailto:",
    note: "Optional on the laptop, required on the live site.",
  });
}
plain("DISCORD_INVITE_URL", {
  check: (value) => (value.startsWith("https://") ? null : "Must start with https://"),
  note: "Optional.",
});
if (env.has("SIGNUPS_OPEN"))
  row("SIGNUPS_OPEN", "REMOVE", ["Replaced by SIGNUP_MODE. Delete this line."]);

const width = Math.max(...rows.map((entry) => entry.key.length));
for (const { key, status, detail } of rows) {
  console.log(`${key.padEnd(width)}  ${status.padEnd(9)}  ${detail.filter(Boolean)[0] ?? ""}`);
  for (const line of detail.filter(Boolean).slice(1))
    console.log(`${" ".repeat(width + 13)}${line}`);
}
console.log(
  needsWork
    ? "\nSome keys need attention (the ones in CAPITALS). No values were printed."
    : "\nEverything milestone 2 needs is in place. No values were printed.",
);
process.exitCode = needsWork ? 1 : 0;
