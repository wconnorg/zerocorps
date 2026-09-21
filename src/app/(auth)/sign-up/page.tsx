import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { env } from "@/env";

export const metadata: Metadata = {
  title: "Sign up",
  robots: { index: false },
};

/**
 * SIGNUP_MODE decides what this page shows, and the server enforces the same mode at
 * the start of a sign-up and again when the code is checked. Hiding the form is a
 * courtesy; it is not the control.
 */
export default function SignUpPage() {
  if (env.SIGNUP_MODE === "closed") {
    return (
      <>
        <p className="font-mono text-xs tracking-[0.22em] text-subtle">OPENING SOON</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Sign-ups open soon</h1>
        <p className="mt-3 text-sm/6 text-muted">
          Accounts are not open yet. The ZeroCorps Discord is where it will be announced first, and
          you never need a site account to be part of it.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          {env.DISCORD_INVITE_URL ? (
            <a
              href={env.DISCORD_INVITE_URL}
              rel="noopener noreferrer"
              className={buttonClasses({ size: "lg", className: "w-full" })}
            >
              Join the Discord
            </a>
          ) : null}
          <ButtonLink href="/sign-in" variant="secondary" className="w-full">
            I already have an account
          </ButtonLink>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-3 text-sm/6 text-muted">
        An email address and a password. We email you a 6-digit code to confirm the address, and
        nothing is created until you enter it.
      </p>
      <SignUpForm
        inviteOnly={env.SIGNUP_MODE === "allowlist"}
        discordInviteUrl={env.DISCORD_INVITE_URL}
      />
    </>
  );
}
