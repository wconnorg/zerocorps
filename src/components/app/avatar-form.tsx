"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { authFetch } from "@/lib/auth/auth-fetch";
import { AVATAR_CHANGED, Avatar } from "./avatar";

/**
 * Choosing, changing or removing the profile picture (settings and onboarding).
 *
 * The browser shrinks the picture to at most 1024 pixels a side and re-draws it as a JPEG
 * before it is sent: a phone photo of several megabytes becomes a few hundred kilobytes,
 * and any format the browser can open works. None of this is trusted: the server decodes,
 * crops and re-encodes whatever arrives (src/lib/avatars/avatars.ts).
 */

const LONGEST_SIDE = 1024;
/** Beyond this the browser is not asked to open the file at all. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!blob) throw new Error("no blob");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

export function AvatarForm({ version }: { version: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(path: string, body?: Record<string, unknown>) {
    const result = await authFetch(path, body);
    setBusy(null);
    if (!result.ok) return setError(result.message);
    window.dispatchEvent(new Event(AVATAR_CHANGED));
    router.refresh();
  }

  async function chosen(file: File | undefined) {
    if (input.current) input.current.value = "";
    if (!file) return;
    setError(null);
    if (file.size > MAX_FILE_BYTES)
      return setError("That picture is too large. Try a smaller one.");
    setBusy("upload");
    let image: string;
    try {
      image = await shrink(file);
    } catch {
      setBusy(null);
      return setError("That file is not a picture this browser can open.");
    }
    await send("/account/avatar", { image });
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <Avatar src={version ? `/api/avatar?v=${version}` : null} className="size-20" />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => chosen(event.target.files?.[0])}
          />
          <Button
            variant="secondary"
            disabled={busy !== null}
            onClick={() => input.current?.click()}
          >
            {busy === "upload" ? "Uploading…" : version ? "Change picture" : "Add a picture"}
          </Button>
          {version ? (
            <Button
              variant="secondary"
              disabled={busy !== null}
              onClick={() => {
                setBusy("remove");
                setError(null);
                void send("/account/avatar/remove");
              }}
            >
              {busy === "remove" ? "Removing…" : "Remove"}
            </Button>
          ) : null}
        </div>
        <p className="text-xs/5 text-muted">
          Cropped to a square. Only the picture is kept: location and camera details are removed.
        </p>
        {error ? <FormMessage>{error}</FormMessage> : null}
      </div>
    </div>
  );
}
