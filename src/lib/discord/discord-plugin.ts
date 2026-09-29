import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  formCsrfMiddleware,
  getSessionFromCtx,
  sessionMiddleware,
} from "better-auth/api";
import * as z from "zod";
import type { AuthDatabase } from "../auth/create-auth.ts";
import type { EventLog } from "../auth/events.ts";
import { randomToken, safeEqual } from "../auth/keyed-hash.ts";
import type { Limiter } from "../auth/limits.ts";
import { authorizeUrl, type DiscordApp, type DiscordFetch, identify } from "./discord-api.ts";
import { getDiscordLink, removeDiscordLink, saveDiscordLink } from "./links.ts";
import { type RoleConfig, syncDiscordRoles } from "./role-sync.ts";

/**
 * Linking a Discord account to a ZeroCorps account (milestone 6), and the Rookie role that
 * comes with it (the start of milestone 8).
 *
 * Discord is NEVER a way to sign in (hard rule 2): every step needs a member who is
 * already signed in, and nothing here creates or changes a session. The OAuth2 flow is
 * the standard one with a `state` value that is bound to the browser AND the member who
 * started it: it lives in a signed, httpOnly cookie for ten minutes and is used once. So
 * a link someone else started, or a code meant for somebody else, is refused.
 *
 *   GET  /api/auth/discord/link      signed in → off to Discord (scope `identify`)
 *   GET  /api/auth/discord/callback  Discord sends the browser back here
 *   POST /api/auth/discord/unlink    behind the origin and session checks
 *
 * Every outcome lands on /settings with a `discord=` word the page turns into a sentence.
 */

export type DiscordConfig = {
  app: Omit<DiscordApp, "redirectUri">;
  /** Present only when the bot token, server id and role ids are all set. */
  roles: RoleConfig | null;
  fetch?: DiscordFetch;
};

export type DiscordPluginOptions = {
  db: AuthDatabase;
  limiter: Limiter;
  events: EventLog;
  baseUrl: string;
  discord: DiscordConfig | null;
  /**
   * The member's rank key, or null before they have one. The role in Discord follows it:
   * Rookie is earned by completing Chapter 1 (DECISIONS.md, 2026-09-29).
   */
  rankOf: (userId: string) => Promise<string | null>;
};

const STATE_COOKIE = "discord_state";
const STATE_SECONDS = 10 * 60;

/**
 * Makes a linked member's Discord roles match their rank now: called when a rank is
 * earned, so the Rookie role arrives the moment Chapter 1 is complete. Does nothing for a
 * member without a link, or while roles are not set up. Never throws.
 */
export function createRankSync(options: {
  db: AuthDatabase;
  discord: DiscordConfig | null;
  rankOf: (userId: string) => Promise<string | null>;
}) {
  const { db, discord, rankOf } = options;
  return async (userId: string): Promise<void> => {
    if (!discord?.roles) return;
    try {
      const link = await getDiscordLink(db, userId);
      if (!link) return;
      const result = await syncDiscordRoles(
        discord.fetch ?? fetch,
        discord.roles,
        link.discordId,
        await rankOf(userId),
      );
      if (result.status !== "synced") console.warn(`[discord] role sync: ${result.status}`);
    } catch (error) {
      console.error(`[discord] role sync failed: ${error instanceof Error ? error.name : "error"}`);
    }
  };
}

export type LinkOutcome =
  | "linked"
  | "linked-no-rank"
  | "linked-join"
  | "unlinked"
  | "taken"
  | "cancelled"
  | "expired"
  | "failed"
  | "unavailable"
  | "too-many";

export function discordPlugin(options: DiscordPluginOptions) {
  const { db, limiter, events, baseUrl, discord, rankOf } = options;
  const fetcher: DiscordFetch = discord?.fetch ?? fetch;
  const app: DiscordApp | null = discord
    ? { ...discord.app, redirectUri: `${baseUrl}/api/auth/discord/callback` }
    : null;
  const settings = (outcome: LinkOutcome) => `${baseUrl}/settings?discord=${outcome}`;

  async function sync(discordId: string, rank: string | null) {
    if (!discord?.roles) return null;
    const result = await syncDiscordRoles(fetcher, discord.roles, discordId, rank);
    if (result.status !== "synced") console.warn(`[discord] role sync: ${result.status}`);
    return result;
  }

  return {
    id: "zerocorps-discord",
    endpoints: {
      discordLink: createAuthEndpoint("/discord/link", { method: "GET" }, async (ctx) => {
        const session = await getSessionFromCtx(ctx);
        if (!session) throw ctx.redirect(`${baseUrl}/sign-in?next=/settings`);
        if (!app) throw ctx.redirect(settings("unavailable"));

        const limit = await limiter.hit("discordLinkPerUser", session.user.id);
        if (!limit.allowed) throw ctx.redirect(settings("too-many"));

        const state = randomToken();
        const cookie = ctx.context.createAuthCookie(STATE_COOKIE, { maxAge: STATE_SECONDS });
        await ctx.setSignedCookie(
          cookie.name,
          `${state}.${session.user.id}`,
          ctx.context.secret,
          cookie.attributes,
        );
        throw ctx.redirect(authorizeUrl(app, state));
      }),

      discordCallback: createAuthEndpoint(
        "/discord/callback",
        {
          method: "GET",
          query: z.object({
            code: z.string().max(512).optional(),
            state: z.string().max(200).optional(),
            error: z.string().max(200).optional(),
          }),
        },
        async (ctx) => {
          // Whatever happens next, this state is used up.
          const cookie = ctx.context.createAuthCookie(STATE_COOKIE);
          const stored = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
          ctx.setCookie(cookie.name, "", { ...cookie.attributes, maxAge: 0 });

          const session = await getSessionFromCtx(ctx);
          if (!session) throw ctx.redirect(`${baseUrl}/sign-in?next=/settings`);
          if (!app) throw ctx.redirect(settings("unavailable"));
          if (ctx.query?.error) throw ctx.redirect(settings("cancelled"));

          const [state = "", owner = ""] = typeof stored === "string" ? stored.split(".") : [];
          const code = ctx.query?.code;
          if (
            !state ||
            !code ||
            owner !== session.user.id ||
            !safeEqual(state, ctx.query?.state ?? "")
          ) {
            throw ctx.redirect(settings("expired"));
          }

          const who = await identify(fetcher, app, code);
          if (!who) throw ctx.redirect(settings("failed"));

          const saved = await saveDiscordLink(db, {
            userId: session.user.id,
            discordId: who.id,
            discordUsername: who.username,
            now: new Date(),
          });
          if (!saved.ok) throw ctx.redirect(settings("taken"));

          const headers = ctx.request?.headers ?? null;
          await events.record({ type: "discord_linked", userId: session.user.id, headers });
          if (saved.replaced) await sync(saved.replaced.discordId, null);
          // The role follows the rank: none before Chapter 1 is complete.
          const rank = await rankOf(session.user.id);
          const roles = await sync(who.id, rank);
          const outcome: LinkOutcome =
            roles?.status === "not-in-server"
              ? "linked-join"
              : rank === null
                ? "linked-no-rank"
                : "linked";
          throw ctx.redirect(settings(outcome));
        },
      ),

      discordUnlink: createAuthEndpoint(
        "/discord/unlink",
        { method: "POST", use: [formCsrfMiddleware, sessionMiddleware] },
        async (ctx) => {
          const userId = ctx.context.session.user.id;
          const limit = await limiter.hit("discordLinkPerUser", userId);
          if (!limit.allowed) {
            throw new APIError("TOO_MANY_REQUESTS", {
              code: "TOO_MANY_REQUESTS",
              message: "Too many attempts. Please wait a while and try again.",
              retryAfterSeconds: limit.retryAfterSeconds,
            });
          }
          const removed = await removeDiscordLink(db, userId);
          if (removed) {
            await events.record({
              type: "discord_unlinked",
              userId,
              headers: ctx.request?.headers ?? null,
            });
            // The brief: unlinking takes every rank role away in Discord.
            await sync(removed.discordId, null);
          }
          return ctx.json({ ok: true });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
