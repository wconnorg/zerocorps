import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  formCsrfMiddleware,
  sessionMiddleware,
} from "better-auth/api";
import { generateRandomString } from "better-auth/crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as z from "zod";
import { users, verifications } from "../../db/schema.ts";
import { looksLikeEmail, normalizeEmail } from "../email-address.ts";
import type { AuthDatabase } from "./create-auth.ts";
import { isUniqueViolation, maskEmail } from "./email-code-signup.ts";
import type { EventLog } from "./events.ts";
import { keyedHash, safeEqual } from "./keyed-hash.ts";
import { LIMITS, type EmailKind, type Limiter } from "./limits.ts";

/**
 * Changing the account's email address (milestone 4's rest), the way sign-up works:
 * the member gives the new address AND their password, a 6-digit code goes to the new
 * address, and the address changes only when that code is typed back, in the same
 * account. The old address is then told. Better Auth's own `/change-email` stays off: it
 * asks for no password and works by emailed links on `/verify-email`, which is off too
 * (DECISIONS.md, finding 20).
 *
 * One pending change per member, kept in Better Auth's `verifications` table (the daily
 * job clears expired rows): the new address and a keyed hash of the code, never the code.
 * Guesses are counted by our limiter under the pending change's own id, so any number of
 * concurrent guesses still gets five in total, and the change is consumed in the same
 * transaction that moves the address, so a code works once.
 *
 * An address that already has an account gets the SAME answer as a free one, so this
 * cannot be used to find out who has an account. No code is sent to it (its owner gets a
 * short note instead) and no code can ever complete it.
 */

export const EMAIL_CHANGE_CODE_LENGTH = 6;
export const EMAIL_CHANGE_TTL_SECONDS = 15 * 60;

export type EmailChangeMailer = {
  sendEmailChangeCode(message: {
    to: string;
    code: string;
    expiresInMinutes: number;
  }): Promise<void>;
  /** To an address that already has an account, when another account asked for it. */
  sendEmailChangeTaken(message: { to: string }): Promise<void>;
  /** To the OLD address, once the change is done. `newEmail` arrives masked. */
  sendEmailChanged(message: { to: string; newEmail: string }): Promise<void>;
};

export type EmailChangeOptions = {
  db: AuthDatabase;
  hmacSecret: string;
  limiter: Limiter;
  events: EventLog;
  mailer: EmailChangeMailer;
  /** Sends one email within the daily cap per address, and never throws. */
  deliver(address: string, kind: EmailKind, send: () => Promise<void>): Promise<void>;
};

const MESSAGES = {
  INVALID_EMAIL: "That does not look like an email address.",
  SAME_EMAIL: "That is already your email address.",
  INVALID_PASSWORD: "That password is not right.",
  TOO_MANY_REQUESTS: "Too many attempts. Please wait a while and try again.",
  NO_PENDING_CHANGE: "There is no email change waiting, or it expired. Please start again.",
  INVALID_CODE: "That code is not right.",
  TOO_MANY_ATTEMPTS: "Too many wrong codes. Please start again.",
  EMAIL_TAKEN: "That address has just been used for another account. Nothing changed.",
} as const;

type ErrorCode = keyof typeof MESSAGES;

const STATUS: Record<ErrorCode, ConstructorParameters<typeof APIError>[0]> = {
  INVALID_EMAIL: "BAD_REQUEST",
  SAME_EMAIL: "BAD_REQUEST",
  INVALID_PASSWORD: "BAD_REQUEST",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  NO_PENDING_CHANGE: "BAD_REQUEST",
  INVALID_CODE: "BAD_REQUEST",
  TOO_MANY_ATTEMPTS: "BAD_REQUEST",
  EMAIL_TAKEN: "CONFLICT",
};

function refuse(code: ErrorCode, extra: Record<string, unknown> = {}): never {
  throw new APIError(STATUS[code], { code, message: MESSAGES[code], ...extra });
}

const pendingValue = z.object({ email: z.string(), codeHash: z.string().nullable() });

export const emailChangeIdentifier = (userId: string) => `email-change:${userId}`;

export function emailChangePlugin(options: EmailChangeOptions) {
  const { db, events, limiter } = options;

  const codeHashFor = (changeId: string, code: string) =>
    // The change's id is part of the input, so a hash is useless for any other change.
    keyedHash(options.hmacSecret, "email-change-code", `${changeId}:${code}`);

  return {
    id: "zerocorps-email-change",

    // Better Auth's own limiter, per IP and path: a loose backstop only.
    rateLimit: [
      { pathMatcher: (path: string) => path === "/account/email/start", window: 60, max: 10 },
      { pathMatcher: (path: string) => path === "/account/email/verify", window: 60, max: 20 },
    ],

    endpoints: {
      startEmailChange: createAuthEndpoint(
        "/account/email/start",
        {
          method: "POST",
          use: [formCsrfMiddleware, sessionMiddleware],
          body: z.object({ newEmail: z.string().max(320), password: z.string().max(1024) }),
        },
        async (ctx) => {
          const { user } = ctx.context.session;
          const headers = ctx.headers ?? ctx.request?.headers ?? null;

          // The password is checked first, and counted with every other password check
          // made while signed in: a stolen session cannot guess its way to it here.
          const check = await limiter.hit("passwordCheckPerUser", user.id);
          if (!check.allowed) {
            await events.record({
              type: "rate_limited",
              userId: user.id,
              headers,
              detail: "password_check",
            });
            refuse("TOO_MANY_REQUESTS", { retryAfterSeconds: check.retryAfterSeconds });
          }
          const account = await ctx.context.internalAdapter.findCredentialAccount(user.id);
          const passwordOk =
            account?.password != null &&
            (await ctx.context.password.verify({
              hash: account.password,
              password: ctx.body.password,
            }));
          if (!passwordOk) {
            await events.record({
              type: "email_change_failed",
              userId: user.id,
              headers,
              detail: "wrong_password",
            });
            refuse("INVALID_PASSWORD", { field: "password" });
          }

          const email = normalizeEmail(ctx.body.newEmail);
          if (!looksLikeEmail(email) || !z.email().safeParse(email).success) {
            refuse("INVALID_EMAIL", { field: "newEmail" });
          }
          if (email === normalizeEmail(user.email)) refuse("SAME_EMAIL", { field: "newEmail" });

          const starts = await limiter.hit("emailChangeStartPerUser", user.id);
          if (!starts.allowed) {
            await events.record({
              type: "rate_limited",
              userId: user.id,
              headers,
              detail: "email_change_start",
            });
            refuse("TOO_MANY_REQUESTS", { retryAfterSeconds: starts.retryAfterSeconds });
          }

          // From here on, a taken address and a free one do the same work and get the same
          // answer. A taken one is stored without a code hash, so no code can complete it.
          const taken = (await ctx.context.internalAdapter.findUserByEmail(email)) !== null;
          const id = randomUUID();
          const code = generateRandomString(EMAIL_CHANGE_CODE_LENGTH, "0-9");
          const codeHash = codeHashFor(id, code);
          const identifier = emailChangeIdentifier(user.id);
          const [row] = await db.transaction(async (tx) => {
            // One pending change per member: a new one replaces the old, and its code.
            await tx.delete(verifications).where(eq(verifications.identifier, identifier));
            return tx
              .insert(verifications)
              .values({
                id,
                identifier,
                value: JSON.stringify({ email, codeHash: taken ? null : codeHash }),
                expiresAt: sql`now() + make_interval(secs => ${EMAIL_CHANGE_TTL_SECONDS})`,
              })
              .returning({ expiresAt: verifications.expiresAt });
          });
          if (!row) throw new APIError("INTERNAL_SERVER_ERROR");

          await ctx.context.runInBackgroundOrAwait(
            taken
              ? options.deliver(email, "email-change-taken", () =>
                  options.mailer.sendEmailChangeTaken({ to: email }),
                )
              : options.deliver(email, "email-change-code", () =>
                  options.mailer.sendEmailChangeCode({
                    to: email,
                    code,
                    expiresInMinutes: EMAIL_CHANGE_TTL_SECONDS / 60,
                  }),
                ),
          );
          await events.record({ type: "email_change_started", userId: user.id, headers });
          return ctx.json({ ok: true, expiresAt: row.expiresAt.toISOString() });
        },
      ),

      verifyEmailChange: createAuthEndpoint(
        "/account/email/verify",
        {
          method: "POST",
          use: [formCsrfMiddleware, sessionMiddleware],
          body: z.object({ code: z.string().max(32) }),
        },
        async (ctx) => {
          const { user } = ctx.context.session;
          const headers = ctx.headers ?? ctx.request?.headers ?? null;

          const code = ctx.body.code.replace(/\s+/g, "");
          if (!new RegExp(`^\\d{${EMAIL_CHANGE_CODE_LENGTH}}$`).test(code)) {
            refuse("INVALID_CODE");
          }

          // Only this member's own pending change is ever looked at.
          const [row] = await db
            .select({ id: verifications.id, value: verifications.value })
            .from(verifications)
            .where(
              and(
                eq(verifications.identifier, emailChangeIdentifier(user.id)),
                gt(verifications.expiresAt, sql`now()`),
              ),
            )
            .limit(1);
          if (!row) return refuse("NO_PENDING_CHANGE");

          // Count the guess FIRST: the limiter's one atomic statement is the counter.
          const attempt = await limiter.hit("emailChangeCodePerChange", row.id);
          const burn = async () => {
            await db.delete(verifications).where(eq(verifications.id, row.id));
            return refuse("TOO_MANY_ATTEMPTS");
          };
          if (!attempt.allowed) return burn();

          const pending = pendingValue.parse(JSON.parse(row.value));
          const matches =
            pending.codeHash !== null && safeEqual(pending.codeHash, codeHashFor(row.id, code));
          if (!matches) {
            await events.record({
              type: "email_change_failed",
              userId: user.id,
              headers,
              detail: "wrong_code",
            });
            const left = LIMITS.emailChangeCodePerChange.max - attempt.count;
            if (left <= 0) return burn();
            return refuse("INVALID_CODE", { attemptsLeft: left });
          }

          let changed = false;
          try {
            // ONE transaction: the change is used up and the address moves, or neither.
            changed = await db.transaction(async (tx) => {
              const consumed = await tx
                .delete(verifications)
                .where(eq(verifications.id, row.id))
                .returning({ id: verifications.id });
              if (consumed.length === 0) return false;
              await tx
                .update(users)
                .set({ email: pending.email, emailVerified: true, updatedAt: new Date() })
                .where(eq(users.id, user.id));
              return true;
            });
          } catch (error) {
            // The address got an account since the code was sent. Rolled back; only the
            // holder of a valid code for it ever sees this answer.
            if (isUniqueViolation(error)) return refuse("EMAIL_TAKEN");
            throw error;
          }
          if (!changed) return refuse("NO_PENDING_CHANGE");

          await events.record({ type: "email_changed", userId: user.id, headers });
          const oldEmail = user.email;
          await ctx.context.runInBackgroundOrAwait(
            options.deliver(oldEmail, "email-changed", () =>
              options.mailer.sendEmailChanged({ to: oldEmail, newEmail: maskEmail(pending.email) }),
            ),
          );
          return ctx.json({ ok: true });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
