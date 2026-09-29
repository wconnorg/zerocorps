"use client";

import { useEffect, useState } from "react";
import { AVATAR_CHANGED, DefaultPicture } from "./avatar";

/**
 * The picture in the header. The header belongs to a layout, which knows nothing about the
 * session, so it simply asks for `/api/avatar`: the member's own picture, or a 404 and the
 * grey default stays. The picture is shown only once it has loaded, so a missing one never
 * flashes a broken image. The settings page announces a change, and a new request follows.
 */
export function AccountAvatar() {
  const [round, setRound] = useState(0);

  useEffect(() => {
    const changed = () => setRound((value) => value + 1);
    window.addEventListener(AVATAR_CHANGED, changed);
    return () => window.removeEventListener(AVATAR_CHANGED, changed);
  }, []);

  return (
    <span
      aria-hidden="true"
      className="relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-raised text-subtle"
    >
      <DefaultPicture />
      {/* eslint-disable-next-line @next/next/no-img-element -- see Avatar */}
      <img
        key={round}
        src={round === 0 ? "/api/avatar" : `/api/avatar?r=${round}`}
        alt=""
        // A picture that loaded before React took over fires no load event: check on mount.
        ref={(element) => {
          if (element?.complete && element.naturalWidth > 0) element.dataset.loaded = "";
        }}
        onLoad={(event) => {
          event.currentTarget.dataset.loaded = "";
        }}
        className="absolute inset-0 size-full object-cover opacity-0 data-loaded:opacity-100"
      />
    </span>
  );
}
