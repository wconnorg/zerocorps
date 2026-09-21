import { createAuth, type AuthDeps } from "../lib/auth/create-auth.ts";
import type { TestDatabase } from "./test-database.ts";

/**
 * The real auth configuration, on a test database, with a mailbox that records what
 * would have been sent instead of sending it.
 */

export const TEST_BASE_URL = "http://localhost:3000";

export type SentEmail =
  | { kind: "signup-code"; to: string; code: string; reference: string; expiresInMinutes: number }
  | { kind: "already-registered"; to: string }
  | { kind: "password-reset"; to: string; url: string }
  | { kind: "password-changed"; to: string }
  | { kind: "new-device"; to: string; when: Date; device: string; resetUrl: string };

export function createTestAuth(database: TestDatabase, overrides: Partial<AuthDeps> = {}) {
  const outbox: SentEmail[] = [];
  const auth = createAuth({
    db: database.db,
    baseUrl: TEST_BASE_URL,
    secret: "fixture-better-auth-secret-0000000000",
    hmacSecret: "fixture-hmac-secret-000000000000000000",
    appEnv: "local",
    signUpMode: "open",
    signUpAllowlist: [],
    termsVersion: "test-1",
    trustedIpHeader: "x-forwarded-for",
    mailer: {
      sendSignUpCode: async (message) => void outbox.push({ kind: "signup-code", ...message }),
      sendAlreadyRegistered: async (message) =>
        void outbox.push({ kind: "already-registered", ...message }),
      sendPasswordReset: async (message) =>
        void outbox.push({ kind: "password-reset", ...message }),
      sendPasswordChanged: async (message) =>
        void outbox.push({ kind: "password-changed", ...message }),
      sendNewDevice: async (message) => void outbox.push({ kind: "new-device", ...message }),
    },
    ...overrides,
  });

  const sentTo = <K extends SentEmail["kind"]>(kind: K, to: string) =>
    outbox.filter(
      (email): email is Extract<SentEmail, { kind: K }> => email.kind === kind && email.to === to,
    );

  return {
    auth,
    outbox,
    sentTo,
    /** The newest sign-up code emailed to an address. Throws if there is none. */
    latestCode(to: string): string {
      const email = sentTo("signup-code", to).at(-1);
      if (!email) throw new Error(`no sign-up code was sent to ${to}`);
      return email.code;
    },
  };
}

export type TestAuth = ReturnType<typeof createTestAuth>;
