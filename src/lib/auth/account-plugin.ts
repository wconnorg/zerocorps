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
import {
  AvatarError,
  MAX_UPLOAD_BYTES,
  processAvatar,
  removeAvatar,
  saveAvatar,
} from "../avatars/avatars.ts";
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
 *
 * And the profile picture (milestone 3): set it, or remove it. The browser shrinks the
 * picture first and sends it as base64 in JSON; the server decodes and re-encodes it
 * whatever it is (src/lib/avatars/avatars.ts), so only clean pixels are ever stored.
 */

const AVATAR_MESSAGES: Record<AvatarError["reason"], string> = {
  "too-large": "That picture is too large. Try a smaller one.",
  "not-an-image": "That file is not a picture we can read.",
  unsupported: "Use a JPEG, PNG or WebP picture.",
};
// base64 grows by a third; a little room for padding.
const MAX_BASE64_LENGTH = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4;

export type AccountPluginOptions = {
  db: AuthDatabase;
  limiter: Limiter;
  events: EventLog;
};

export function accountPlugin(options: AccountPluginOptions) {
  const { db, limiter, events } = options;

  const avatarLimit = async (userId: string) => {
    const limit = await limiter.hit("avatarChangePerUser", userId);
    if (!limit.allowed) {
      throw new APIError("TOO_MANY_REQUESTS", {
        code: "TOO_MANY_REQUESTS",
        message: "Too many changes. Please wait a while and try again.",
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }
  };

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
      setAvatar: createAuthEndpoint(
        "/account/avatar",
        {
          method: "POST",
          use: [formCsrfMiddleware, sessionMiddleware],
          body: z.object({
            image: z
              .string()
              .min(1)
              .max(MAX_BASE64_LENGTH)
              .regex(/^[A-Za-z0-9+/]+={0,2}$/),
          }),
        },
        async (ctx) => {
          const { user } = ctx.context.session;
          await avatarLimit(user.id);
          let image: Buffer;
          try {
            image = await processAvatar(Buffer.from(ctx.body.image, "base64"));
          } catch (error) {
            if (!(error instanceof AvatarError)) throw error;
            throw new APIError("BAD_REQUEST", {
              code: "BAD_IMAGE",
              message: AVATAR_MESSAGES[error.reason],
            });
          }
          await saveAvatar(db, user.id, image, new Date());
          return ctx.json({ ok: true });
        },
      ),
      removeAvatar: createAuthEndpoint(
        "/account/avatar/remove",
        { method: "POST", use: [formCsrfMiddleware, sessionMiddleware] },
        async (ctx) => {
          const { user } = ctx.context.session;
          await avatarLimit(user.id);
          const removed = await removeAvatar(db, user.id);
          return ctx.json({ ok: true, removed });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
