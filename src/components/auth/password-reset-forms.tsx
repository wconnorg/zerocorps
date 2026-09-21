"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, FormMessage, PasswordField } from "@/components/ui/field";
import { authFetch } from "@/lib/auth/auth-fetch";

/** Asks for a reset link. The answer is the same whether or not the address has an account. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await authFetch("/request-password-reset", { email: email.trim() });
    setPending(false);
    if (result.ok) return setSent(true);
    setError(result.message);
  }

  if (sent) {
    return (
      <div className="mt-6 flex flex-col gap-5">
        <FormMessage tone="success">
          If that address has an account, a reset link is on its way. It works once and expires in 1
          hour.
        </FormMessage>
        <ButtonLink href="/sign-in" variant="secondary" className="w-full">
          Back to sign in
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5" noValidate>
      <Field
        label="Email address"
        type="email"
        name="email"
        autoComplete="username"
        inputMode="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      {error ? <FormMessage>{error}</FormMessage> : null}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Email me a reset link"}
      </Button>
      <p className="text-center text-sm text-muted">
        <Link href="/sign-in" className="underline underline-offset-4 hover:text-fg">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

/** Sets a new password from the single-use token in the link. */
export function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await authFetch("/reset-password", { token, newPassword: password });
    setPending(false);
    if (result.ok) return setDone(true);
    setError(result.message);
  }

  if (!token) {
    return (
      <div className="mt-6 flex flex-col gap-5">
        <FormMessage>This reset link is incomplete. Ask for a new one.</FormMessage>
        <ButtonLink href="/forgot-password" className="w-full">
          Ask for a new link
        </ButtonLink>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mt-6 flex flex-col gap-5">
        <FormMessage tone="success">
          Your password was changed, and every device was signed out. Sign in with the new password.
        </FormMessage>
        <ButtonLink href="/sign-in" size="lg" className="w-full">
          Sign in
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5" noValidate>
      <PasswordField
        label="New password"
        name="newPassword"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        hint="At least 12 characters. Pasting from a password manager is fine."
      />
      {error ? <FormMessage>{error}</FormMessage> : null}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
