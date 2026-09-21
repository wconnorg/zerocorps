"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, PasswordField } from "@/components/ui/field";
import { authFetch } from "@/lib/auth/auth-fetch";

export function SignUpForm({
  inviteOnly,
  discordInviteUrl,
}: {
  inviteOnly: boolean;
  /** Shown with the invite-only note: during the private beta, the Discord is the way in. */
  discordInviteUrl?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await authFetch("/email-signup/start", {
      email: email.trim(),
      password,
      acceptTerms,
    });
    if (result.ok) return router.push("/sign-up/verify");
    setPending(false);
    setError(result.message);
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5" noValidate>
      {inviteOnly ? (
        <FormMessage tone="info">
          Private beta: sign-ups are open to invited addresses only. Use the address your invitation
          was sent to.
          {discordInviteUrl ? (
            <>
              {" "}
              No invitation yet?{" "}
              <a
                href={discordInviteUrl}
                rel="noopener noreferrer"
                className="text-fg underline underline-offset-4"
              >
                Join the Discord
              </a>
              .
            </>
          ) : null}
        </FormMessage>
      ) : null}
      <Field
        label="Email address"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        hint="At least 12 characters. A few random words work well, and pasting from a password manager is fine."
      />
      <label className="flex items-start gap-3 text-sm/6 text-muted">
        <input
          type="checkbox"
          name="acceptTerms"
          checked={acceptTerms}
          onChange={(event) => setAcceptTerms(event.target.checked)}
          className="mt-1 size-4 accent-accent"
        />
        <span>
          I agree to the{" "}
          <Link href="/terms" className="text-fg underline underline-offset-4">
            Terms
          </Link>{" "}
          and the{" "}
          <Link href="/privacy" className="text-fg underline underline-offset-4">
            Privacy Policy
          </Link>
          , and I am 18 or older.
        </span>
      </label>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Sending your code…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-fg underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
