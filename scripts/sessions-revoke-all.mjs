// npm run sessions:revoke-all
//
// Signs EVERYONE out, at once. Sessions are rows in the database, so deleting them takes
// effect on the very next request. Use it when a session secret or a laptop may have
// been compromised (docs/SECURITY.md, "Revoke every session").
//
// Nobody loses anything but their sign-in: accounts, passwords and progress stay. Known
// devices are forgotten too, so every next sign-in sends a new-device alert.

import { connect, explainConnectionError, readDatabaseUrl } from "./lib/database.mjs";
import { ask, requireTerminal } from "./lib/prompt.mjs";

requireTerminal("npm run sessions:revoke-all");
const { url } = readDatabaseUrl("app");
const sql = connect(url);
try {
  const [{ sessions }] = await sql`SELECT count(*)::int AS sessions FROM sessions`;
  console.log(
    `This is the ONE database, so this signs out the live site. Sessions right now: ${sessions}.`,
  );

  const phrase = `revoke ${sessions}`;
  if ((await ask(`Type "${phrase}" to sign everyone out, or anything else to stop: `)) !== phrase) {
    console.log("Stopped. Nothing was changed.");
    process.exit(0);
  }

  const [removedSessions, removedDevices] = await sql.begin(async (transaction) => [
    (await transaction`DELETE FROM sessions RETURNING id`).length,
    (await transaction`DELETE FROM known_devices RETURNING id`).length,
  ]);
  console.log(
    `\nRevoked ${removedSessions} session(s) and forgot ${removedDevices} known device(s).`,
  );
  console.log(
    "If BETTER_AUTH_SECRET itself may have leaked, rotate it as well (docs/SECURITY.md).",
  );
} catch (error) {
  console.error(`Nothing was changed: ${explainConnectionError(error, url)}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
