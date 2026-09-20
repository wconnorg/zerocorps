import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { authSchema } from "../../db/schema.ts";

/**
 * Builds the Better Auth instance from explicit dependencies.
 *
 * It takes everything it needs as arguments and reads no environment variable, so
 * the tests can run the real configuration against a Postgres inside the test
 * process (PGlite). `src/lib/auth/index.ts` is the only place that wires it to the
 * real database and the real environment.
 *
 * Settings that look unusual are explained in docs/DECISIONS.md under "Better Auth
 * findings that shape the design"; the numbers in the comments refer to them.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any Drizzle Postgres driver (postgres.js in the app, PGlite in tests)
export type AuthDatabase = PgDatabase<PgQueryResultHKT, any, any>;

/** The emails the auth layer sends. The app passes real senders; tests pass recorders. */
export type AuthMailer = {
  sendPasswordReset(message: { to: string; url: string }): Promise<void>;
  sendPasswordChanged(message: { to: string }): Promise<void>;
};

export type AuthDeps = {
  db: AuthDatabase;
  /** The site's origin. It is the base URL and the only trusted origin. */
  baseUrl: string;
  secret: string;
  /** The request header the host sets with the client IP, for example `x-forwarded-for`. */
  trustedIpHeader: string;
  mailer: AuthMailer;
  /**
   * Runs work after the response has been sent. The app passes Next's `after()`, which
   * also works when self-hosted. A bare promise nobody awaits can be frozen when a
   * serverless function returns, and the email would never be sent.
   */
  runAfterResponse?: (work: Promise<unknown>) => void;
};

const DAY = 60 * 60 * 24;

/**
 * Endpoints this milestone does not use. They are switched off and re-enabled in the
 * milestone that needs them. `disabledPaths` only covers HTTP (18), which is why the
 * stock sign-up is ALSO switched off with `disableSignUp` below.
 */
const DISABLED_PATHS = [
  // Replaced by the email-code sign-up. A stock sign-up writes the first person's
  // password before any code is checked (8, 15).
  "/sign-up/email",
  "/verify-email",
  "/send-verification-email",
  // Never: accounts are email + password only (hard rules 1 and 2).
  "/sign-in/social",
  "/link-social",
  "/unlink-account",
  "/list-accounts",
  "/account-info",
  "/get-access-token",
  "/refresh-token",
  // Milestone 4 (settings). Change-email asks for no password (20), so it comes back
  // only behind our own password check.
  "/change-email",
  "/change-password",
  "/update-user",
  "/update-session",
  "/delete-user",
  "/delete-user/callback",
  "/list-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
];

export function createAuth(deps: AuthDeps) {
  return betterAuth({
    appName: "ZeroCorps",
    baseURL: deps.baseUrl,
    basePath: "/api/auth",
    secret: deps.secret,
    trustedOrigins: [deps.baseUrl],

    database: drizzleAdapter(deps.db, {
      provider: "pg",
      schema: authSchema,
      // Off by default, and then "one transaction" silently runs step by step (19).
      transaction: true,
    }),

    user: {
      fields: { name: "displayName", image: "avatarUrl" },
      additionalFields: {
        termsAcceptedAt: { type: "date", required: false, input: false },
        termsVersion: { type: "string", required: false, input: false },
      },
    },

    emailAndPassword: {
      enabled: true,
      // The stock sign-up is off for server-side calls too (18). Accounts are created
      // only by the email-code plugin, already verified.
      disableSignUp: true,
      // A backstop: every account is created verified, so this never fires.
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      // Off by default (11). A completed reset signs out every session.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        // Our own page takes the token; the token is single-use (24).
        const url = `${deps.baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
        await deps.mailer.sendPasswordReset({ to: user.email, url });
      },
      onPasswordReset: async ({ user }) => {
        await deps.mailer.sendPasswordChanged({ to: user.email });
      },
    },

    session: {
      expiresIn: 30 * DAY,
      // Rolling: the expiry moves forward at most once a day.
      updateAge: DAY,
    },

    rateLimit: {
      // On by default only in production (21); the laptop should behave the same.
      enabled: true,
      // Memory storage is per server instance, so it limits nothing on serverless (13).
      storage: "database",
      window: 60,
      max: 100,
      // Per IP and path, and deliberately loose: shared addresses (VPNs, carriers,
      // campuses) are normal. The tight limits are per email address, in our own code.
      customRules: {
        "/sign-in/email": { window: 60, max: 30 },
        "/request-password-reset": { window: 60, max: 10 },
        "/reset-password": { window: 60, max: 10 },
      },
    },

    advanced: {
      cookiePrefix: "zc",
      // Both are spelled out on purpose. Left unset, Better Auth turns the origin AND
      // the CSRF check off by itself whenever NODE_ENV is "test" (25). Explicit values
      // mean the tests run against the real checks, and no environment can switch them off.
      disableOriginCheck: false,
      disableCSRFCheck: false,
      database: { generateId: "uuid" },
      ipAddress: {
        ipAddressHeaders: [deps.trustedIpHeader],
        // Never `disableIpTracking`: with it, a request without an IP skips the limiter (21).
      },
      ...(deps.runAfterResponse ? { backgroundTasks: { handler: deps.runAfterResponse } } : {}),
    },

    disabledPaths: DISABLED_PATHS,
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;
