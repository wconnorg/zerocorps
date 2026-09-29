"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, PasswordField } from "@/components/ui/field";
import { authFetch } from "@/lib/auth/auth-fetch";

/**
 * Changing the password (milestone 4): the current one, the new one twice. The server
 * checks the current password, signs every other device out, and emails the member; the
 * rules on the new one (12 to 128 characters) are the server's too.
 */
export function PasswordForm() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (next.length < 12) return setError("Use at least 12 characters for the new password.");
    if (next !== again) return setError("The two new passwords are not the same.");
    setBusy(true);
    const result = await authFetch("/change-password", {
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (!result.ok) {
      setError(
        result.code === "INVALID_PASSWORD" ? "That is not your current password." : result.message,
      );
      return;
    }
    setCurrent("");
    setNext("");
    setAgain("");
    setNotice("Password changed. Every other device is signed out, and we emailed you.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <PasswordField
        label="Current password"
        name="current-password"
        autoComplete="current-password"
        required
        value={current}
        onChange={(event) => setCurrent(event.target.value)}
      />
      <PasswordField
        label="New password"
        name="new-password"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
        hint="At least 12 characters. A phrase you will remember is best."
        value={next}
        onChange={(event) => setNext(event.target.value)}
      />
      <PasswordField
        label="New password, again"
        name="new-password-again"
        autoComplete="new-password"
        required
        value={again}
        onChange={(event) => setAgain(event.target.value)}
      />
      {error ? <FormMessage>{error}</FormMessage> : null}
      {notice ? <FormMessage tone="success">{notice}</FormMessage> : null}
      <Button type="submit" disabled={busy || !current || !next || !again} className="self-start">
        {busy ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}
