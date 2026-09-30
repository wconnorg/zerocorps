import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api";
import { eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { authSchema, knownDevices } from "../../db/schema.ts";
import { academyPlugin } from "../academy/academy-plugin.ts";
import type { Catalog } from "../academy/content.ts";
import { readProgress } from "../academy/progress.ts";
import { rankKeyOf } from "../academy/standing.ts";
import {
  createRankSync,
  createRoleRemoval,
  type DiscordConfig,
  discordPlugin,
} from "../discord/discord-plugin.ts";
import { accountPlugin } from "./account-plugin.ts";
import { looksLikeEmail, normalizeEmail } from "../email-address.ts";
import { clientIp, coarseIpPrefix, userAgentFamily } from "./client-info.ts";
import { profilePlugin } from "./profile-plugin.ts";
import { emailChangePlugin, type EmailChangeMailer } from "./email-change.ts";
import { emailCodeSignUp, type SignUpMailer, type SignUpMode } from "./email-code-signup.ts";
import { createEventLog } from "./events.ts";
import { ensureDeviceToken } from "./known-device.ts";
import { createEmailBudget, createLimiter } from "./limits.ts";
import {
  forgetTrustedDevices,
  pendingTwoFactorUserId,
  twoFactorPlugin,
  type TwoFactorChange,
  type TwoFactorMailer,
} from "./two-factor.ts";

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
export type AuthMailer = SignUpMailer &
  EmailChangeMailer &
  TwoFactorMailer & {
    sendPasswordReset(message: { to: string; url: string }): Promise<void>;
    sendPasswordChanged(message: { to: string }): Promise<void>;
    sendNewDevice(message: {
      to: string;
      when: Date;
      device: string;
      resetUrl: string;
    }): Promise<void>;
  };

export type AuthDeps = {
  db: AuthDatabase;
  /** The site's origin. It is the base URL and the only trusted origin. */
  baseUrl: string;
  secret: string;
  /** Keys the hashes of sign-up codes, limit identifiers and event-log entries. Not the auth secret. */
  hmacSecret: string;
  /** Which side is running: recorded on every event, because both sides share one database. */
  appEnv: "local" | "production";
  signUpMode: SignUpMode;
  /** Normalised addresses that may sign up while the mode is "allowlist". */
  signUpAllowlist: readonly string[];
  termsVersion: string;
  /** The request header the host sets with the client IP, for example `x-forwarded-for`. */
  trustedIpHeader: string;
  mailer: AuthMailer;
  /**
   * Runs work after the response has been sent. The app passes Next's `after()`, which
   * also works when self-hosted. A bare promise nobody awaits can be frozen when a
   * serverless function returns, and the email would never be sent.
   */
  runAfterResponse?: (work: Promise<unknown>) => void;
  /**
   * The Academy's lessons, read from `content/academy/`. A function, so the laptop sees a
   * lesson the owner has just edited. Without it the Academy has no lessons to complete.
   */
  academyCatalog?: () => Catalog;
  /**
   * The site's Discord application, for linking (milestone 6) and the rank role. Null or
   * absent: "Link Discord" says it is not switched on yet.
   */
  discord?: DiscordConfig | null;
};

const DAY = 60 * 60 * 24;

const NO_LESSONS: Catalog = { courses: [], chapters: new Map(), lessons: new Map() };

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
  // Change-email asks for no password and works by links on /verify-email (20): our own
  // /account/email/* (email-change.ts) replaces it, with the password and an emailed code.
  // The rest are replaced by our own reads of the member's sessions, which never send a
  // session token to the browser.
  // (Milestone 4 switched on /change-password, /delete-user and /revoke-other-sessions,
  // each behind the checks in `hooks.before`.)
  "/change-email",
  "/update-user",
  "/update-session",
  // Deleting by an emailed link: never. Deleting needs the password, every time.
  "/delete-user/callback",
  "/list-sessions",
  "/revoke-session",
  "/revoke-sessions",
  // Two-factor is app codes only (milestone 5): nothing is ever texted or emailed as a
  // code, so the plugin's code-sending pair stays off. The app's secret is shown once, at
  // set-up, and never again, not even with the password.
  "/two-factor/send-otp",
  "/two-factor/verify-otp",
  "/two-factor/get-totp-uri",
];

/** Requests that check the member's password while signed in: each is counted per member. */
const PASSWORD_CHECKED = new Set([
  "/change-password",
  "/delete-user",
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/generate-backup-codes",
]);

/** The requests that sign someone in: the password, then, with two-factor on, the code. */
const SIGN_IN_PATHS = new Set([
  "/sign-in/email",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
]);

const isTwoFactorRedirect = (returned: unknown) =>
  typeof returned === "object" &&
  returned !== null &&
  (returned as { twoFactorRedirect?: unknown }).twoFactorRedirect === true;

export function createAuth(deps: AuthDeps) {
  const { db } = deps;
  /** A member's rank key from the steps stored for them: what Discord's roles follow. */
  const rankOf = async (userId: string) => rankKeyOf((await readProgress(db, userId)).steps);
  const removeDiscordRoles = createRoleRemoval({ db, discord: deps.discord ?? null });
  const limiter = createLimiter(db, deps.hmacSecret);
  const emailBudget = createEmailBudget(limiter);
  const events = createEventLog(db, {
    appEnv: deps.appEnv,
    hmacSecret: deps.hmacSecret,
    trustedIpHeader: deps.trustedIpHeader,
  });

  const tooManyRequests = (retryAfterSeconds: number) =>
    new APIError("TOO_MANY_REQUESTS", {
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Please wait a while and try again.",
      retryAfterSeconds,
    });

  /** Sends one email unless the daily cap holds it back, and never lets a send error escape. */
  async function deliver(
    address: string,
    kind: Parameters<typeof emailBudget.allow>[1],
    send: () => Promise<void>,
  ) {
    if (!(await emailBudget.allow(address, kind))) {
      await events.record({ type: "rate_limited", identifier: address, detail: "emails_per_day" });
      return;
    }
    try {
      await send();
    } catch (error) {
      console.error(
        `[auth] a ${kind} email could not be sent: ${error instanceof Error ? error.name : "error"}`,
      );
      await events.record({ type: "email_failed", identifier: address, detail: kind });
    }
  }

  /** Better Auth's request context, as far as sending after the response goes. */
  type Background = { context: { runInBackgroundOrAwait: (work: Promise<void>) => unknown } };

  /** A two-factor security notice, sent after the response like the other notices. */
  const notifyTwoFactor = (ctx: Background, to: string, change: TwoFactorChange) =>
    ctx.context.runInBackgroundOrAwait(
      deliver(to, "two-factor-changed", () => deps.mailer.sendTwoFactorChanged({ to, change })),
    );

  /**
   * A sign-in is complete: after the password alone, or after the password AND the code
   * when two-factor is on. Records it, and alerts the member if this browser is new.
   */
  async function completeSignIn(
    ctx: Parameters<typeof ensureDeviceToken>[0] & Background,
    user: { id: string; email: string },
    headers: Headers | null,
  ) {
    await events.record({ type: "signin_succeeded", userId: user.id, headers });

    // One statement decides whether this browser is new, so two sign-ins at once
    // cannot both send the alert.
    const device = ensureDeviceToken(ctx);
    const family = userAgentFamily(headers?.get("user-agent"));
    const added = await db
      .insert(knownDevices)
      .values({ userId: user.id, deviceHash: device.hash, userAgent: family })
      .onConflictDoUpdate({
        target: [knownDevices.userId, knownDevices.deviceHash],
        set: { lastSeenAt: sql`now()` },
      })
      .returning({
        firstSeenAt: knownDevices.firstSeenAt,
        lastSeenAt: knownDevices.lastSeenAt,
      });
    const isNew =
      added[0] !== undefined && added[0].firstSeenAt.getTime() === added[0].lastSeenAt.getTime();
    if (!isNew) return;

    await events.record({ type: "new_device", userId: user.id, headers });
    await ctx.context.runInBackgroundOrAwait(
      deliver(user.email, "new-device", () =>
        deps.mailer.sendNewDevice({
          to: user.email,
          when: new Date(),
          device: family ?? "an unknown browser",
          resetUrl: `${deps.baseUrl}/forgot-password`,
        }),
      ),
    );
  }

  /**
   * Runs AFTER the two-factor plugin's own hook, because Better Auth runs `hooks.after`
   * first and plugin hooks in plugin order. By then a correct password with two-factor on
   * has had its session taken back, so a password alone is never counted as a sign-in,
   * never marks a browser as known and never sends the new-browser alert.
   */
  const signInCompletion = {
    id: "zerocorps-sign-in",
    hooks: {
      after: [
        {
          matcher: (context: { path?: string }) => SIGN_IN_PATHS.has(context.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const headers = ctx.headers ?? ctx.request?.headers ?? null;
            const returned = ctx.context.returned;
            const failed = isAPIError(returned);
            const fresh = ctx.context.newSession;

            if (ctx.path === "/sign-in/email") {
              if (fresh) return completeSignIn(ctx, fresh.user, headers);
              const email =
                typeof ctx.body?.email === "string" ? normalizeEmail(ctx.body.email) : null;
              if (!failed && isTwoFactorRedirect(returned)) {
                // The password was right; the code screen comes next. Not a sign-in yet.
                await events.record({ type: "two_factor_challenged", identifier: email, headers });
                return;
              }
              const detail = failed
                ? String(returned.body?.code ?? returned.status).toLowerCase()
                : "failed";
              await events.record({ type: "signin_failed", identifier: email, headers, detail });
              return;
            }

            // The code screen. A member who is already signed in is setting two-factor up
            // (the first code from the app), which the main hook handles: not a sign-in.
            if (ctx.context.session) return;
            if (failed || !fresh) {
              const detail = failed
                ? String(returned.body?.code ?? returned.status).toLowerCase()
                : "failed";
              await events.record({
                type: "two_factor_failed",
                userId: await pendingTwoFactorUserId(ctx),
                headers,
                detail,
              });
              return;
            }
            await completeSignIn(ctx, fresh.user, headers);
            if (ctx.path === "/two-factor/verify-backup-code") {
              await events.record({ type: "backup_code_used", userId: fresh.user.id, headers });
              await notifyTwoFactor(ctx, fresh.user.email, "backup-code-used");
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;

  return betterAuth({
    appName: "ZeroCorps",
    baseURL: deps.baseUrl,
    basePath: "/api/auth",
    secret: deps.secret,
    trustedOrigins: [deps.baseUrl],

    database: drizzleAdapter(db, {
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
        // `input: false`: nothing a client sends can set it. A name is only ever written
        // by `setUsername`, which holds the rules, the hold and the wait.
        username: { type: "string", required: false, input: false },
      },
      // Milestone 4: a member can delete their own account, with their password (the
      // check is in `hooks.before`). Everything tied to the account goes with it (ON
      // DELETE CASCADE); their Discord role is taken back first.
      deleteUser: {
        enabled: true,
        beforeDelete: async (user, request) => {
          await removeDiscordRoles(user.id);
          // Kept without the member's id, so the record outlives the account's own rows:
          // only a keyed hash of the address, as for every event.
          await events.record({
            type: "account_deleted",
            identifier: user.email,
            headers: request?.headers ?? null,
          });
        },
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
        await deliver(user.email, "password-reset", () =>
          deps.mailer.sendPasswordReset({ to: user.email, url }),
        );
      },
      onPasswordReset: async ({ user }) => {
        // Whoever reset the password may not be whoever used those browsers: forget them
        // all, so the next sign-in from each one raises an alert again, and asks for the
        // two-factor code again where the member had ticked "trust this device".
        await db.delete(knownDevices).where(eq(knownDevices.userId, user.id));
        await forgetTrustedDevices(db, user.id);
        await events.record({ type: "reset_completed", userId: user.id });
        await deliver(user.email, "password-changed", () =>
          deps.mailer.sendPasswordChanged({ to: user.email }),
        );
      },
    },

    session: {
      expiresIn: 30 * DAY,
      // Rolling: the expiry moves forward at most once a day.
      updateAge: DAY,
    },

    databaseHooks: {
      session: {
        create: {
          // Better Auth would store the raw IP and the full User-Agent (22). Store a coarse
          // prefix and a browser family instead: enough for "was this you?", no more.
          before: async (session) => ({
            data: {
              ...session,
              ipAddress: coarseIpPrefix(session.ipAddress ?? null),
              userAgent: userAgentFamily(session.userAgent),
            },
          }),
        },
      },
    },

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const headers = ctx.headers ?? ctx.request?.headers ?? null;
        const rawEmail = typeof ctx.body?.email === "string" ? normalizeEmail(ctx.body.email) : "";
        // A malformed address gets Better Auth's own validation error; it is not counted.
        const email = looksLikeEmail(rawEmail) ? rawEmail : null;
        const ip = clientIp(headers, deps.trustedIpHeader) ?? "no-ip";

        if (ctx.path === "/sign-in/email" && email) {
          // Counted per attempt, not per failure: simpler, and a person rarely signs in
          // ten times in a quarter of an hour. Never by IP alone.
          const pair = await limiter.hit("signInPerAddressAndIp", `${email}\n${ip}`);
          const address = await limiter.hit("signInPerAddress", email);
          if (!pair.allowed || !address.allowed) {
            await events.record({
              type: "rate_limited",
              identifier: email,
              headers,
              detail: "signin",
            });
            throw tooManyRequests((pair.allowed ? address : pair).retryAfterSeconds);
          }
        }

        // Milestones 4 and 5. Changing the password, deleting the account and every
        // two-factor change check the member's password; all are counted per member, so a
        // stolen session cannot guess its way to it. Deleting ALWAYS needs the password
        // (Better Auth would otherwise accept a recent session alone, or an emailed token),
        // and a new password always signs out every other device.
        if (PASSWORD_CHECKED.has(ctx.path)) {
          const session = await getSessionFromCtx(ctx);
          if (session) {
            // App codes only: the plugin would refuse "otp" too, as nothing can send one.
            if (
              ctx.path === "/two-factor/enable" &&
              ctx.body?.method !== undefined &&
              ctx.body.method !== "totp"
            ) {
              throw new APIError("BAD_REQUEST", {
                code: "APP_CODES_ONLY",
                message: "Two-factor uses an authenticator app.",
              });
            }
            if (
              ctx.path === "/delete-user" &&
              (typeof ctx.body?.password !== "string" ||
                ctx.body.password.length === 0 ||
                ctx.body?.token !== undefined)
            ) {
              throw new APIError("BAD_REQUEST", {
                code: "PASSWORD_REQUIRED",
                message: "Enter your password to delete your account.",
              });
            }
            if (ctx.path === "/change-password" && ctx.body?.revokeOtherSessions !== true) {
              throw new APIError("BAD_REQUEST", {
                code: "REVOKE_REQUIRED",
                message: "A new password signs out your other devices.",
              });
            }
            const limit = await limiter.hit("passwordCheckPerUser", session.user.id);
            if (!limit.allowed) {
              await events.record({
                type: "rate_limited",
                userId: session.user.id,
                headers,
                detail: "password_check",
              });
              throw tooManyRequests(limit.retryAfterSeconds);
            }
          }
        }

        // Backup codes are for signing in. A signed-in session has no use for them, and
        // must not be able to try them outside the lock that counts guesses at sign-in;
        // nor may one be used up without signing in (the plugin's `disableSession`).
        if (
          ctx.path === "/two-factor/verify-backup-code" &&
          (ctx.body?.disableSession !== undefined || (await getSessionFromCtx(ctx)))
        ) {
          throw new APIError("BAD_REQUEST", {
            code: "BACKUP_CODES_SIGN_IN_ONLY",
            message: "Backup codes are only for signing in.",
          });
        }

        // An app code works once at sign-in, even within the 90 seconds it is accepted.
        if (ctx.path === "/two-factor/verify-totp" && !(await getSessionFromCtx(ctx))) {
          const userId = await pendingTwoFactorUserId(ctx);
          const code = typeof ctx.body?.code === "string" ? ctx.body.code.replace(/\s+/g, "") : "";
          if (userId && code) {
            const once = await limiter.hit("totpCodeOncePerUser", `${userId}\n${code}`);
            if (!once.allowed) {
              await events.record({
                type: "two_factor_failed",
                userId,
                headers,
                detail: "code_reused",
              });
              throw new APIError("UNAUTHORIZED", {
                code: "CODE_ALREADY_USED",
                message: "That code was already used. Wait for the next one in your app.",
              });
            }
          }
        }

        if (ctx.path === "/request-password-reset" && email) {
          const address = await limiter.hit("passwordResetPerAddress", email);
          const perIp = await limiter.hit("passwordResetPerIp", ip);
          if (!address.allowed || !perIp.allowed) {
            await events.record({
              type: "rate_limited",
              identifier: email,
              headers,
              detail: "password_reset",
            });
            // The same refusal whether or not the address has an account.
            throw tooManyRequests((address.allowed ? perIp : address).retryAfterSeconds);
          }
          await events.record({ type: "reset_requested", identifier: email, headers });
        }
      }),

      after: createAuthMiddleware(async (ctx) => {
        const headers = ctx.headers ?? ctx.request?.headers ?? null;
        const failed = isAPIError(ctx.context.returned);

        if (ctx.path === "/change-password" && !failed) {
          // The new session Better Auth made for this browser after signing out the rest.
          const user = ctx.context.newSession?.user;
          if (user) {
            await events.record({ type: "password_changed", userId: user.id, headers });
            await ctx.context.runInBackgroundOrAwait(
              deliver(user.email, "password-changed", () =>
                deps.mailer.sendPasswordChanged({ to: user.email }),
              ),
            );
          }
          return;
        }
        if (ctx.path === "/revoke-other-sessions" && !failed) {
          const session = await getSessionFromCtx(ctx);
          if (session) {
            await events.record({
              type: "other_sessions_revoked",
              userId: session.user.id,
              headers,
            });
          }
          return;
        }
        // Milestone 5. Signing in is recorded by `signInCompletion` below; these are the
        // member's own two-factor changes.
        if (failed) return;
        // Setting up: the first code from the app, typed while signed in, switched it on.
        // (`session` is the one this request came with; at sign-in there is none.)
        if (ctx.path === "/two-factor/verify-totp") {
          const before = ctx.context.session;
          const after = ctx.context.newSession;
          if (before && after?.user.twoFactorEnabled && !before.user.twoFactorEnabled) {
            // A fresh start: no browser trusted before this moment skips the code.
            await forgetTrustedDevices(db, after.user.id);
            await events.record({ type: "two_factor_enabled", userId: after.user.id, headers });
            await notifyTwoFactor(ctx, after.user.email, "enabled");
          }
          return;
        }
        if (
          ctx.path === "/two-factor/disable" ||
          ctx.path === "/two-factor/generate-backup-codes"
        ) {
          const user = ctx.context.session?.user;
          if (!user) return;
          if (ctx.path === "/two-factor/disable") {
            await forgetTrustedDevices(db, user.id);
            await events.record({ type: "two_factor_disabled", userId: user.id, headers });
            await notifyTwoFactor(ctx, user.email, "disabled");
          } else {
            await events.record({ type: "backup_codes_regenerated", userId: user.id, headers });
            await notifyTwoFactor(ctx, user.email, "backup-codes");
          }
        }
      }),
    },

    plugins: [
      emailCodeSignUp({
        db,
        hmacSecret: deps.hmacSecret,
        mode: deps.signUpMode,
        allowlist: deps.signUpAllowlist,
        termsVersion: deps.termsVersion,
        trustedIpHeader: deps.trustedIpHeader,
        mailer: deps.mailer,
        limiter,
        emailBudget,
        events,
      }),
      profilePlugin({ db, limiter, events }),
      accountPlugin({ db, limiter, events }),
      emailChangePlugin({
        db,
        hmacSecret: deps.hmacSecret,
        limiter,
        events,
        mailer: deps.mailer,
        deliver,
      }),
      academyPlugin({
        db,
        limiter,
        catalog: deps.academyCatalog ?? (() => NO_LESSONS),
        onRankChange: createRankSync({ db, discord: deps.discord ?? null, rankOf }),
      }),
      discordPlugin({
        db,
        limiter,
        events,
        baseUrl: deps.baseUrl,
        discord: deps.discord ?? null,
        rankOf,
      }),
      twoFactorPlugin(),
      // Must stay AFTER twoFactorPlugin(): see `signInCompletion`. A test proves it.
      signInCompletion,
    ],

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
