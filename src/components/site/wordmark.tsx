import Link from "next/link";
import { cn } from "@/lib/cn";
import { site } from "@/config/site";

/** The slashed zero. Placeholder mark: replace with the real logo when there is one. */
export function ZeroMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      aria-hidden="true"
      className={cn("size-5", className)}
    >
      <ellipse cx="12" cy="12" rx="6.5" ry="9" />
      <path d="M16.2 5.6 7.8 18.4" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label={`${site.name} home`}
      className={cn("inline-flex items-center gap-2.5 text-fg", className)}
    >
      <ZeroMark className="text-accent" />
      <span className="font-mono text-sm tracking-[0.22em]">
        <span className="font-semibold">ZERO</span>
        <span className="text-muted">CORPS</span>
      </span>
    </Link>
  );
}
