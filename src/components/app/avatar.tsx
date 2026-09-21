import { cn } from "@/lib/cn";

/**
 * A member's picture. Until uploads exist (and for anyone who never adds one) it is the
 * blank grey default the brief asks for, the same everywhere. It takes its colours from
 * the theme tokens, so it works in both themes.
 */
export function Avatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-raised text-subtle",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-full">
        <circle cx="12" cy="9.5" r="4" />
        <path d="M3.5 24c.6-5.2 4.2-8.5 8.5-8.5s7.9 3.3 8.5 8.5Z" />
      </svg>
    </span>
  );
}
