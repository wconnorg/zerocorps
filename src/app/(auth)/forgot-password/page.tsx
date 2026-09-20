import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata: Metadata = {
  title: "Forgot your password",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
      <p className="mt-3 text-sm/6 text-muted">
        Enter the email address of your account and we will send a link to choose a new password.
      </p>
      <ForgotPasswordForm />
    </>
  );
}
