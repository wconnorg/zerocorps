"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { authFetch } from "@/lib/auth/auth-fetch";

type Pending = {
  reference: string;
  email: string;
  expiresAt: string;
  resendAvailableAt: string;
  attemptsLeft: number;
  sendsLeft: number;
};

type Status = { pending: false } | ({ pending: true } & Pending);

/** These mean the sign-up cannot continue: the only way on is to start again. */
const DEAD = new Set([
  "NO_PENDING_SIGNUP",
  "CODE_EXPIRED",
  "TOO_MANY_ATTEMPTS",
  "SIGNUPS_CLOSED",
  "SIGNUP_NOT_INVITED",
]);

const secondsUntil = (iso: string) =>
  Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));

export function VerifyCodeForm() {
  const router = useRouter();
  const [state, setState] = useState<Pending | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dead, setDead] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void authFetch<Status>("/email-signup/status", undefined, "GET").then((result) => {
      if (cancelled) return;
      if (!result.ok) setDead(result.message);
      else if (!result.data.pending)
        setDead("This sign-up is no longer active. Please start again.");
      else setState(result.data);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    const tick = () => setResendIn(secondsUntil(state.resendAvailableAt));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const result = await authFetch("/email-signup/verify", { code });
    if (result.ok) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }
    setBusy(false);
    setCode("");
    if (DEAD.has(result.code)) return setDead(result.message);
    if (state && typeof result.attemptsLeft === "number")
      setState({ ...state, attemptsLeft: result.attemptsLeft });
    setError(
      typeof result.attemptsLeft === "number"
        ? `${result.message} ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? "" : "s"} left.`
        : result.message,
    );
  }

  async function resend() {
    setError(null);
    setNotice(null);
    setBusy(true);
    const result = await authFetch<Pending>("/email-signup/resend");
    setBusy(false);
    if (result.ok) {
      setState(result.data);
      setNotice("A new code is on its way. The old one no longer works.");
      return;
    }
    if (DEAD.has(result.code)) return setDead(result.message);
    setError(result.message);
  }

  if (!loaded) return <p className="mt-6 text-sm text-muted">Checking your sign-up…</p>;

  if (dead || !state) {
    return (
      <div className="mt-6 flex flex-col gap-5">
        <FormMessage>{dead ?? "This sign-up is no longer active. Please start again."}</FormMessage>
        <ButtonLink href="/sign-up" size="lg" className="w-full">
          Start again
        </ButtonLink>
      </div>
    );
  }

  const expires = new Date(state.expiresAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5" noValidate>
      <p className="text-sm/6 text-muted">
        We sent a 6-digit code to <span className="text-fg">{state.email}</span>. It works only in
        this browser and expires at {expires}.
      </p>
      <p className="rounded-lg border border-line bg-bg px-3 py-2.5 text-sm/6 text-muted">
        Reference{" "}
        <span className="font-mono font-semibold tracking-widest text-fg">{state.reference}</span>.
        The email with your code shows the same reference.
      </p>
      <Field
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
      {error ? <FormMessage>{error}</FormMessage> : null}
      {notice ? <FormMessage tone="success">{notice}</FormMessage> : null}
      <Button type="submit" size="lg" disabled={busy || code.length !== 6} className="w-full">
        {busy ? "Checking…" : "Verify and continue"}
      </Button>
      <div className="flex flex-col gap-2 text-sm/6 text-muted">
        <p>
          Nothing arrived? Check spam. If this address already has an account, we sent it a sign-in
          link instead of a code.
        </p>
        {state.sendsLeft > 0 ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy || resendIn > 0}
            onClick={resend}
          >
            {resendIn > 0 ? `Send a new code in ${resendIn}s` : "Send a new code"}
          </Button>
        ) : (
          <p>No more codes can be sent for this sign-up. You can start again instead.</p>
        )}
      </div>
    </form>
  );
}
