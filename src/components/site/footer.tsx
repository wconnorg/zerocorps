import Link from "next/link";
import { site } from "@/config/site";

/**
 * The public pages' footer: one slim strip under a hairline (owner, 2026-10-02). The
 * disclaimer on the left; the year and the two legal links on the right.
 */
export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="flex w-full flex-col gap-x-8 gap-y-1 px-5 py-3 text-xs/5 text-subtle sm:px-10 lg:flex-row lg:items-center lg:justify-between">
        <p className="max-w-3xl">{site.disclaimer}</p>
        <div className="flex shrink-0 items-center gap-5">
          <p>
            © {new Date().getFullYear()} {site.name}
          </p>
          <nav aria-label="Legal" className="flex gap-5">
            <Link
              href="/terms"
              className="inline-flex min-h-11 items-center underline-offset-4 hover:text-fg hover:underline"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center underline-offset-4 hover:text-fg hover:underline"
            >
              Privacy
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
