// npm run env:app-url            rebuild DATABASE_URL, keeping the role password already in it
// npm run env:app-url -- --ask   rebuild it and ask for the role password (hidden)
//
// Builds DATABASE_URL so nobody has to edit a connection string by hand:
//
//   host and project ref   from DATABASE_URL_MIGRATIONS, which `npm run db:check` has proven
//   role                   zerocorps_app
//   port                   6543 (the transaction pooler)
//   password               the one already in DATABASE_URL, or the one you type with --ask
//
// It writes the line into .env.local and shows nothing: no URL, no host, no password.
// Close .env.local in your editor first.

import { writeFileSync } from "node:fs";
import { diagnoseDatabaseUrl } from "../src/lib/db-url.ts";
import { APP_ROLE } from "../src/lib/db-tools/role-check.ts";
import { ENV_FILE, readEnvFile } from "./lib/env-file.mjs";
import { askHidden, requireTerminal } from "./lib/prompt.mjs";

const APP_PORT = "6543";
const askForPassword = process.argv.includes("--ask");

const env = readEnvFile();
const stop = (message) => {
  console.error(message);
  process.exit(1);
};

const migrationsDiagnosis = diagnoseDatabaseUrl(env.get("DATABASE_URL_MIGRATIONS"), "migrations");
if (!migrationsDiagnosis.ok) {
  stop(
    "DATABASE_URL_MIGRATIONS must be correct first, because the host and project ref are taken from it.\n" +
      "Run `npm run db:check` and fix what it reports.",
  );
}
const migrations = new URL(env.get("DATABASE_URL_MIGRATIONS"));
const projectRef = decodeURIComponent(migrations.username).split(".").slice(1).join(".");

let password = "";
if (askForPassword) {
  requireTerminal("npm run env:app-url -- --ask");
  password = await askHidden(`Password of the ${APP_ROLE} role (hidden): `);
  if (!/^[A-Za-z0-9]{16,}$/.test(password)) {
    stop(
      "Use the role's password exactly: 16 or more letters and numbers, nothing else. Nothing was changed.",
    );
  }
} else {
  try {
    password = new URL(env.get("DATABASE_URL")).password;
  } catch {
    password = "";
  }
  if (password === "") {
    stop(
      `DATABASE_URL holds no usable password. Run: npm run env:app-url -- --ask   and type the ${APP_ROLE} password.`,
    );
  }
  if (password === migrations.password) {
    stop(
      `DATABASE_URL still holds the OWNER's password. The ${APP_ROLE} role has its own.\n` +
        "Run: npm run env:app-url -- --ask   and type the role's password.",
    );
  }
}

const rebuilt = `${migrations.protocol}//${APP_ROLE}.${projectRef}:${password}@${migrations.hostname}:${APP_PORT}/postgres`;
if (!diagnoseDatabaseUrl(rebuilt, "app").ok)
  stop("The rebuilt URL did not pass its own check. Nothing was changed.");

if (rebuilt === env.get("DATABASE_URL")) {
  console.log("DATABASE_URL is already correct. Nothing to change.");
  process.exit(0);
}

const newline = env.text.includes("\r\n") ? "\r\n" : "\n";
const lines = env.text.split(/\r?\n/);
// `DATABASE_URL_MIGRATIONS=` does not match: after DATABASE_URL comes "=", not "_".
const index = lines.findIndex((line) => /^\s*DATABASE_URL\s*=/.test(line));
if (index >= 0) lines[index] = `DATABASE_URL=${rebuilt}`;
else {
  if (lines.at(-1) === "") lines.pop();
  lines.push(`DATABASE_URL=${rebuilt}`, "");
}
writeFileSync(ENV_FILE, lines.join(newline));

console.log(
  `DATABASE_URL rebuilt: role ${APP_ROLE}, port ${APP_PORT}, host and project ref copied from the`,
);
console.log(
  `working migrations URL, ${askForPassword ? "the password you typed" : "the role password that was already there"}.`,
);
console.log(
  "Nothing was shown. DATABASE_URL_MIGRATIONS was not touched.\n\nNext: npm run db:check",
);
