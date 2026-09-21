import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
  // The address of this page carries a single-use token. It must not travel anywhere.
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-3 text-sm/6 text-muted">
        Once it is changed, every device is signed out and you sign in again with the new password.
      </p>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
