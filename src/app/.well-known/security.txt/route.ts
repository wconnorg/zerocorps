import { env } from "@/env";
import { buildSecurityTxt } from "@/lib/auth/cleanup";

/**
 * /.well-known/security.txt (RFC 9116). Built once per deploy, so `Expires` moves
 * forward with every release. The contact is SECURITY_CONTACT: a published address must
 * be one that works, so it is set by the owner and never hard-coded.
 */
export const dynamic = "force-static";

export function GET() {
  if (!env.SECURITY_CONTACT) {
    return new Response("No security contact has been published yet.\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const body = buildSecurityTxt({
    contact: env.SECURITY_CONTACT,
    siteUrl: env.NEXT_PUBLIC_APP_URL,
    now: new Date(),
  });
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
