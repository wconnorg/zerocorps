"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

/** Which sign-in the member closed the banner for: one browser's own note, nothing more. */
const STORAGE_KEY = "zc-2fa-banner-closed";
const CHANGED = "zc-2fa-banner-changed";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

function closedFor(sessionId: string): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === sessionId;
  } catch {
    // Storage blocked: show the banner. Closing it then hides it until the page reloads.
    return false;
  }
}

/**
 * "Secure your account" (milestone 5): shown on the dashboard to a member without
 * two-factor. The X closes it for this sign-in only; the next sign-in asks again. It is
 * drawn only in the browser, after reading that note, so it never flashes and vanishes.
 */
export function SecureAccountBanner({ sessionId }: { sessionId: string }) {
  const hidden = useSyncExternalStore(
    subscribe,
    () => closedFor(sessionId),
    () => true,
  );
  if (hidden) return null;

  function close() {
    try {
      window.localStorage.setItem(STORAGE_KEY, sessionId);
    } catch {
      // Nothing to keep it in: it stays closed until the page reloads.
    }
    window.dispatchEvent(new Event(CHANGED));
  }

  return (
    <section
      aria-labelledby="secure-account-heading"
      className="relative mt-8 flex flex-col gap-4 border border-accent/50 bg-surface p-5 pr-12 sm:flex-row sm:items-center sm:justify-between sm:p-6 sm:pr-14"
    >
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[0.6875rem] tracking-[0.22em] text-accent">SECURITY</p>
        <h2 id="secure-account-heading" className="text-base font-medium">
          Secure your account with two-factor
        </h2>
        <p className="text-sm/6 text-muted">
          A code from an app on your phone after your password, so a stolen password is not enough.
          It takes two minutes.
        </p>
      </div>
      <Link
        href="/settings#two-factor"
        prefetch={false}
        className="inline-flex h-11 shrink-0 items-center justify-center bg-accent px-5 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent/90"
      >
        Set it up
      </Link>
      <button
        type="button"
        onClick={close}
        aria-label="Close for now"
        className="absolute top-3 right-3 inline-flex size-8 items-center justify-center text-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4">
          <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
    </section>
  );
}
