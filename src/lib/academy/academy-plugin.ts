import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  formCsrfMiddleware,
  sessionMiddleware,
} from "better-auth/api";
import * as z from "zod";
import type { AuthDatabase } from "../auth/create-auth.ts";
import type { Limiter } from "../auth/limits.ts";
import type { Catalog } from "./content.ts";
import { completeLesson, submitCheckpoint } from "./progress.ts";
import { BRONZE_KEY } from "./standing.ts";

/**
 * The Academy's two writes: marking a lesson complete, and submitting a checkpoint.
 *
 * A local Better Auth plugin, like the username one, so both sit behind what Better Auth
 * already does for its own endpoints: the origin check on any request that carries the
 * session cookie, and the coarse per-IP limiter. The member is taken from the SESSION,
 * never from the request, and every id is checked against the lesson files.
 *
 * `catalog` is a function so that, on the laptop, a lesson the owner has just edited is
 * what gets checked.
 */

export type AcademyPluginOptions = {
  db: AuthDatabase;
  limiter: Limiter;
  catalog: () => Catalog;
  /**
   * Called when a member earns a rank (today: Bronze, for finishing Levels 1 and 2), so the
   * Discord role can follow straight away. Must not throw.
   */
  onRankChange?: (userId: string) => Promise<void>;
};

const tooMany = (retryAfterSeconds: number) =>
  new APIError("TOO_MANY_REQUESTS", {
    code: "TOO_MANY_REQUESTS",
    message: "Too many attempts. Please wait a while and try again.",
    retryAfterSeconds,
  });

const notFound = () =>
  new APIError("NOT_FOUND", {
    code: "NOT_FOUND",
    message: "That lesson is not available.",
  });

const idField = z.string().min(1).max(80);

export function academyPlugin(options: AcademyPluginOptions) {
  const { db, limiter, catalog, onRankChange } = options;
  const rankChanged = async (userId: string, newSteps: string[]) => {
    if (onRankChange && newSteps.includes(BRONZE_KEY)) await onRankChange(userId);
  };

  return {
    id: "zerocorps-academy",
    endpoints: {
      completeLesson: createAuthEndpoint(
        "/academy/complete",
        {
          method: "POST",
          use: [formCsrfMiddleware, sessionMiddleware],
          body: z.object({ lessonId: idField }),
        },
        async (ctx) => {
          const userId = ctx.context.session.user.id;
          const limit = await limiter.hit("lessonCompletePerUser", userId);
          if (!limit.allowed) throw tooMany(limit.retryAfterSeconds);

          const result = await completeLesson(db, catalog(), {
            userId,
            lessonId: ctx.body.lessonId,
            now: new Date(),
          });
          if (!result.ok) throw notFound();
          await rankChanged(userId, result.newSteps);
          return ctx.json({ ok: true, newSteps: result.newSteps });
        },
      ),

      submitCheckpoint: createAuthEndpoint(
        "/academy/checkpoint",
        {
          method: "POST",
          use: [formCsrfMiddleware, sessionMiddleware],
          body: z.object({
            chapterId: idField,
            answers: z.array(z.number().int().min(0).max(9)).min(1).max(50),
          }),
        },
        async (ctx) => {
          const userId = ctx.context.session.user.id;
          // Counted before grading, pass or fail: guessing through the options is slow.
          const limit = await limiter.hit("checkpointSubmitPerUser", userId);
          if (!limit.allowed) throw tooMany(limit.retryAfterSeconds);

          const result = await submitCheckpoint(db, catalog(), {
            userId,
            chapterId: ctx.body.chapterId,
            answers: ctx.body.answers,
            now: new Date(),
          });
          if (!result.ok) {
            if (result.reason === "not-found") throw notFound();
            if (result.reason === "lessons-not-done") {
              throw new APIError("FORBIDDEN", {
                code: "LESSONS_NOT_DONE",
                message: "Finish the chapter's lessons first.",
              });
            }
            throw new APIError("BAD_REQUEST", {
              code: "INVALID_ANSWERS",
              message: "Answer every question, then submit.",
            });
          }
          await rankChanged(userId, result.newSteps);
          return ctx.json({
            score: result.score,
            outOf: result.outOf,
            pass: result.pass,
            passed: result.passed,
            results: result.results,
            newSteps: result.newSteps,
          });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
