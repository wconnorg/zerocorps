import type { Metadata } from "next";
import { Wordmark } from "@/components/site/wordmark";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main
      id="main"
      className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center"
    >
      <Wordmark />
      <p className="mt-12 font-mono text-xs tracking-[0.22em] text-subtle">ERROR 404</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Nothing here.</h1>
      <p className="mt-4 max-w-sm text-base/7 text-muted">
        The page you were looking for does not exist or has moved.
      </p>
      <ButtonLink href="/" variant="secondary" className="mt-9">
        Back to home
      </ButtonLink>
    </main>
  );
}
