import { cn } from "@/lib/cn";

/**
 * A member's picture: their own upload when there is one (`src`), otherwise the blank grey
 * default the brief asks for, the same everywhere. It takes its colours from the theme
 * tokens, so it works in both themes.
 */
export function Avatar({ src, className }: { src?: string | null; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-raised text-subtle",
        className,
      )}
    >
      {src ? (
        // A same-origin, already 256px picture: there is nothing for next/image to optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <DefaultPicture />
      )}
    </span>
  );
}

export function DefaultPicture() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-full">
      <circle cx="12" cy="9.5" r="4" />
      <path d="M3.5 24c.6-5.2 4.2-8.5 8.5-8.5s7.9 3.3 8.5 8.5Z" />
    </svg>
  );
}

/** Sent by the settings page when the picture changed, so the header shows it at once. */
export const AVATAR_CHANGED = "zc-avatar-changed";
