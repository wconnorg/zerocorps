import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  formCsrfMiddleware,
  sessionMiddleware,
} from "better-auth/api";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { users } from "../../db/schema.ts";
import { checkDisplayName } from "../display-name.ts";
import { checkUsername } from "../username.ts";
import type { AuthDatabase } from "./create-auth.ts";
import type { EventLog } from "./events.ts";
import type { Limiter } from "./limits.ts";
import { isUsernameAvailable, setUsername } from "./username-claim.ts";

/**
 * A member's username and display name: the two endpoints behind `/onboarding` and
 * `/settings`.
 *
 * It is a local plugin, like the sign-up one, so it sits behind everything Better Auth
 * already does for its own endpoints: the origin check on any request that carries the
 * session cookie, and the coarse per-IP limiter. Better Auth's own username plugin is NOT
 * used: it adds a way to sign in by username, which breaks hard rule 1.
 *
 * Both endpoints are for a signed-in member only, and the member is taken from the
 * SESSION, never from the request: nobody can name another member's id.
 */

export type ProfilePluginOptions = {
  db: AuthDatabase;
  limiter: Limiter;
  events: EventLog;
};

const tooMany = (retryAfterSeconds: number) =>
  new APIError("TOO_MANY_REQUESTS", {
    code: "TOO_MANY_REQUESTS",
    message: "Too many attempts. Please wait a while and try again.",
    retryAfterSeconds,
  });

export function profilePlugin(options: ProfilePluginOptions) {
  const { db, limiter, events } = options;

  return {
    id: "zerocorps-profile",
    endpoints: {
      /**
       * The "free / taken" hint while a member types. It promises nothing: only saving
       * decides. Signed-in only and counted per member, so it cannot be used to list the
       * names that exist.
       */
      usernameAvailable: createAuthEndpoint(
        "/profile/username-available",
        {
          method: "POST",
          use: [formCsrfMiddleware, sessionMiddleware],
          body: z.object({ username: z.string().max(64) }),
        },
        async (ctx) => {
          const userId = ctx.context.session.user.id;
          const limit = await limiter.hit("usernameCheckPerUser", userId);
          if (!limit.allowed) throw tooMany(limit.retryAfterSeconds);

          const check = checkUsername(ctx.body.username);
          if (!check.ok) {
            return ctx.json({ available: false, problem: check.problem, message: check.message });
          }
          const available = await isUsernameAvailable(db, check.username, new Date(), userId);
          return ctx.json({
            available,
            username: check.username,
            message: available ? "That name is free." : "That name is taken.",
          });
        },
      ),

      /**
       * Saves the username and the display name together: onboarding's one button, and
       * the settings page's. The name goes through `setUsername`, which holds every rule.
       */
      saveProfile: createAuthEndpoint(
        "/profile/save",
        {
          method: "POST",
          use: [formCsrfMiddleware, sessionMiddleware],
          body: z.object({
            username: z.string().max(64),
            displayName: z.string().max(200).optional(),
          }),
        },
        async (ctx) => {
          const userId = ctx.context.session.user.id;
          const headers = ctx.request?.headers ?? null;
          const limit = await limiter.hit("profileSavePerUser", userId);
          if (!limit.allowed) {
            await events.record({ type: "rate_limited", userId, detail: "profile_save", headers });
            throw tooMany(limit.retryAfterSeconds);
          }

          // Judge the display name BEFORE touching the username, so a bad one changes nothing.
          const display = checkDisplayName(ctx.body.displayName ?? "");
          if (!display.ok) {
            throw new APIError("BAD_REQUEST", {
              code: "INVALID_DISPLAY_NAME",
              message: display.message,
              field: "displayName",
            });
          }

          const result = await setUsername(db, {
            userId,
            username: ctx.body.username,
            now: new Date(),
          });
          if (!result.ok) {
            const code = {
              invalid: "INVALID_USERNAME",
              taken: "USERNAME_TAKEN",
              "too-soon": "USERNAME_CHANGE_TOO_SOON",
            }[result.refusal];
            throw new APIError(result.refusal === "too-soon" ? "FORBIDDEN" : "BAD_REQUEST", {
              code,
              message: result.message,
              field: "username",
            });
          }

          await db
            .update(users)
            .set({ displayName: display.displayName, updatedAt: new Date() })
            .where(eq(users.id, userId));

          if (result.changed) {
            await events.record({ type: "username_changed", userId, headers });
          } else if (
            // Better Auth's own type for the session's user does not know our extra field.
            (ctx.context.session.user as { username?: string | null }).username !== result.username
          ) {
            await events.record({ type: "username_claimed", userId, headers });
          }
          return ctx.json({
            ok: true,
            username: result.username,
            displayName: display.displayName,
          });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
