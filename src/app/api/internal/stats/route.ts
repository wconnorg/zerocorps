import { db } from "@/db/client";
import { env } from "@/env";
import { createLimiter } from "@/lib/auth/limits";
import { stats } from "@/lib/internal/internal-api";

/**
 * GET /api/internal/stats, for Agent Zero only (milestone 8):
 * `X-Internal-Secret: <INTERNAL_API_SECRET>`. Answers { academyMembers }.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return await stats(
      { db, limiter: createLimiter(db, env.HMAC_SECRET), secret: env.INTERNAL_API_SECRET },
      request,
    );
  } catch (error) {
    console.error(`[internal] stats failed: ${error instanceof Error ? error.name : "error"}`);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
