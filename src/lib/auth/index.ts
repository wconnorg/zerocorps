import { after } from "next/server";
import { join } from "node:path";
import { TERMS_VERSION } from "@/config/legal";
import { db } from "@/db/client";
import { env } from "@/env";
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
  mailer: createAuthMailer(sendEmail, { baseUrl: env.NEXT_PUBLIC_APP_URL }),
  // Emails go out AFTER the response. `after()` keeps a serverless function alive until
  // the work is done, and works unchanged on a self-hosted Node server. A bare promise
  // that nobody awaits can be frozen when the function returns, and would never send.
  runAfterResponse: (work) => after(work),
});
