"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, PasswordField } from "@/components/ui/field";
import { authFetch } from "@/lib/auth/auth-fetch";

/**
 * Deleting the account (milestone 4). It cannot be undone, so it asks twice: the password,
 * which the server checks, and the word DELETE typed out. Everything tied to the account
 * goes with it: progress, rank, username, Discord link and every signed-in device.
 */
export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const result = await authFetch("/delete-user", { password });
    setBusy(false);
    if (!result.ok) {
      setError(result.code === "INVALID_PASSWORD" ? "That is not your password." : result.message);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm/6 text-muted">
          Deletes your account and everything tied to it: your progress, rank, username, Discord
          link and every signed-in device. It cannot be undone.
        </p>
        <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>
          Delete my account…
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <FormMessage>
        This deletes your account and everything tied to it, at once and for good. It cannot be
        undone.
      </FormMessage>
      <PasswordField
        label="Your password"
        name="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Field
        label="Type DELETE to confirm"
        name="confirm"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
      />
      {error ? <FormMessage>{error}</FormMessage> : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy || !password || confirm.trim() !== "DELETE"}
          className="inline-flex h-10 items-center rounded-lg bg-danger px-4 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Delete my account for good"}
        </button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          Keep my account
        </Button>
      </div>
    </form>
  );
}
