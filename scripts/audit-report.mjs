// npm run audit:report
//
// Reports known vulnerabilities in the dependencies. It is a REPORT: it never fails
// the build and never changes anything. Nothing here is ever "fixed" automatically;
// an upgrade is a decision, made on purpose.

import { execSync } from "node:child_process";

let report;
try {
  report = execSync("npm audit --json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
} catch (error) {
  // npm exits non-zero when it finds something; the JSON is still on stdout.
  report = error.stdout;
}

let parsed;
try {
  parsed = JSON.parse(report);
} catch {
  console.log("audit: could not reach the npm registry, so no report this time.");
  process.exit(0);
}

const counts = parsed.metadata?.vulnerabilities ?? {};
const total = counts.total ?? 0;
if (total === 0) {
  console.log("audit: no known vulnerabilities.");
  process.exit(0);
}

console.log(
  `audit: ${total} known issue(s): ${["critical", "high", "moderate", "low"]
    .filter((level) => counts[level] > 0)
    .map((level) => `${counts[level]} ${level}`)
    .join(", ")}.`,
);
for (const [name, entry] of Object.entries(parsed.vulnerabilities ?? {})) {
  const advisories = (entry.via ?? [])
    .filter((via) => typeof via === "object")
    .map((via) => via.title);
  const chain = (entry.via ?? []).filter((via) => typeof via === "string");
  console.log(
    `  ${entry.severity.padEnd(8)} ${name}${advisories.length ? `: ${advisories.join("; ")}` : ` (through ${chain.join(", ")})`}`,
  );
}
console.log(
  "audit: this is a report only. Run `npm audit` for the details. Nothing is auto-fixed.",
);
