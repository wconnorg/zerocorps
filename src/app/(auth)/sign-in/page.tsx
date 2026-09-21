import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default function SignInPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-3 text-sm/6 text-muted">
        With the email address and password of your account.
      </p>
      {/* The form reads ?next= from the address bar, which needs a Suspense boundary to stay static. */}
      <Suspense>
        <SignInForm />
      </Suspense>
    </>
  );
}
