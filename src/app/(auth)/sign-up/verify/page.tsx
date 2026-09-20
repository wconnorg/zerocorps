import type { Metadata } from "next";
import { VerifyCodeForm } from "@/components/auth/verify-code-form";

export const metadata: Metadata = {
  title: "Enter your code",
  robots: { index: false },
};

export default function VerifyCodePage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Enter your code</h1>
      <VerifyCodeForm />
    </>
  );
}
