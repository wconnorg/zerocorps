import { runWithTransaction, getCurrentAdapter } from "@better-auth/core/context";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, formCsrfMiddleware } from "better-auth/api";
import { expireCookie, setSessionCookie } from "better-auth/cookies";
import { generateRandomString } from "better-auth/crypto";
import { and, eq, gt, lt, lte, sql } from "drizzle-orm";
import { randomInt, randomUUID } from "node:crypto";
import * as z from "zod";
import { pendingSignups } from "../../db/schema.ts";
import { looksLikeEmail, normalizeEmail } from "../email-address.ts";
import { clientIp, userAgentFamily } from "./client-info.ts";
import type { AuthDatabase } from "./create-auth.ts";
import type { EventLog } from "./events.ts";
import { keyedHash, safeEqual } from "./keyed-hash.ts";
import { ensureDeviceToken } from "./known-device.ts";
import type { EmailBudget, Limiter } from "./limits.ts";

/**
 * Sign-up by emailed code, as a local Better Auth plugin.
 *
 * NOTHING is written to `users` until the code is correct. A pending sign-up lives in
 * `pending_signups`, and its id travels in a signed, httpOnly cookie, so a code is only
 * ever accepted from the browser that started the sign-up, never by email address
 * alone. That is the whole point: if codes were keyed by email, an attacker could
 * start a second sign-up for the victim's address, the victim would type the newer
 * code, and the attacker's password would be the one verified.
 *
 * The pattern is Better Auth's own (its two-factor plugin keeps a random id in a signed
 * cookie and the matching row in the database), and every primitive is the library's:
 * the password hasher, the random digits, the cookies, the user, account and session
 * creation, the CSRF middleware, the transaction. What is ours is the pending-row state
 * machine below, and nothing more. See DECISIONS.md, findings 15 to 19.
 */

export type SignUpMode = "closed" | "allowlist" | "open";

export const CODE_LENGTH = 6;
export const CODE_TTL_SECONDS = 15 * 60;
export const MAX_ATTEMPTS = 5;
export const MAX_SENDS = 3;
export const RESEND_COOLDOWN_SECONDS = 60;
const PENDING_COOKIE = "signup_pending";
/** No look-alike characters: a person may read this aloud or compare two emails. */
const REFERENCE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export type SignUpMailer = {
  sendSignUpCode(message: {
    to: string;
    code: string;
    reference: string;
    expiresInMinutes: number;
  }): Promise<void>;
  sendAlreadyRegistered(message: { to: string }): Promise<void>;
};

export type EmailCodeSignUpOptions = {
  db: AuthDatabase;
  hmacSecret: string;
  mode: SignUpMode;
  /** Normalised addresses. Used only while `mode` is "allowlist". */
  allowlist: readonly string[];
  termsVersion: string;
  trustedIpHeader: string;
  mailer: SignUpMailer;
  limiter: Limiter;
  emailBudget: EmailBudget;
  events: EventLog;
};

const MESSAGES = {
  SIGNUPS_CLOSED: "Sign-ups are not open yet.",
  SIGNUP_NOT_INVITED:
    "Sign-ups are invite-only right now. If you were invited, use the address your invitation was sent to.",
  TERMS_NOT_ACCEPTED: "You need to agree to the Terms and the Privacy Policy to create an account.",
  INVALID_EMAIL: "That does not look like an email address.",
  TOO_MANY_REQUESTS: "Too many attempts. Please wait a while and try again.",
  NO_PENDING_SIGNUP: "This sign-up is no longer active. Please start again.",
  CODE_EXPIRED: "That code has expired. Please start again.",
  TOO_MANY_ATTEMPTS: "Too many wrong codes. Please start again.",
  INVALID_CODE: "That code is not right.",
  RESEND_TOO_SOON: "Please wait a moment before asking for another code.",
  RESEND_LIMIT: "No more codes can be sent for this sign-up. Please start again.",
  ALREADY_REGISTERED: "This email address already has an account. Sign in instead.",
} as const;

type ErrorCode = keyof typeof MESSAGES;

const STATUS: Record<ErrorCode, ConstructorParameters<typeof APIError>[0]> = {
  SIGNUPS_CLOSED: "FORBIDDEN",
  SIGNUP_NOT_INVITED: "FORBIDDEN",
  TERMS_NOT_ACCEPTED: "BAD_REQUEST",
  INVALID_EMAIL: "BAD_REQUEST",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  NO_PENDING_SIGNUP: "BAD_REQUEST",
  CODE_EXPIRED: "BAD_REQUEST",
  TOO_MANY_ATTEMPTS: "BAD_REQUEST",
  INVALID_CODE: "BAD_REQUEST",
  RESEND_TOO_SOON: "TOO_MANY_REQUESTS",
  RESEND_LIMIT: "BAD_REQUEST",
  ALREADY_REGISTERED: "CONFLICT",
};

function refuse(code: ErrorCode, extra: Record<string, unknown> = {}): never {
  throw new APIError(STATUS[code], { code, message: MESSAGES[code], ...extra });
}

class PendingSignUpGone extends Error {}

const isUniqueViolation = (error: unknown): boolean => {
  for (let cause: unknown = error, depth = 0; cause && depth < 5; depth++) {
    const candidate = cause as { code?: unknown; cause?: unknown; message?: unknown };
    if (candidate.code === "23505") return true;
    if (
      typeof candidate.message === "string" &&
      /duplicate key value|users_email_unique/.test(candidate.message)
    ) {
      return true;
    }
    cause = candidate.cause;
  }
  return false;
};

const maskEmail = (email: string) => email.replace(/^(.).*(@.*)$/, "$1***$2");

export function emailCodeSignUp(options: EmailCodeSignUpOptions) {
  const { db, events, limiter } = options;

  const codeHashFor = (pendingId: string, code: string) =>
    // The row id is part of the input, so a hash is useless on any other row.
    keyedHash(options.hmacSecret, "signup-code", `${pendingId}:${code}`);

  const newCode = () => generateRandomString(CODE_LENGTH, "0-9");
  const newReference = () =>
    Array.from({ length: 4 }, () => REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)]).join(
      "",
    );

  /** Closed means closed for everyone. In allowlist mode only invited addresses pass. */
  function enforceMode(email: string | null) {
    if (options.mode === "closed") refuse("SIGNUPS_CLOSED");
    if (options.mode === "allowlist" && email !== null && !options.allowlist.includes(email)) {
      refuse("SIGNUP_NOT_INVITED");
    }
  }

  /**
   * Sends the code, or for an address that already has an account, the "you already
   * have an account" note. Both go through the daily cap, and both are handed to
   * Better Auth's background runner, so the response does not wait for the provider.
   */
  async function sendFor(
    ctx: { context: { runInBackgroundOrAwait: (work: Promise<unknown>) => unknown } },
    pending: { email: string; isDecoy: boolean; reference: string },
    code: string,
  ) {
    const kind = pending.isDecoy ? "already-registered" : "signup-code";
    if (!(await options.emailBudget.allow(pending.email, kind))) {
      await events.record({
        type: "rate_limited",
        identifier: pending.email,
        detail: "emails_per_day",
      });
      return;
    }
    const work = pending.isDecoy
      ? options.mailer.sendAlreadyRegistered({ to: pending.email })
      : options.mailer.sendSignUpCode({
          to: pending.email,
          code,
          reference: pending.reference,
          expiresInMinutes: CODE_TTL_SECONDS / 60,
        });
    await ctx.context.runInBackgroundOrAwait(
      work.catch(async (error: unknown) => {
        console.error(
          `[auth] a ${kind} email could not be sent: ${error instanceof Error ? error.name : "error"}`,
        );
        await events.record({ type: "email_failed", identifier: pending.email, detail: kind });
      }),
    );
  }

  const describe = (row: typeof pendingSignups.$inferSelect) => ({
    reference: row.reference,
    email: maskEmail(row.email),
    expiresAt: row.expiresAt.toISOString(),
    resendAvailableAt: new Date(
      row.lastSentAt.getTime() + RESEND_COOLDOWN_SECONDS * 1000,
    ).toISOString(),
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - row.attempts),
    sendsLeft: Math.max(0, MAX_SENDS - row.sendCount),
  });

  async function whyUnusable(pendingId: string): Promise<never> {
    const [row] = await db
      .select()
      .from(pendingSignups)
      .where(eq(pendingSignups.id, pendingId))
      .limit(1);
    if (!row) return refuse("NO_PENDING_SIGNUP");
    if (row.expiresAt.getTime() <= Date.now()) return refuse("CODE_EXPIRED");
    if (row.attempts >= MAX_ATTEMPTS) return refuse("TOO_MANY_ATTEMPTS");
    return refuse("NO_PENDING_SIGNUP");
  }

  return {
    id: "email-code-signup",

    // Declared so that Better Auth's adapter knows these tables: the success path uses
    // them INSIDE Better Auth's transaction (finding 19). The columns live in src/db/schema.ts.
    schema: {
      pendingSignup: {
        fields: {
          email: { type: "string", required: true, input: false },
          passwordHash: { type: "string", required: false, input: false, returned: false },
          codeHash: { type: "string", required: true, input: false, returned: false },
          reference: { type: "string", required: true, input: false },
          attempts: { type: "number", required: true, input: false, defaultValue: 0 },
          sendCount: { type: "number", required: true, input: false, defaultValue: 1 },
          lastSentAt: { type: "date", required: true, input: false },
          expiresAt: { type: "date", required: true, input: false },
          termsVersion: { type: "string", required: true, input: false },
          createdAt: { type: "date", required: true, input: false },
        },
      },
      knownDevice: {
        fields: {
          userId: {
            type: "string",
            required: true,
            input: false,
            references: { model: "user", field: "id" },
          },
          deviceHash: { type: "string", required: true, input: false, returned: false },
          userAgent: { type: "string", required: false, input: false },
          firstSeenAt: { type: "date", required: true, input: false },
          lastSeenAt: { type: "date", required: true, input: false },
        },
      },
    },

    // Better Auth's own limiter: per IP and path, deliberately loose. The tight limits
    // are per address and per pending sign-up, below.
    rateLimit: [
      { pathMatcher: (path: string) => path === "/email-signup/start", window: 60, max: 10 },
      { pathMatcher: (path: string) => path === "/email-signup/verify", window: 60, max: 20 },
      { pathMatcher: (path: string) => path === "/email-signup/resend", window: 60, max: 10 },
      { pathMatcher: (path: string) => path === "/email-signup/status", window: 60, max: 60 },
    ],

    endpoints: {
      startEmailSignUp: createAuthEndpoint(
        "/email-signup/start",
        {
          method: "POST",
          // The global origin check skips requests without cookies, and a first visit has
          // none. Without this, another site could plant ITS pending sign-up, and its
          // cookie, in a victim's browser (finding 17).
          use: [formCsrfMiddleware],
          body: z.object({
            email: z.string().max(320),
            password: z.string().max(1024),
            acceptTerms: z.boolean(),
          }),
        },
        async (ctx) => {
          const headers = ctx.headers ?? ctx.request?.headers ?? null;
          const email = normalizeEmail(ctx.body.email);

          if (options.mode === "closed") refuse("SIGNUPS_CLOSED");
          if (!looksLikeEmail(email) || !z.email().safeParse(email).success)
            refuse("INVALID_EMAIL");
          if (ctx.body.acceptTerms !== true) refuse("TERMS_NOT_ACCEPTED");
          const { minPasswordLength, maxPasswordLength } = ctx.context.password.config;
          if (ctx.body.password.length < minPasswordLength) {
            throw new APIError("BAD_REQUEST", {
              code: "PASSWORD_TOO_SHORT",
              message: `Use at least ${minPasswordLength} characters.`,
            });
          }
          if (ctx.body.password.length > maxPasswordLength) {
            throw new APIError("BAD_REQUEST", {
              code: "PASSWORD_TOO_LONG",
              message: `Use at most ${maxPasswordLength} characters.`,
            });
          }
          if (options.mode === "allowlist" && !options.allowlist.includes(email)) {
            await events.record({
              type: "signup_blocked",
              identifier: email,
              headers,
              detail: "not_invited",
            });
            refuse("SIGNUP_NOT_INVITED");
          }

          const perAddress = await limiter.hit("signUpStartPerAddress", email);
          const perIp = await limiter.hit(
            "signUpStartPerIp",
            clientIp(headers, options.trustedIpHeader) ?? "no-ip",
          );
          if (!perAddress.allowed || !perIp.allowed) {
            const blocked = perAddress.allowed ? perIp : perAddress;
            await events.record({
              type: "rate_limited",
              identifier: email,
              headers,
              detail: perAddress.allowed ? "signup_start_ip" : "signup_start_address",
            });
            refuse("TOO_MANY_REQUESTS", { retryAfterSeconds: blocked.retryAfterSeconds });
          }

          // Housekeeping that the daily job also does.
          await db.delete(pendingSignups).where(lt(pendingSignups.expiresAt, sql`now()`));

          // From here on, a registered address and a new one do the SAME work and get the
          // SAME answer: one password hash, one lookup, one row, one email, one cookie.
          const passwordHash = await ctx.context.password.hash(ctx.body.password);
          const existing = await ctx.context.internalAdapter.findUserByEmail(email);
          const isDecoy = existing !== null;

          const id = randomUUID();
          const code = newCode();
          const [row] = await db
            .insert(pendingSignups)
            .values({
              id,
              email,
              // NULL for a registered address: such a row can never create anything.
              passwordHash: isDecoy ? null : passwordHash,
              codeHash: codeHashFor(id, code),
              reference: newReference(),
              expiresAt: sql`now() + make_interval(secs => ${CODE_TTL_SECONDS})`,
              termsVersion: options.termsVersion,
            })
            .returning();
          if (!row) throw new APIError("INTERNAL_SERVER_ERROR");

          await sendFor(ctx, { email, isDecoy, reference: row.reference }, code);

          const cookie = ctx.context.createAuthCookie(PENDING_COOKIE, { maxAge: CODE_TTL_SECONDS });
          await ctx.setSignedCookie(cookie.name, id, ctx.context.secret, cookie.attributes);
          await events.record({ type: "signup_started", identifier: email, headers });
          return ctx.json(describe(row));
        },
      ),

      verifyEmailSignUp: createAuthEndpoint(
        "/email-signup/verify",
        {
          method: "POST",
          use: [formCsrfMiddleware],
          body: z.object({ code: z.string().max(32) }),
        },
        async (ctx) => {
          const headers = ctx.headers ?? ctx.request?.headers ?? null;
          enforceMode(null);

          const cookie = ctx.context.createAuthCookie(PENDING_COOKIE);
          const pendingId = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
          if (!pendingId || !z.uuid().safeParse(pendingId).success)
            return refuse("NO_PENDING_SIGNUP");

          const code = ctx.body.code.replace(/\s+/g, "");
          if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code)) return refuse("INVALID_CODE");

          // Count the attempt FIRST, in one statement whose guard sits on the row itself,
          // so that any number of concurrent guesses still gets five in total.
          const [row] = await db
            .update(pendingSignups)
            .set({ attempts: sql`${pendingSignups.attempts} + 1` })
            .where(
              and(
                eq(pendingSignups.id, pendingId),
                lt(pendingSignups.attempts, MAX_ATTEMPTS),
                gt(pendingSignups.expiresAt, sql`now()`),
              ),
            )
            .returning();
          if (!row) return whyUnusable(pendingId);

          enforceMode(row.email);

          const matches = safeEqual(row.codeHash, codeHashFor(pendingId, code));
          if (!matches || row.passwordHash === null) {
            await events.record({
              type: "signup_code_failed",
              identifier: row.email,
              headers,
              detail: "wrong_code",
            });
            if (row.attempts >= MAX_ATTEMPTS) return refuse("TOO_MANY_ATTEMPTS");
            return refuse("INVALID_CODE", { attemptsLeft: MAX_ATTEMPTS - row.attempts });
          }

          const device = ensureDeviceToken(ctx);
          let created;
          try {
            // ONE transaction: everything below happens, or none of it does.
            created = await runWithTransaction(ctx.context.adapter, async () => {
              const adapter = await getCurrentAdapter(ctx.context.adapter);
              // Single use: of any number of correct submissions, exactly one gets the row.
              const consumed = await adapter.consumeOne<{
                passwordHash: string | null;
                termsVersion: string;
              }>({
                model: "pendingSignup",
                where: [{ field: "id", value: pendingId }],
              });
              if (!consumed?.passwordHash) throw new PendingSignUpGone();

              const now = new Date();
              const user = await ctx.context.internalAdapter.createUser(
                {
                  email: row.email,
                  name: "",
                  emailVerified: true,
                  termsAcceptedAt: now,
                  termsVersion: consumed.termsVersion,
                },
                { method: "email-password" },
              );
              await ctx.context.internalAdapter.linkAccount({
                userId: user.id,
                providerId: "credential",
                accountId: user.id,
                password: consumed.passwordHash,
              });
              await adapter.deleteMany({
                model: "pendingSignup",
                where: [{ field: "email", value: row.email }],
              });
              await adapter.create({
                model: "knownDevice",
                data: {
                  userId: user.id,
                  deviceHash: device.hash,
                  userAgent: userAgentFamily(headers?.get("user-agent")),
                  firstSeenAt: now,
                  lastSeenAt: now,
                },
              });
              const session = await ctx.context.internalAdapter.createSession(user.id);
              return { user, session };
            });
          } catch (error) {
            if (error instanceof PendingSignUpGone) return refuse("NO_PENDING_SIGNUP");
            // Someone finished a sign-up for this address a moment ago. The transaction
            // rolled back; only a person holding a valid code ever sees this answer.
            if (isUniqueViolation(error)) return refuse("ALREADY_REGISTERED");
            throw error;
          }

          await setSessionCookie(ctx, created);
          expireCookie(ctx, cookie);
          await events.record({ type: "signup_completed", userId: created.user.id, headers });
          return ctx.json({ ok: true });
        },
      ),

      resendEmailSignUp: createAuthEndpoint(
        "/email-signup/resend",
        { method: "POST", use: [formCsrfMiddleware] },
        async (ctx) => {
          enforceMode(null);
          const cookie = ctx.context.createAuthCookie(PENDING_COOKIE);
          const pendingId = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
          if (!pendingId || !z.uuid().safeParse(pendingId).success)
            return refuse("NO_PENDING_SIGNUP");

          // A new code replaces the old one (only its hash was ever stored). The attempts
          // are NOT reset: five guesses per sign-up means five, however many codes it sends.
          const code = newCode();
          const [row] = await db
            .update(pendingSignups)
            .set({
              codeHash: codeHashFor(pendingId, code),
              sendCount: sql`${pendingSignups.sendCount} + 1`,
              lastSentAt: sql`now()`,
            })
            .where(
              and(
                eq(pendingSignups.id, pendingId),
                lt(pendingSignups.sendCount, MAX_SENDS),
                lt(pendingSignups.attempts, MAX_ATTEMPTS),
                gt(pendingSignups.expiresAt, sql`now()`),
                lte(
                  pendingSignups.lastSentAt,
                  sql`now() - make_interval(secs => ${RESEND_COOLDOWN_SECONDS})`,
                ),
              ),
            )
            .returning();

          if (!row) {
            const [current] = await db
              .select()
              .from(pendingSignups)
              .where(eq(pendingSignups.id, pendingId))
              .limit(1);
            if (!current || current.expiresAt.getTime() <= Date.now())
              return whyUnusable(pendingId);
            if (current.attempts >= MAX_ATTEMPTS) return refuse("TOO_MANY_ATTEMPTS");
            if (current.sendCount >= MAX_SENDS) return refuse("RESEND_LIMIT");
            const waitMs =
              current.lastSentAt.getTime() + RESEND_COOLDOWN_SECONDS * 1000 - Date.now();
            return refuse("RESEND_TOO_SOON", {
              retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
            });
          }

          enforceMode(row.email);
          await sendFor(
            ctx,
            { email: row.email, isDecoy: row.passwordHash === null, reference: row.reference },
            code,
          );
          return ctx.json(describe(row));
        },
      ),

      emailSignUpStatus: createAuthEndpoint(
        "/email-signup/status",
        { method: "GET" },
        async (ctx) => {
          const cookie = ctx.context.createAuthCookie(PENDING_COOKIE);
          const pendingId = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
          if (!pendingId || !z.uuid().safeParse(pendingId).success)
            return ctx.json({ pending: false as const });
          const [row] = await db
            .select()
            .from(pendingSignups)
            .where(and(eq(pendingSignups.id, pendingId), gt(pendingSignups.expiresAt, sql`now()`)))
            .limit(1);
          if (!row || row.attempts >= MAX_ATTEMPTS) return ctx.json({ pending: false as const });
          return ctx.json({ pending: true as const, ...describe(row) });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
