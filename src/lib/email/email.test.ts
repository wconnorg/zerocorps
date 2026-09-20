import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthMailer } from "./auth-emails.ts";
import { createEmailSender, EmailSendError, type EmailMessage } from "./send-email.ts";

let outboxDir: string;
let logged: string[];

beforeEach(() => {
  outboxDir = mkdtempSync(join(tmpdir(), "zc-outbox-"));
  logged = [];
  for (const level of ["log", "info", "warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation(
      (...parts: unknown[]) => void logged.push(parts.map(String).join(" ")),
    );
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(outboxDir, { recursive: true, force: true });
});

const message: EmailMessage = {
  kind: "signup-code",
  to: "member@example.com",
  subject: "Your code",
  text: "The code is 482913",
  html: "<p>The code is 482913</p>",
};

const okResponse = () => new Response(JSON.stringify({ id: "email_1" }), { status: 200 });

describe("sendEmail on the laptop", () => {
  it("writes to the outbox and logs a masked address, never the code or the full address", async () => {
    const fetchSpy = vi.fn();
    const send = createEmailSender({
      appEnv: "local",
      from: "ZeroCorps <no-reply@zerocorps.org>",
      allowlist: [],
      outboxDir,
      fetch: fetchSpy,
    });
    await send(message);

    expect(fetchSpy).not.toHaveBeenCalled();
    const files = readdirSync(outboxDir);
    expect(files).toContain("latest-signup-code.json");
    expect(files.some((name) => name.endsWith("-signup-code.txt"))).toBe(true);
    const latest = JSON.parse(
      readFileSync(join(outboxDir, "latest-signup-code.json"), "utf8"),
    ) as Record<string, string>;
    expect(latest).toMatchObject({ to: "member@example.com", text: "The code is 482913" });

    const output = logged.join("\n");
    expect(output).toContain("m***@example.com");
    expect(output).not.toContain("member@example.com");
    expect(output).not.toContain("482913");
  });

  it("with a provider key, really sends only to the allowlist; everyone else still goes to the outbox", async () => {
    const fetchSpy = vi.fn(async () => okResponse());
    const send = createEmailSender({
      appEnv: "local",
      from: "ZeroCorps <no-reply@zerocorps.org>",
      resendApiKey: "re_fixture",
      allowlist: ["owner@example.com"],
      outboxDir,
      fetch: fetchSpy as unknown as typeof fetch,
    });

    await send({ ...message, to: "owner@example.com" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer re_fixture");
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: "ZeroCorps <no-reply@zerocorps.org>",
      to: ["owner@example.com"],
      subject: "Your code",
    });

    await send({ ...message, to: "stranger@example.com" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(readdirSync(outboxDir)).toContain("latest-signup-code.json");
  });
});

describe("sendEmail on the live site", () => {
  const production = (fetchImpl: typeof fetch, resendApiKey: string | undefined = "re_fixture") =>
    createEmailSender({
      appEnv: "production",
      from: "ZeroCorps <no-reply@zerocorps.org>",
      resendApiKey,
      allowlist: [],
      outboxDir,
      fetch: fetchImpl,
    });

  it("sends through the provider and writes nothing to disk", async () => {
    const fetchSpy = vi.fn(async () => okResponse());
    await production(fetchSpy as unknown as typeof fetch)(message);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(readdirSync(outboxDir)).toEqual([]);
  });

  it("is loud about a quota error, throws, and still names no address", async () => {
    const quota = vi.fn(
      async () => new Response(JSON.stringify({ name: "daily_quota_exceeded" }), { status: 429 }),
    );
    await expect(production(quota as unknown as typeof fetch)(message)).rejects.toBeInstanceOf(
      EmailSendError,
    );
    const output = logged.join("\n");
    expect(output).toMatch(/PROVIDER QUOTA REACHED/);
    expect(output).toContain("signup-code");
    expect(output).not.toContain("member@example.com");
    expect(output).not.toContain("482913");
  });

  it("refuses to pretend when there is no provider key", async () => {
    await expect(
      production(vi.fn() as unknown as typeof fetch, "")(message),
    ).rejects.toBeInstanceOf(EmailSendError);
  });
});

describe("the five auth emails", () => {
  const sent: EmailMessage[] = [];
  const mailer = createAuthMailer(async (email) => void sent.push(email), {
    baseUrl: "https://zerocorps.org",
  });
  const last = () => sent.at(-1) as EmailMessage;

  it("sign-up code: the code, the expiry, the warnings and the reference, in text and in HTML", async () => {
    await mailer.sendSignUpCode({
      to: "new@example.com",
      code: "482913",
      reference: "K7Q2",
      expiresInMinutes: 15,
    });
    const email = last();
    expect(email).toMatchObject({ kind: "signup-code", to: "new@example.com" });
    expect(email.subject).toContain("K7Q2");
    expect(email.subject).not.toContain("482913");
    for (const body of [email.text, email.html]) {
      expect(body).toContain("482913");
      expect(body).toContain("K7Q2");
      expect(body).toMatch(/expires in 15 minutes/);
      expect(body).toMatch(/Never share this code\. ZeroCorps will never ask you for it\./);
      expect(body).toMatch(/If you didn&#39;t request this|If you didn't request this/);
    }
  });

  it("already registered: sign-in and reset links, and no code", async () => {
    await mailer.sendAlreadyRegistered({ to: "taken@example.com" });
    const email = last();
    expect(email.text).toContain("https://zerocorps.org/sign-in");
    expect(email.text).toContain("https://zerocorps.org/forgot-password");
    expect(email.text).not.toMatch(/\b\d{6}\b/);
  });

  it("reset, password changed and new device carry the right links and facts", async () => {
    await mailer.sendPasswordReset({
      to: "a@example.com",
      url: "https://zerocorps.org/reset-password?token=abc123",
    });
    expect(last().text).toContain("https://zerocorps.org/reset-password?token=abc123");
    expect(last().text).toMatch(/works once and expires in 1 hour/);

    await mailer.sendPasswordChanged({ to: "a@example.com" });
    expect(last().text).toMatch(/every device was signed out/);
    expect(last().text).toContain("https://zerocorps.org/forgot-password");

    await mailer.sendNewDevice({
      to: "a@example.com",
      when: new Date("2026-09-20T14:05:00Z"),
      device: "Safari on macOS",
      resetUrl: "https://zerocorps.org/forgot-password",
    });
    expect(last().text).toContain("2026-09-20 14:05 UTC");
    expect(last().text).toContain("Safari on macOS");
  });

  it("escapes everything it puts into HTML, and loads nothing from anywhere", async () => {
    await mailer.sendNewDevice({
      to: "a@example.com",
      when: new Date("2026-09-20T14:05:00Z"),
      device: '<img src=x onerror="alert(1)">',
      resetUrl: 'https://zerocorps.org/forgot-password"><script>alert(1)</script>',
    });
    const { html } = last();
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    for (const email of sent) {
      expect(email.html).not.toMatch(/<img|<script|<link|url\(|@import/i);
      expect(email.html).not.toMatch(/https?:\/\/(?!zerocorps\.org)/);
    }
  });
});
