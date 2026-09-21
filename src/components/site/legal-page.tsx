import type { ReactNode } from "react";
import { LEGAL_LAST_UPDATED, TERMS_VERSION } from "@/config/legal";

/**
 * The shared frame of /terms and /privacy. Both are DRAFTS written as a starting point:
 * the owner reads, changes and approves the wording before sign-ups open. Remove the
 * `draft` flag from a page only when that has happened.
 */
export function LegalPage({
  title,
  draft,
  children,
}: {
  title: string;
  draft: boolean;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16">
      {draft ? (
        <p
          role="note"
          className="mb-8 rounded-lg border border-warning/50 bg-surface px-4 py-3 text-sm/6 text-fg"
        >
          <strong className="font-semibold">Draft.</strong> This text is a starting point that has
          not been reviewed or approved yet. It is not in force.
        </p>
      ) : null}
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-subtle">
        Last updated {LEGAL_LAST_UPDATED} · version {TERMS_VERSION}
      </p>
      <div className="mt-10 flex flex-col gap-10">{children}</div>
    </article>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 text-base/7 text-muted">
      <h2 className="text-xl font-semibold tracking-tight text-fg">{heading}</h2>
      {children}
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-subtle">{children}</ul>;
}

/** The contact line. The address comes from an environment variable: it must be one that works. */
export function LegalContact({ contact }: { contact: string | undefined }) {
  if (!contact) {
    return <p>A contact address will be published here before sign-ups open.</p>;
  }
  const label = contact.replace(/^mailto:/, "");
  return (
    <p>
      Contact us at{" "}
      <a href={contact} rel="noopener noreferrer" className="text-fg underline underline-offset-4">
        {label}
      </a>
      .
    </p>
  );
}
