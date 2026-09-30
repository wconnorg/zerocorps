import { db } from "@/db/client";
import { auth } from "@/lib/auth";
import { serveAvatar } from "@/lib/avatars/avatars";

/**
 * GET /api/avatar: the signed-in member's own profile picture (src/lib/avatars/avatars.ts
 * has the rules). An empty 204 means "none", and the page keeps the grey default.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const member = session ? { id: session.user.id, avatar: session.user.image ?? null } : null;
    return await serveAvatar(db, member, request.headers.get("if-none-match"));
  } catch (error) {
    console.error(`[avatar] could not be served: ${error instanceof Error ? error.name : "error"}`);
    return new Response(null, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
