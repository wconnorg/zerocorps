import Link from "next/link";
import { cn } from "@/lib/cn";
import { site } from "@/config/site";

/**
 * The ZeroCorps mark: the owner's hand-drawn slashed zero. The image is used as a mask, so
 * the mark takes the colour of the text around it and works in both themes.
 */
export function ZeroMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("zero-mark inline-block size-6 shrink-0", className)} />
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
        <span className="text-accent">CORPS</span>
      </span>
    </Link>
  );
}

/** The name in running text: "Zero" in the text colour, "Corps" in the brand red. */
export function BrandName({ uppercase = false }: { uppercase?: boolean }) {
  return (
    <>
      <span className="text-fg">{uppercase ? "ZERO" : "Zero"}</span>
      <span className="text-accent">{uppercase ? "CORPS" : "Corps"}</span>
    </>
  );
}
