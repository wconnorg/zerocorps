// npm run 2fa:reset -- <username>
//
// Turns two-factor OFF for one member who has lost BOTH their authenticator app and their
// backup codes. Whoever talks you into running this gets past that member's second factor,
// so make sure it really is them first (docs/SECURITY.md, "Turn two-factor off for a
// member"): for example, a message from the Discord account linked to their ZeroCorps
// account, which this command shows you.
//
// It removes the app's secret and the backup codes, forgets every trusted browser and
// signs every session out. Their password, progress and everything else stay. The member
// is emailed that it happened, with links to the live site.

import { join } from "node:path";
import { findResetCandidate, resetTwoFactor } from "../src/lib/db-tools/two-factor-reset.ts";
import { createAuthMailer } from "../src/lib/email/auth-emails.ts";
import { createEmailSender } from "../src/lib/email/send-email.ts";
import { connect, explainConnectionError, queryOf, readDatabaseUrl } from "./lib/database.mjs";
import { readEnvFile, ROOT } from "./lib/env-file.mjs";
import { ask, requireTerminal } from "./lib/prompt.mjs";

const LIVE_SITE = "https://zerocorps.org";

requireTerminal("npm run 2fa:reset");
const env = readEnvFile();
const input = process.argv[2] ?? (await ask("The member's ZeroCorps username: "));

const { url } = readDatabaseUrl("app");
const sql = connect(url);
try {
  const member = await findResetCandidate(queryOf(sql), input);
  if (!member) {
    console.log("No account has that username. Nothing was changed.");
    process.exit(0);
  }
  console.log(`\nThis is the ONE database, so this is the live account:\n`);
  console.log(`  Username       @${member.username}`);
  console.log(`  Email          ${member.maskedEmail}`);
  console.log(`  Member since   ${member.memberSince}`);
  console.log(
    `  Discord        ${member.discordUsername ? `linked as ${member.discordUsername}` : "not linked"}`,
  );
  console.log(`  Two-factor     ${member.twoFactorEnabled ? "ON" : "off"}\n`);
  if (!member.twoFactorEnabled) {
    console.log("Two-factor is already off for this account. Nothing was changed.");
    process.exit(0);
  }

  console.log("Only go on if you are sure this request comes from this member.");
  const phrase = `reset ${member.username}`;
  if (
    (await ask(`Type "${phrase}" to turn two-factor off, or anything else to stop: `)) !== phrase
  ) {
    console.log("Stopped. Nothing was changed.");
    process.exit(0);
  }

  const result = await sql.begin((transaction) =>
    resetTwoFactor(queryOf(transaction), member.userId),
  );
  console.log(
    `\nTwo-factor is off for @${member.username}. Signed out ${result.sessions} session(s) and ` +
      `forgot ${result.trustedBrowsers} trusted browser(s).`,
  );
  console.log("They sign in with their password, then can turn two-factor on again in Settings.");

  // The notice goes to a real member on purpose, so it is sent through the provider even
  // from the laptop. Without a provider key it is not sent, and you are told.
  const resendApiKey = env.get("RESEND_API_KEY") || "";
  if (!resendApiKey) {
    console.log("No email was sent: RESEND_API_KEY is blank in .env.local. Tell them yourself.");
  } else {
    const mailer = createAuthMailer(
      createEmailSender({
        appEnv: "production",
        from: env.get("EMAIL_FROM") || "ZeroCorps <no-reply@zerocorps.org>",
        resendApiKey,
        allowlist: [],
        outboxDir: join(ROOT, ".outbox"),
      }),
      {
        baseUrl: LIVE_SITE,
        contact: env.get("SECURITY_CONTACT") || env.get("PRIVACY_CONTACT") || undefined,
      },
    );
    try {
      await mailer.sendTwoFactorChanged({ to: member.email, change: "reset" });
      console.log(`Emailed ${member.maskedEmail} that it happened.`);
    } catch (error) {
      console.log(
        `The email could not be sent (${error instanceof Error ? error.name : "error"}). Tell them yourself.`,
      );
    }
  }
} catch (error) {
  console.error(`Nothing was changed: ${explainConnectionError(error, url)}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
