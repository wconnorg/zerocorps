import type { Metadata } from "next";
import { Suspense } from "react";
import { TwoFactorForm } from "@/components/auth/two-factor-form";

export const metadata: Metadata = {
  title: "Two-factor code",
  robots: { index: false },
};

/**
 * The code step of signing in (milestone 5). Static on purpose: whether this browser has a
 * sign-in waiting for its code is known only from its signed cookie, which the server checks
 * when the code is sent.
 */
export default function TwoFactorPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Two-factor code</h1>
      <p className="mt-3 text-sm/6 text-muted">
        Your password was right. One more step: this account asks for a code.
      </p>
      {/* The form reads ?next= from the address bar, which needs a Suspense boundary to stay static. */}
      <Suspense>
        <TwoFactorForm />
      </Suspense>
    </>
  );
}
