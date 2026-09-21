import { ButtonLink } from "@/components/ui/button";

/** Shown when the database cannot be reached. Nothing is lost; there is just nothing to show. */
export function Unavailable() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 py-24 text-center">
      <p className="font-mono text-xs tracking-[0.22em] text-subtle">TEMPORARILY UNAVAILABLE</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        We can&apos;t reach your account right now
      </h1>
      <p className="mt-3 text-sm/6 text-muted">
        Nothing is lost. This usually clears within a few minutes. Please try again shortly.
      </p>
      <ButtonLink href="/" variant="secondary" className="mt-8">
        Back to the home page
      </ButtonLink>
    </div>
  );
}
