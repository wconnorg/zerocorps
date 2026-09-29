"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { authFetch } from "@/lib/auth/auth-fetch";

/**
 * The browsers signed in to this account (milestone 4), with a way to sign any other one
 * out, or all of them. Each row carries a session's id, which signs nobody in; the
 * server only ever signs out the member's own sessions.
 */

export type DeviceView = {
  id: string;
  device: string;
  network: string | null;
  signedIn: string;
  lastActive: string;
  current: boolean;
};

export function DevicesList({ devices }: { devices: DeviceView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const others = devices.filter((device) => !device.current).length;

  async function run(key: string, path: string, body?: Record<string, unknown>) {
    setBusy(key);
    setError(null);
    const result = await authFetch(path, body);
    setBusy(null);
    if (!result.ok) return setError(result.message);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
        {devices.map((device) => (
          <li
            key={device.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-2 font-medium">
                {device.device}
                {device.current ? (
                  <span className="rounded-full border border-success/50 px-2 py-0.5 font-mono text-[0.625rem] tracking-[0.14em] text-success">
                    THIS DEVICE
                  </span>
                ) : null}
              </span>
              <span className="text-xs/5 text-muted">
                Signed in {device.signedIn} · last active {device.lastActive}
                {device.network ? ` · network ${device.network}` : ""}
              </span>
            </div>
            {device.current ? null : (
              <Button
                variant="secondary"
                disabled={busy !== null}
                onClick={() => run(device.id, "/account/sessions/revoke", { sessionId: device.id })}
              >
                {busy === device.id ? "Signing out…" : "Sign out"}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {others > 0 ? (
        <Button
          variant="secondary"
          className="self-start"
          disabled={busy !== null}
          onClick={() => run("all", "/revoke-other-sessions")}
        >
          {busy === "all" ? "Signing out…" : "Sign out everywhere else"}
        </Button>
      ) : (
        <p className="text-sm text-muted">No other device is signed in.</p>
      )}
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}
