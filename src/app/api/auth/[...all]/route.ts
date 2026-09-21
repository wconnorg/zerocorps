import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

/**
 * Every Better Auth endpoint, ours included, under /api/auth. The forms call these
 * over HTTP on purpose: the origin check, the CSRF check, the rate limiter and the list
 * of disabled endpoints exist only on this route, not on server-side calls
 * (docs/DECISIONS.md, finding 18).
 */
export const { GET, POST } = toNextJsHandler(auth);
