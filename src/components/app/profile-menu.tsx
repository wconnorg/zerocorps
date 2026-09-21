"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { authFetch } from "@/lib/auth/auth-fetch";
import { Avatar } from "./avatar";

/**
 * The profile button at the top right of the signed-in area, and its small menu.
 *
 * Until profile and settings exist the menu holds only "Sign out" (owner, 2026-09-21).
 * It is a plain disclosure menu with no library: the button says whether it is open,
 * the first item takes focus when it opens, and Escape, a click outside or focus moving
 * away closes it again. Escape puts focus back on the button.
 *
 * `ProfileMenu` knows nothing about the router, so it can be rendered in a test.
 * `AccountMenu` is the one the layout uses: it adds the real sign-out.
 */
export function ProfileMenu({
  onSignOut,
  pending = false,
  defaultOpen = false,
}: {
  onSignOut: () => void;
  pending?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    firstItem.current?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex rounded-full transition-opacity hover:opacity-80"
      >
        <Avatar />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className="absolute top-full right-0 z-50 mt-2 w-48 rounded-xl border border-line bg-surface p-1 shadow-lg"
        >
          <button
            ref={firstItem}
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={onSignOut}
            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-raised disabled:pointer-events-none disabled:opacity-50"
          >
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AccountMenu() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authFetch("/sign-out");
    router.replace("/");
    router.refresh();
  }

  return <ProfileMenu onSignOut={signOut} pending={pending} />;
}
