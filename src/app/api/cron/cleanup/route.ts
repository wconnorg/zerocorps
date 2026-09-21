import { db } from "@/db/client";
import { env } from "@/env";
import { runCleanup } from "@/lib/auth/cleanup";
import { safeEqual } from "@/lib/auth/keyed-hash";

/**
 * The daily cleanup: GET /api/cron/cleanup with `Authorization: Bearer <CRON_SECRET>`.
 *
 * Any scheduler can call it. Today that is Vercel's cron (see vercel.json), which sends
 * that header by itself when CRON_SECRET is set; on a self-hosted server it is a system
 * timer making the same request. Without the secret the answer is 401 and nothing runs.
 *
 * Besides clearing out what has expired, the daily query keeps the database from being
 * paused for inactivity on its current plan.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const presented = request.headers.get("authorization") ?? "";
  if (!safeEqual(presented, `Bearer ${env.CRON_SECRET}`)) {
    return new Response("Unauthorized\n", { status: 401 });
  }
  try {
    return Response.json({ ok: true, removed: await runCleanup(db) });
  } catch (error) {
    console.error(`[cron] the cleanup failed: ${error instanceof Error ? error.name : "error"}`);
    return Response.json({ ok: false }, { status: 503 });
  }
}
