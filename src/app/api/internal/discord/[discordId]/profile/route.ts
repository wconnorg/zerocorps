import { db } from "@/db/client";
import { env } from "@/env";
import { createLimiter } from "@/lib/auth/limits";
import { discordProfile } from "@/lib/internal/internal-api";

/**
 * GET /api/internal/discord/:discordId/profile, for Agent Zero only (milestone 8):
 * `X-Internal-Secret: <INTERNAL_API_SECRET>`. Answers { linked, username, rank } or 404.
 * The rules are in `src/lib/internal/internal-api.ts`.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: RouteContext<"/api/internal/discord/[discordId]/profile">,
) {
  const { discordId } = await context.params;
  try {
    return await discordProfile(
      { db, limiter: createLimiter(db, env.HMAC_SECRET), secret: env.INTERNAL_API_SECRET },
      request,
      discordId,
    );
  } catch (error) {
    console.error(`[internal] profile failed: ${error instanceof Error ? error.name : "error"}`);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
