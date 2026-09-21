// Reads `.env.local` for the owner's command-line tools.
//
// The rule for every script that uses this: values never reach the screen. Report
// key names and fixed sentences only.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// ZC_ENV_FILE exists so these tools can be tried against a fake file. Leave it unset.
export const ENV_FILE = process.env.ZC_ENV_FILE ?? join(ROOT, ".env.local");

/** Returns the parsed file, or exits with a plain message if there is no file. */
export function readEnvFile() {
  if (!existsSync(ENV_FILE)) {
    console.error("There is no .env.local. Copy .env.example to .env.local first.");
    process.exit(1);
  }
  const text = readFileSync(ENV_FILE, "utf8");
  const values = parseEnv(text);
  return {
    text,
    has: (key) => Object.prototype.hasOwnProperty.call(values, key),
    get: (key) => (values[key] ?? "").trim(),
  };
}

/** True when stdin and stdout are a real terminal, so a person can be asked something. */
export function isInteractive() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/** Replaces every occurrence of the given secrets in a message, as a last line of defence. */
export function scrub(message, secrets) {
  let text = String(message);
  for (const secret of secrets) {
    if (secret && secret.length >= 3) text = text.split(secret).join("[hidden]");
  }
  return text;
}
