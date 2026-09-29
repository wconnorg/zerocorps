import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  formCsrfMiddleware,
  sessionMiddleware,
} from "better-auth/api";
import { and, eq, ne } from "drizzle-orm";
import * as z from "zod";
import { sessions } from "../../db/schema.ts";
import type { AuthDatabase } from "./create-auth.ts";
import type { EventLog } from "./events.ts";
import type { Limiter } from "./limits.ts";

/**
 * The one account endpoint of our own (milestone 4): signing out ONE of the member's other
 * devices, from the list in settings.
 *
 * Better Auth's own `/revoke-session` takes a session TOKEN, which would mean sending every
 * device's token to the browser to list them. This takes the session's id instead, which
 * signs nobody in, and it only ever touches a session that belongs to the member in the
 * session and is not the one they are using. "Sign out everywhere else" is Better Auth's
 * `/revoke-other-sessions`, switched on as it is.
 */

export type AccountPluginOptions = {
  db: AuthDatabase;
  limiter: Limiter;
  events: EventLog;
};

export function accountPlugin(options: AccountPluginOptions) {
  const { db, limiter, events } = options;

  return {
    id: "zerocorps-account",
    endpoints: {
      revokeDevice: createAuthEndpoint(
        "/account/sessions/revoke",
        {
          method: "POST",
          use: [formCsrfMiddleware, sessionMiddleware],
          body: z.object({ sessionId: z.string().uuid() }),
        },
        async (ctx) => {
          const { user, session } = ctx.context.session;
          const limit = await limiter.hit("sessionRevokePerUser", user.id);
          if (!limit.allowed) {
            throw new APIError("TOO_MANY_REQUESTS", {
              code: "TOO_MANY_REQUESTS",
              message: "Too many attempts. Please wait a while and try again.",
              retryAfterSeconds: limit.retryAfterSeconds,
            });
          }
          if (ctx.body.sessionId === session.id) {
            throw new APIError("BAD_REQUEST", {
              code: "CURRENT_SESSION",
              message: "That is this device. Use Sign out instead.",
            });
          }
          // The member's own, and never the current one, whatever id was sent.
          const removed = await db
            .delete(sessions)
            .where(
              and(
                eq(sessions.id, ctx.body.sessionId),
                eq(sessions.userId, user.id),
                ne(sessions.id, session.id),
              ),
            )
            .returning({ id: sessions.id });
          if (removed.length > 0) {
            await events.record({
              type: "session_revoked",
              userId: user.id,
              headers: ctx.request?.headers ?? null,
            });
          }
          return ctx.json({ ok: true, revoked: removed.length > 0 });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
