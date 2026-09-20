// npm run db:check-role
//
// Proves that the role in DATABASE_URL (zerocorps_app) cannot create, alter or drop
// anything, holds no special attribute, and can read nothing outside the app's tables.
// With one database shared by the laptop and the live site, this role is the main
// protection against a destructive mistake.
//
// It reads Postgres's privilege catalogue and makes ONE live attempt, a CREATE TABLE
// inside a transaction that is always rolled back. It changes nothing.

import { checkAppRole } from "../src/lib/db-tools/role-check.ts";
import {
  attemptAndRollBackOn,
  connect,
  explainConnectionError,
  queryOf,
  readDatabaseUrl,
} from "./lib/database.mjs";

const { url } = readDatabaseUrl("app");
const sql = connect(url);
const MARK = { pass: "PASS  ", fail: "FAIL  ", review: "REVIEW", info: "info  " };

try {
  const lines = await checkAppRole({
    query: queryOf(sql),
    attemptAndRollBack: attemptAndRollBackOn(sql),
  });
  for (const line of lines) {
    console.log(`${MARK[line.status]}  ${line.label}`);
    if (line.detail) console.log(`          ${line.detail}`);
  }
  const failed = lines.filter((line) => line.status === "fail").length;
  const review = lines.filter((line) => line.status === "review").length;
  console.log(
    failed > 0
      ? `\n${failed} check(s) FAILED. The role is not safe to use yet.`
      : review > 0
        ? "\nNo failures. The REVIEW line lists object names to look over once; nothing was read from them."
        : "\nAll checks passed: this role cannot create, alter or drop, and sees only the app's tables.",
  );
  process.exitCode = failed > 0 ? 1 : 0;
} catch (error) {
  console.error(`Could not run the check: ${explainConnectionError(error, url)}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
