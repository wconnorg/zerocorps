"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, PasswordField } from "@/components/ui/field";
import { authFetch, safeNextPath } from "@/lib/auth/auth-fetch";

export function SignInForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await authFetch("/sign-in/email", { email: email.trim(), password });
    if (result.ok) {
      // `next` has been reduced to a path on this site by safeNextPath.
      router.replace(next as Route);
      router.refresh();
      return;
    }
    setPending(false);
    setPassword("");
    setError(result.message);
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
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error ? <FormMessage>{error}</FormMessage> : null}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <div className="flex items-center justify-between text-sm text-muted">
        <Link href="/forgot-password" className="underline underline-offset-4 hover:text-fg">
          Forgot your password?
        </Link>
        <Link href="/sign-up" className="underline underline-offset-4 hover:text-fg">
          Create an account
        </Link>
      </div>
    </form>
  );
}
