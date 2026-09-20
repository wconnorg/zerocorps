import type { AuthMailer } from "../auth/create-auth.ts";
import type { EmailMessage, SendEmail } from "./send-email.ts";

/**
 * The five emails the auth layer sends. Plain on purpose: no images, no tracking, no
 * remote fonts, a text version of everything. Every value that is put into the HTML is
 * escaped, including the ones that come from our own fixed vocabularies.
 *
 * The wording is a starting point for the owner to edit.
 */

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

type Block = { text: string; html?: string };

const paragraph = (text: string): Block => ({
  text,
  html: `<p style="margin:0 0 16px">${escapeHtml(text)}</p>`,
});

const link = (label: string, url: string): Block => ({
  text: `${label}: ${url}`,
  html:
    `<p style="margin:0 0 16px"><a href="${escapeHtml(url)}" style="color:#0e7490;font-weight:600">` +
    `${escapeHtml(label)}</a><br><span style="color:#6b7280;font-size:13px;word-break:break-all">${escapeHtml(url)}</span></p>`,
});

const code = (value: string): Block => ({
  text: `    ${value}`,
  html:
    `<p style="margin:0 0 16px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:32px;` +
    `letter-spacing:6px;font-weight:700">${escapeHtml(value)}</p>`,
});

function compose(
  kind: EmailMessage["kind"],
  to: string,
  subject: string,
  blocks: Block[],
): EmailMessage {
  const footer = "ZeroCorps · zerocorps.org · This mailbox is not monitored.";
  return {
    kind,
    to,
    subject,
    text: [...blocks.map((block) => block.text), "", footer].join("\n\n"),
    html:
      `<!doctype html><html lang="en"><body style="margin:0;padding:24px;background:#f5f7fa;color:#111827;` +
      `font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.5">` +
      `<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">` +
      `<p style="margin:0 0 20px;font-weight:700;letter-spacing:3px">ZEROCORPS</p>` +
      blocks.map((block) => block.html ?? "").join("") +
      `</div><p style="max-width:520px;margin:16px auto 0;color:#6b7280;font-size:12px">${escapeHtml(footer)}</p>` +
      `</body></html>`,
  };
}

const formatWhen = (when: Date) => `${when.toISOString().slice(0, 16).replace("T", " ")} UTC`;

export function createAuthMailer(sendEmail: SendEmail, options: { baseUrl: string }): AuthMailer {
  const signInUrl = `${options.baseUrl}/sign-in`;
  const resetUrl = `${options.baseUrl}/forgot-password`;

  return {
    sendSignUpCode: ({ to, code: value, reference, expiresInMinutes }) =>
      sendEmail(
        compose("signup-code", to, `Your ZeroCorps sign-up code (ref ${reference})`, [
          paragraph(
            "Enter this code on the ZeroCorps sign-up page to finish creating your account:",
          ),
          code(value),
          paragraph(
            `It expires in ${expiresInMinutes} minutes and works only in the browser where you started signing up. ` +
              `The page shows the reference ${reference}; if it shows a different one, this code belongs to another attempt.`,
          ),
          paragraph("Never share this code. ZeroCorps will never ask you for it."),
          paragraph(
            "If you didn't request this, you can ignore this email. Nothing has been created.",
          ),
        ]),
      ),

    sendAlreadyRegistered: ({ to }) =>
      sendEmail(
        compose("already-registered", to, "You already have a ZeroCorps account", [
          paragraph(
            "Someone, probably you, just tried to sign up to ZeroCorps with this email address.",
          ),
          paragraph(
            "This address already has an account, so no new one was created and no code was sent.",
          ),
          link("Sign in", signInUrl),
          link("Forgot your password? Reset it", resetUrl),
          paragraph(
            "If this wasn't you, you don't need to do anything. Your account has not changed.",
          ),
        ]),
      ),

    sendPasswordReset: ({ to, url }) =>
      sendEmail(
        compose("password-reset", to, "Reset your ZeroCorps password", [
          paragraph("Use this link to choose a new password. It works once and expires in 1 hour."),
          link("Choose a new password", url),
          paragraph("Never forward this email: whoever opens the link can set your password."),
          paragraph(
            "If you didn't ask for this, you can ignore it. Your password has not changed.",
          ),
        ]),
      ),

    sendPasswordChanged: ({ to }) =>
      sendEmail(
        compose("password-changed", to, "Your ZeroCorps password was changed", [
          paragraph(
            "The password of your ZeroCorps account was just changed, and every device was signed out.",
          ),
          paragraph("If that was you, there is nothing more to do."),
          link("If it wasn't you, reset your password now", resetUrl),
        ]),
      ),

    sendNewDevice: ({ to, when, device, resetUrl: url }) =>
      sendEmail(
        compose("new-device", to, "New sign-in to your ZeroCorps account", [
          paragraph("Your account was just signed in to from a browser we haven't seen before."),
          paragraph(`When: ${formatWhen(when)}`),
          paragraph(`Browser: ${device}`),
          paragraph("If that was you, there is nothing more to do."),
          link("If it wasn't you, reset your password now", url),
        ]),
      ),
  };
}
