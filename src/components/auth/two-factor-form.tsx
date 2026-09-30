"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { authFetch, safeNextPath, twoFactorFailure } from "@/lib/auth/auth-fetch";

/** These end the sign-in: the only way on is the password again. */
const DEAD = new Set([
  "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE",
  "ACCOUNT_TEMPORARILY_LOCKED",
  "INVALID_TWO_FACTOR_COOKIE",
]);

/**
 * The second step of signing in with two-factor on (milestone 5): the 6-digit code from
 * the authenticator app, or one of the backup codes. Better Auth's two-factor plugin
 * checks it; this browser carries the signed cookie that says whose sign-in this is, and
 * it runs out after 10 minutes.
 */
export function TwoFactorForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const [mode, setMode] = useState<"app" | "backup">("app");
  const [code, setCode] = useState("");
  const [trust, setTrust] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dead, setDead] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = mode === "app" ? code.length === 6 : code.trim().length >= 10;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const result = await authFetch(
      mode === "app" ? "/two-factor/verify-totp" : "/two-factor/verify-backup-code",
      { code: mode === "app" ? code : code.trim(), trustDevice: trust },
    );
    if (result.ok) {
      // `next` has been reduced to a path on this site by safeNextPath.
      router.replace(next as Route);
      router.refresh();
      return;
    }
    setBusy(false);
    setCode("");
    if (DEAD.has(result.code)) return setDead(result.message);
    setError(twoFactorFailure(result));
  }

  function switchTo(nextMode: "app" | "backup") {
    setMode(nextMode);
    setCode("");
    setError(null);
  }

  if (dead) {
    return (
      <div className="mt-6 flex flex-col gap-5">
        <FormMessage>{dead}</FormMessage>
        <ButtonLink href="/sign-in" size="lg" className="w-full">
          Back to sign in
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5" noValidate>
      {mode === "app" ? (
        <>
          <p className="text-sm/6 text-muted">
            Open your authenticator app and type the 6-digit code it shows for ZeroCorps.
          </p>
          <Field
            key="app"
            label="6-digit code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={12}
            required
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center font-mono text-2xl tracking-[0.5em]"
          />
        </>
      ) : (
        <>
          <p className="text-sm/6 text-muted">
            Type one of the backup codes you saved when you turned two-factor on. Each one works
            once.
          </p>
          <Field
            key="backup"
            label="Backup code"
            name="backup-code"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={32}
            required
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value)}
            hint="Upper and lower case matter, as the code was printed."
            className="text-center font-mono text-xl tracking-[0.2em]"
          />
        </>
      )}

      <label className="flex items-start gap-3 text-sm/6 text-muted">
        <input
          type="checkbox"
          name="trustDevice"
          checked={trust}
          onChange={(event) => setTrust(event.target.checked)}
          className="mt-1 size-4 accent-accent"
        />
        <span>Trust this browser for 30 days. Only tick this on a device that is yours alone.</span>
      </label>

      {error ? <FormMessage>{error}</FormMessage> : null}
      <Button type="submit" size="lg" disabled={busy || !ready} className="w-full">
        {busy ? "Checking…" : "Sign in"}
      </Button>

      <div className="flex flex-col gap-2 text-sm/6 text-muted">
        {mode === "app" ? (
          <button
            type="button"
            onClick={() => switchTo("backup")}
            className="self-start underline underline-offset-4 hover:text-fg"
          >
            No phone? Use a backup code instead
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => switchTo("app")}
              className="self-start underline underline-offset-4 hover:text-fg"
            >
              Use the code from your app instead
            </button>
            <p>
              Lost your phone and your backup codes? Contact ZeroCorps. Once we are sure it is you,
              we can turn two-factor off so you can sign in with your password.
            </p>
          </>
        )}
      </div>
    </form>
  );
}
