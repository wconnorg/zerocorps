import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EmailKind } from "../auth/limits.ts";

/**
 * The one place email leaves the app. The provider sits behind this wrapper so it can
 * be swapped by changing this file and an environment variable (Resend today, through
 * its plain HTTPS API: no SDK to trust or update).
 *
 *   on the laptop       written to the console (address masked, no body) and to a file
 *                       in `.outbox/`, which is where you read a sign-up code while testing
 *   on the laptop, with RESEND_API_KEY set
 *                       really sent, but ONLY to the addresses in EMAIL_ALLOWLIST; every
 *                       other address still goes to the outbox
 *   on the live site    really sent
 *
 * Nothing here logs a code, a link or a full address.
 */

export type EmailMessage = {
  kind: EmailKind;
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailSenderOptions = {
  appEnv: "local" | "production";
  from: string;
  resendApiKey?: string;
  /** Normalised addresses. Laptop only: production refuses to start with a non-empty list. */
  allowlist: readonly string[];
  /** Where undelivered mail is written on the laptop. */
  outboxDir: string;
  fetch?: typeof fetch;
};

export class EmailSendError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "EmailSendError";
  }
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const maskAddress = (address: string) => address.replace(/^(.).*(@.*)$/, "$1***$2");

export function createEmailSender(options: EmailSenderOptions) {
  const send = options.fetch ?? fetch;

  async function deliver(message: EmailMessage) {
    const response = await send(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.resendApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: options.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (response.ok) return;

    let reason = "unknown";
    try {
      reason = String(((await response.json()) as { name?: unknown }).name ?? "unknown");
    } catch {
      // The body was not JSON; the status says enough.
    }
    // Loud on purpose: a quota or a revoked key means nobody can sign up or reset.
    const quota = response.status === 429 || /quota|rate_limit/i.test(reason);
    console.error(
      `[email] ${quota ? "PROVIDER QUOTA REACHED" : "PROVIDER ERROR"}: ${message.kind} not sent ` +
        `(status ${response.status}, ${reason.slice(0, 60)}).`,
    );
    throw new EmailSendError(`The email provider answered ${response.status}.`, response.status);
  }

  async function writeToOutbox(message: EmailMessage) {
    await mkdir(options.outboxDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const body = [
      `To: ${message.to}`,
      `Subject: ${message.subject}`,
      `Kind: ${message.kind}`,
      "",
      message.text,
      "",
    ].join("\n");
    await writeFile(join(options.outboxDir, `${stamp}-${message.kind}.txt`), body, "utf8");
    // Always the newest of its kind, for a person in a hurry and for the browser checks.
    await writeFile(
      join(options.outboxDir, `latest-${message.kind}.json`),
      JSON.stringify({ to: message.to, subject: message.subject, text: message.text }, null, 2),
      "utf8",
    );
    console.info(
      `[email] ${message.kind} for ${maskAddress(message.to)} written to .outbox/ (not sent)`,
    );
  }

  return async function sendEmail(message: EmailMessage): Promise<void> {
    if (options.appEnv === "production") {
      if (!options.resendApiKey) throw new EmailSendError("RESEND_API_KEY is not set.", 0);
      return deliver(message);
    }
    if (options.resendApiKey && options.allowlist.includes(message.to)) {
      await deliver(message);
      console.info(
        `[email] ${message.kind} really sent to ${maskAddress(message.to)} (on the allowlist)`,
      );
      return;
    }
    return writeToOutbox(message);
  };
}

export type SendEmail = ReturnType<typeof createEmailSender>;
