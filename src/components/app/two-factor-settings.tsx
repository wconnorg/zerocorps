"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { QrCode } from "@/components/app/qr-code";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, PasswordField } from "@/components/ui/field";
import { authFetch, twoFactorFailure, type AuthFailure } from "@/lib/auth/auth-fetch";

type Purpose = "enable" | "disable" | "codes";

type Step =
  | { name: "idle" }
  | { name: "password"; purpose: Purpose }
  | { name: "scan"; uri: string; backupCodes: string[] }
  | { name: "codes"; backupCodes: string[]; first: boolean };

const BACKUP_CODE_TOTAL = 10;

/** The key inside the set-up link, in groups of four, for typing into an app by hand. */
function manualKey(uri: string): string {
  try {
    const secret = new URL(uri).searchParams.get("secret") ?? "";
    return secret.replace(/(.{4})/g, "$1 ").trim();
  } catch {
    return "";
  }
}

const failureText = (result: AuthFailure) =>
  result.code === "INVALID_PASSWORD" ? "That password is not right." : result.message;

/**
 * Settings, two-factor (milestone 5): an authenticator app after the password, and ten
 * backup codes. Setting it up shows a QR code once, and it is on only once a first code
 * from the app is typed; the backup codes are shown once after that. Turning it off, and
 * new backup codes, need the password. Every rule is on the server (Better Auth's
 * two-factor plugin, with ours in src/lib/auth/create-auth.ts); the member is emailed
 * about each change.
 */
export function TwoFactorSettings({
  enabled,
  backupCodesLeft,
}: {
  enabled: boolean;
  /** Null when two-factor is off, or the count could not be read. */
  backupCodesLeft: number | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "idle" });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function go(next: Step) {
    setStep(next);
    setPassword("");
    setCode("");
    setSaved(false);
    setError(null);
  }

  async function onPassword(event: FormEvent<HTMLFormElement>, purpose: Purpose) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    if (purpose === "enable") {
      const result = await authFetch<{ totpURI: string; backupCodes: string[] }>(
        "/two-factor/enable",
        { password },
      );
      setBusy(false);
      if (!result.ok) return setError(failureText(result));
      return go({ name: "scan", uri: result.data.totpURI, backupCodes: result.data.backupCodes });
    }
    if (purpose === "codes") {
      const result = await authFetch<{ backupCodes: string[] }>(
        "/two-factor/generate-backup-codes",
        { password },
      );
      setBusy(false);
      if (!result.ok) return setError(failureText(result));
      return go({ name: "codes", backupCodes: result.data.backupCodes, first: false });
    }
    const result = await authFetch("/two-factor/disable", { password });
    setBusy(false);
    if (!result.ok) return setError(failureText(result));
    go({ name: "idle" });
    setNotice("Two-factor is off. We emailed you that it changed.");
    router.refresh();
  }

  async function onConfirm(event: FormEvent<HTMLFormElement>, backupCodes: string[]) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const result = await authFetch("/two-factor/verify-totp", { code });
    setBusy(false);
    if (!result.ok) {
      setCode("");
      return setError(twoFactorFailure(result));
    }
    go({ name: "codes", backupCodes, first: true });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied.");
    } catch {
      setNotice("This browser would not copy. Select the codes and copy them by hand.");
    }
  }

  function download(backupCodes: string[]) {
    const text = [
      "ZeroCorps backup codes",
      "",
      ...backupCodes,
      "",
      "Each code signs you in once, instead of the code from your authenticator app.",
      "Keep this file somewhere only you can reach, such as a password manager.",
      "",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "zerocorps-backup-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (step.name === "password") {
    const words = {
      enable: {
        intro: "First, your password, so nobody who finds this browser open can do this.",
        action: "Continue",
      },
      codes: {
        intro: "New codes replace all of your current ones. Your password first.",
        action: "Make new codes",
      },
      disable: {
        intro:
          "Without two-factor, your password alone signs in. We email you that it changed. Your password first.",
        action: "Turn off two-factor",
      },
    }[step.purpose];
    return (
      <form
        onSubmit={(event) => onPassword(event, step.purpose)}
        className="flex flex-col gap-5"
        noValidate
      >
        <p className="text-sm/6 text-muted">{words.intro}</p>
        <PasswordField
          label="Your password"
          name="current-password"
          autoComplete="current-password"
          required
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error ? <FormMessage>{error}</FormMessage> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !password}>
            {busy ? "Checking…" : words.action}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => go({ name: "idle" })}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (step.name === "scan") {
    const key = manualKey(step.uri);
    return (
      <form
        onSubmit={(event) => onConfirm(event, step.backupCodes)}
        className="flex flex-col gap-6"
        noValidate
      >
        <ol className="flex flex-col gap-6">
          <li className="flex flex-col gap-3">
            <p className="text-sm/6">
              <span className="font-mono text-accent">01</span>{" "}
              <span className="font-medium">Scan this with your authenticator app.</span>{" "}
              <span className="text-muted">
                Any app works: Google Authenticator, Microsoft Authenticator, Authy, 1Password,
                Bitwarden.
              </span>
            </p>
            <QrCode value={step.uri} label="QR code for your authenticator app" />
            {key ? (
              <p className="text-sm/6 text-muted">
                Can&apos;t scan it? Type this key into the app instead:{" "}
                <span className="font-mono tracking-wider break-all text-fg select-all">{key}</span>
              </p>
            ) : null}
          </li>
          <li className="flex flex-col gap-3">
            <p className="text-sm/6">
              <span className="font-mono text-accent">02</span>{" "}
              <span className="font-medium">Type the 6-digit code the app now shows.</span>
            </p>
            <Field
              label="6-digit code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={12}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="max-w-56 text-center font-mono text-xl tracking-[0.4em]"
            />
          </li>
        </ol>
        {error ? <FormMessage>{error}</FormMessage> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || code.length !== 6}>
            {busy ? "Checking…" : "Turn on two-factor"}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => go({ name: "idle" })}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (step.name === "codes") {
    return (
      <div className="flex flex-col gap-5">
        {step.first ? (
          <FormMessage tone="success">
            Two-factor is on. From now on, signing in asks for a code from your app.
          </FormMessage>
        ) : null}
        <div className="flex flex-col gap-1">
          <p className="text-base font-medium">Save your backup codes</p>
          <p className="text-sm/6 text-muted">
            If you lose your phone, each code signs you in once. Keep them somewhere only you can
            reach, such as a password manager. They are shown this once.
          </p>
        </div>
        <ul
          aria-label="Your backup codes"
          className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-line-strong bg-bg p-5 font-mono text-base tracking-wider select-all sm:max-w-md"
        >
          {step.backupCodes.map((backupCode) => (
            <li key={backupCode}>{backupCode}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => copy(step.backupCodes.join("\n"))}>
            Copy
          </Button>
          <Button variant="secondary" onClick={() => download(step.backupCodes)}>
            Download
          </Button>
        </div>
        {notice ? <FormMessage tone="info">{notice}</FormMessage> : null}
        <label className="flex items-start gap-3 text-sm/6 text-muted">
          <input
            type="checkbox"
            checked={saved}
            onChange={(event) => setSaved(event.target.checked)}
            className="mt-1 size-4 accent-accent"
          />
          <span>I have saved my backup codes somewhere safe.</span>
        </label>
        <Button
          className="self-start"
          disabled={!saved}
          onClick={() => {
            go({ name: "idle" });
            setNotice(null);
            router.refresh();
          }}
        >
          Done
        </Button>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-sm/6 text-muted">
          Two-factor is <span className="font-medium text-fg">off</span>. Turn it on and signing in
          asks for your password and then a code from an authenticator app on your phone, so someone
          who learns your password still cannot get in.
        </p>
        {notice ? <FormMessage tone="success">{notice}</FormMessage> : null}
        <Button
          className="self-start"
          onClick={() => {
            setNotice(null);
            go({ name: "password", purpose: "enable" });
          }}
        >
          Set up two-factor
        </Button>
      </div>
    );
  }

  const low = backupCodesLeft !== null && backupCodesLeft <= 3;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm/6 text-muted">
        Two-factor is <span className="font-medium text-success">on</span>. Signing in asks for a
        code from your authenticator app after your password.
      </p>
      {backupCodesLeft !== null ? (
        <p className={low ? "text-sm/6 text-warning" : "text-sm/6 text-muted"}>
          {backupCodesLeft} of {BACKUP_CODE_TOTAL} backup codes left.
          {low ? " Make new ones soon." : ""}
        </p>
      ) : null}
      {notice ? <FormMessage tone="success">{notice}</FormMessage> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => go({ name: "password", purpose: "codes" })}>
          New backup codes
        </Button>
        <Button variant="ghost" onClick={() => go({ name: "password", purpose: "disable" })}>
          Turn off two-factor
        </Button>
      </div>
    </div>
  );
}
