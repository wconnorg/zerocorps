import { after } from "next/server";
import { join } from "node:path";
import { TERMS_VERSION } from "@/config/legal";
import { db } from "@/db/client";
import { env } from "@/env";
import { getCatalog } from "@/lib/academy/catalog";
import type { DiscordConfig } from "@/lib/discord/discord-plugin";
import { parseRoleIds } from "@/lib/discord/role-sync";
import { createAuthMailer } from "@/lib/email/auth-emails";
import { createEmailSender } from "@/lib/email/send-email";
import { createAuth } from "./create-auth";

/**
 * The app's Better Auth instance: `createAuth` wired to the real database, the real
 * environment and the real mailer. Server-only. Tests never import this file; they
 * call `createAuth` themselves with a database inside the test process.
 */

const sendEmail = createEmailSender({
  appEnv: env.APP_ENV,
  from: env.EMAIL_FROM,
  resendApiKey: env.RESEND_API_KEY,
  allowlist: env.EMAIL_ALLOWLIST,
  outboxDir: join(process.cwd(), ".outbox"),
});

/**
 * The site's own Discord application. Linking needs its client id and secret; the Rookie
 * role also needs its bot token, the server's id and the role ids. Anything missing
 * switches that part off, and the settings page says linking is not on yet.
 */
function discordConfig(): DiscordConfig | null {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return null;
  const roleIds = parseRoleIds(env.DISCORD_RANK_ROLE_IDS);
  if (env.DISCORD_RANK_ROLE_IDS && !roleIds) {
    console.error("[discord] DISCORD_RANK_ROLE_IDS is not valid; role sync is off");
  }
  return {
    app: { clientId: env.DISCORD_CLIENT_ID, clientSecret: env.DISCORD_CLIENT_SECRET },
    roles:
      env.DISCORD_BOT_TOKEN && env.DISCORD_GUILD_ID && roleIds
        ? { botToken: env.DISCORD_BOT_TOKEN, guildId: env.DISCORD_GUILD_ID, roleIds }
        : null,
  };
}

export const discordEnabled = Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET);

export const auth = createAuth({
  db,
  baseUrl: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  hmacSecret: env.HMAC_SECRET,
  appEnv: env.APP_ENV,
  signUpMode: env.SIGNUP_MODE,
  signUpAllowlist: env.SIGNUP_ALLOWLIST,
  termsVersion: TERMS_VERSION,
  trustedIpHeader: env.TRUSTED_IP_HEADER,
  mailer: createAuthMailer(sendEmail, {
    baseUrl: env.NEXT_PUBLIC_APP_URL,
    contact: env.SECURITY_CONTACT ?? env.PRIVACY_CONTACT,
  }),
  // Emails go out AFTER the response. `after()` keeps a serverless function alive until
  // the work is done, and works unchanged on a self-hosted Node server. A bare promise
  // that nobody awaits can be frozen when the function returns, and would never send.
  runAfterResponse: (work) => after(work),
  academyCatalog: getCatalog,
  discord: discordConfig(),
});
