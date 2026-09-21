"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth/auth-fetch";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authFetch("/sign-out");
    router.replace("/");
    router.refresh();
  }

  return (
    <Button variant="secondary" disabled={pending} onClick={signOut}>
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
