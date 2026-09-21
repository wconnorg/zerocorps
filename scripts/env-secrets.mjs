// npm run env:secrets
//
// Fills in the BLANK secrets in .env.local with fresh random values. It never
// replaces a value that is already there, and it never shows a value: only the
// names of the keys it filled.
//
// Save and close .env.local in your editor before running this.

import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { ENV_FILE, readEnvFile } from "./lib/env-file.mjs";

const KEYS = ["BETTER_AUTH_SECRET", "HMAC_SECRET", "CRON_SECRET"];

const env = readEnvFile();
const newline = env.text.includes("\r\n") ? "\r\n" : "\n";
const lines = env.text.split(/\r?\n/);
const filled = [];
const kept = [];

// 32 random bytes as base64url: 43 characters, none of which need quoting in a .env file.
const fresh = () => randomBytes(32).toString("base64url");

for (const key of KEYS) {
  if (env.get(key) !== "") {
    kept.push(key);
    continue;
  }
  const index = lines.findIndex((line) => new RegExp(`^\\s*${key}\\s*=`).test(line));
  if (index >= 0) lines[index] = `${key}=${fresh()}`;
  else {
    if (lines.at(-1) === "") lines.pop();
    lines.push(`${key}=${fresh()}`, "");
  }
  filled.push(key);
}

if (filled.length > 0) writeFileSync(ENV_FILE, lines.join(newline));

for (const key of filled) console.log(`filled   ${key}`);
for (const key of kept) console.log(`kept     ${key} (already set, not touched)`);
console.log(
  filled.length > 0
    ? "\nDone. The values were written to .env.local and not shown. The live site needs its OWN, different values in Vercel."
    : "\nNothing to do.",
);
