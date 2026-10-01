"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, PasswordField } from "@/components/ui/field";
import { authFetch } from "@/lib/auth/auth-fetch";

/**
 * Changing the email address (milestone 4's rest), in two steps, like sign-up: the new
 * address and the password, then the 6-digit code emailed to the new address. The
 * server holds every rule (src/lib/auth/email-change.ts); the old address is told.
 */
export function EmailForm({ current }: { current: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"ask" | "code">("ask");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const result = await authFetch("/account/email/start", { newEmail, password });
    setBusy(false);
    if (!result.ok) {
      // authFetch words this code for the sign-in page ("email address and password don't
      // match"), which here would read as the NEW address being wrong.
      return setError(
        result.code === "INVALID_PASSWORD" ? "That is not your password." : result.message,
      );
    }
    setPassword("");
    setCode("");
    setStep("code");
  }

  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const result = await authFetch("/account/email/verify", { code });
    setBusy(false);
    if (!result.ok) {
      if (result.code === "TOO_MANY_ATTEMPTS" || result.code === "NO_PENDING_CHANGE") {
        setStep("ask");
      }
      return setError(
        result.attemptsLeft
          ? `${result.message} ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "try" : "tries"} left.`
          : result.message,
      );
    }
    setStep("ask");
    setNewEmail("");
    setCode("");
    setNotice("Email address changed. We told your old address too.");
    router.refresh();
  }

  if (step === "code") {
    return (
      <form onSubmit={onVerify} className="flex flex-col gap-5" noValidate>
        <p className="text-sm/6 text-muted">
          If <span className="text-fg">{newEmail.trim()}</span> can have this account, a 6-digit
          code is on its way there. It expires in 15 minutes.
        </p>
        <Field
          label="Code"
          name="one-time-code"
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={7}
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        {error ? <FormMessage>{error}</FormMessage> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || code.trim().length < 6}>
            {busy ? "Checking…" : "Change address"}
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setStep("ask");
              setError(null);
            }}
          >
            Back
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onStart} className="flex flex-col gap-5" noValidate>
      <p className="text-sm/6 text-muted">
        Your address is <span className="text-fg">{current}</span>. Only you see it.
      </p>
      <Field
        label="New email address"
        name="email"
        type="email"
        autoComplete="email"
        required
        maxLength={320}
        value={newEmail}
        onChange={(event) => setNewEmail(event.target.value)}
      />
      <PasswordField
        label="Your password"
        name="current-password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error ? <FormMessage>{error}</FormMessage> : null}
      {notice ? <FormMessage tone="success">{notice}</FormMessage> : null}
      <Button type="submit" disabled={busy || !newEmail || !password} className="self-start">
        {busy ? "Sending…" : "Send a code"}
      </Button>
    </form>
  );
}
