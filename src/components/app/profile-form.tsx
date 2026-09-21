"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { authFetch } from "@/lib/auth/auth-fetch";
import { checkDisplayName, DISPLAY_NAME_MAX } from "@/lib/display-name";
import { checkUsername, normalizeUsername, USERNAME_MAX } from "@/lib/username";

/**
 * The username and display-name form: `/onboarding` uses it to choose them, `/settings` to
 * change them. One form, so the two screens can never disagree about the rules.
 *
 * What is typed is checked here only to be helpful. The same rules run again on the
 * server, and only the database decides whether a name is free: the "free / taken" hint
 * promises nothing, and a name can still be refused when it is saved.
 */

type Hint =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "free" }
  | { state: "taken" }
  | { state: "unknown" };

type Available = { available: boolean; message?: string };
type Saved = { username: string; displayName: string };

const HINT_DELAY_MS = 450;

type ProfileFormProps = {
  mode: "onboarding" | "settings";
  initialUsername?: string;
  initialDisplayName?: string;
  /** Set while the wait between name changes is on: the day it ends, as `YYYY-MM-DD`. */
  changeAvailableOn?: string | null;
};

/**
 * `ProfileFields` knows nothing about the router, so it can be rendered in a test.
 * `ProfileForm` is the one the pages use: it adds where to go once the profile is saved.
 */
export function ProfileForm(props: ProfileFormProps) {
  const router = useRouter();
  return (
    <ProfileFields
      {...props}
      onSaved={() => {
        if (props.mode === "onboarding") router.replace("/dashboard");
        // The page decides what is shown next (is the name now locked?), so ask it again.
        router.refresh();
      }}
    />
  );
}

export function ProfileFields({
  mode,
  initialUsername = "",
  initialDisplayName = "",
  changeAvailableOn = null,
  onSaved,
}: ProfileFormProps & { onSaved: () => void }) {
  const [username, setUsername] = useState(initialUsername);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [current, setCurrent] = useState(initialUsername);
  const [hint, setHint] = useState<Hint>({ state: "idle" });
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Only the answer to the LATEST question is shown: answers can come back out of order.
  const asked = useRef(0);

  const locked = changeAvailableOn !== null;
  const shape = checkUsername(username);
  const typedSomething = normalizeUsername(username).length > 0;
  const isOwnName = shape.ok && shape.username === current;

  // The name worth asking the server about: well-formed, not their own, and changeable.
  const candidate = shape.ok && !isOwnName && !locked ? shape.username : null;

  useEffect(() => {
    const ticket = ++asked.current;
    if (candidate === null) return;
    const timer = setTimeout(async () => {
      setHint({ state: "checking" });
      const result = await authFetch<Available>("/profile/username-available", {
        username: candidate,
      });
      if (ticket !== asked.current) return;
      if (!result.ok) setHint({ state: "unknown" });
      else setHint({ state: result.data.available ? "free" : "taken" });
    }, HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [candidate]);

  function onUsernameChange(value: string) {
    setUsername(value.toLowerCase());
    setUsernameError(null);
    setNotice(null);
    setHint({ state: "idle" });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const name = checkUsername(username);
    const display = checkDisplayName(displayName);
    setUsernameError(name.ok ? null : name.message);
    setDisplayNameError(display.ok ? null : display.message);
    if (!name.ok || !display.ok) return;

    setBusy(true);
    const result = await authFetch<Saved>("/profile/save", {
      username: name.username,
      displayName: display.displayName,
    });
    if (result.ok) {
      // Onboarding leaves for the dashboard, so its button stays busy until it has.
      if (mode === "settings") {
        setBusy(false);
        setCurrent(result.data.username);
        setUsername(result.data.username);
        setDisplayName(result.data.displayName);
        setHint({ state: "idle" });
        setNotice("Saved.");
      }
      onSaved();
      return;
    }
    setBusy(false);
    if (result.field === "username") setUsernameError(result.message);
    else if (result.field === "displayName") setDisplayNameError(result.message);
    else setError(result.message);
  }

  const liveUsernameError =
    usernameError ?? (typedSomething && !shape.ok && !locked ? shape.message : null);
  const usernameHint = locked ? (
    `You changed your username recently. You can change it again after ${changeAvailableOn}.`
  ) : hint.state === "checking" ? (
    "Checking…"
  ) : hint.state === "free" ? (
    <span className="text-success">That name is free.</span>
  ) : hint.state === "taken" ? (
    <span className="text-danger">That name is taken.</span>
  ) : mode === "onboarding" ? (
    "3 to 20 characters: letters, numbers and underscores. This is how other members find you."
  ) : (
    "Your first change is free. After that, once every 30 days. Your old name is kept for you for 30 days."
  );

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5" noValidate>
      <Field
        label="Username"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={USERNAME_MAX}
        required
        autoFocus={mode === "onboarding"}
        readOnly={locked}
        value={username}
        onChange={(event) => onUsernameChange(event.target.value)}
        hint={usernameHint}
        error={liveUsernameError}
        className="font-mono"
      />
      <Field
        label="Display name (optional)"
        name="displayName"
        autoComplete="name"
        maxLength={DISPLAY_NAME_MAX * 2}
        value={displayName}
        onChange={(event) => {
          setDisplayName(event.target.value);
          setDisplayNameError(null);
          setNotice(null);
        }}
        hint="Shown beside your username. Leave it blank to go by your username alone."
        error={displayNameError}
      />
      {error ? <FormMessage>{error}</FormMessage> : null}
      {notice ? <FormMessage tone="success">{notice}</FormMessage> : null}
      <Button
        type="submit"
        size="lg"
        disabled={busy || !shape.ok || hint.state === "taken"}
        className="w-full"
      >
        {busy ? "Saving…" : mode === "onboarding" ? "Continue to the dashboard" : "Save changes"}
      </Button>
    </form>
  );
}
