import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Sign up",
  robots: { index: false },
};

// Placeholder so the Academy's links resolve. Milestone 2 replaces this with the real form.
export default function SignUpPage() {
  return (
    <>
      <p className="font-mono text-xs tracking-[0.22em] text-subtle">COMING NEXT</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Sign up</h1>
      <p className="mt-3 text-sm/6 text-muted">
        Accounts open with the next milestone. You will sign up with an email address and a
        password, then verify your email.
      </p>
      <ButtonLink href="/academy" variant="secondary" className="mt-8 w-full">
        Back to the Academy
      </ButtonLink>
    </>
  );
}
