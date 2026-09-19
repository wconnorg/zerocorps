import { z } from "zod";

/**
 * Validated environment variables. Server-only.
 *
 * `next.config.ts` imports this module, so a bad or missing value stops
 * `next dev`, `next build` and `next start` immediately with a readable message
 * instead of surfacing later as a confusing runtime error.
 *
 * Every key in `.env.example` has an entry here (a unit test enforces that).
 * Keys for later milestones are optional until the milestone that first needs
 * them; that milestone flips them to required.
 */

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Blank values (`KEY=` copied from `.env.example`) count as unset. */
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(blankToUndefined, z.string().trim().optional());

function appUrlSchema(isProduction: boolean) {
  return z.preprocess(
    (value) => blankToUndefined(value) ?? (isProduction ? undefined : "http://localhost:3000"),
    z
      .string({
        error:
          "Required in production. Set it to the site's public origin, for example https://zerocorps.org",
      })
      .trim()
      .transform((value, ctx) => {
        let url: URL;
        try {
          url = new URL(value);
        } catch {
          ctx.addIssue({
            code: "custom",
            message: "Must be a full URL such as https://zerocorps.org",
          });
          return z.NEVER;
        }
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          ctx.addIssue({ code: "custom", message: "Must start with http:// or https://" });
          return z.NEVER;
        }
        if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
          ctx.addIssue({
            code: "custom",
            message: "Must be an origin only, with no path, query or trailing slash",
          });
          return z.NEVER;
        }
        if (isProduction && url.protocol !== "https:" && !LOCAL_HOSTNAMES.has(url.hostname)) {
          ctx.addIssue({ code: "custom", message: "Must use https:// in production" });
          return z.NEVER;
        }
        return url.origin;
      }),
  );
}

export function createEnvSchema(isProduction: boolean) {
  return z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // Milestone 1: app
    NEXT_PUBLIC_APP_URL: appUrlSchema(isProduction),

    // Milestone 2: database, auth, email
    DATABASE_URL: optionalString,
    DATABASE_URL_MIGRATIONS: optionalString,
    BETTER_AUTH_SECRET: optionalString,
    RESEND_API_KEY: optionalString,
    EMAIL_FROM: optionalString,

    // Milestone 3: avatar storage
    STORAGE_ENDPOINT: optionalString,
    STORAGE_REGION: optionalString,
    STORAGE_BUCKET: optionalString,
    STORAGE_ACCESS_KEY_ID: optionalString,
    STORAGE_SECRET_ACCESS_KEY: optionalString,
    STORAGE_PUBLIC_BASE_URL: optionalString,

    // Milestone 5: SMS verification
    SMS_PROVIDER: z.preprocess(
      blankToUndefined,
      z.enum(["console", "twilio-verify"]).default("console"),
    ),
    TWILIO_ACCOUNT_SID: optionalString,
    TWILIO_AUTH_TOKEN: optionalString,
    TWILIO_VERIFY_SERVICE_SID: optionalString,

    // Milestone 6: Discord account linking
    DISCORD_CLIENT_ID: optionalString,
    DISCORD_CLIENT_SECRET: optionalString,

    // Milestone 8: rank role sync and the internal API
    DISCORD_BOT_TOKEN: optionalString,
    DISCORD_GUILD_ID: optionalString,
    DISCORD_RANK_ROLE_IDS: optionalString,
    INTERNAL_API_SECRET: optionalString,
    CRON_SECRET: optionalString,
  });
}

export type Env = z.infer<ReturnType<typeof createEnvSchema>>;

/**
 * Parses and validates an environment. Throws one error listing every problem,
 * naming keys only. Values are never included, so secrets cannot leak into logs.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const isProduction = source.NODE_ENV === "production";
  const result = createEnvSchema(isProduction).safeParse(source);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => {
    const key = issue.path.join(".") || "(root)";
    return `  - ${key}: ${issue.message}`;
  });
  throw new Error(
    [
      "Invalid environment variables:",
      ...problems,
      "Compare your .env.local (or host settings) with .env.example.",
    ].join("\n"),
  );
}

if (typeof window !== "undefined") {
  throw new Error("src/env.ts is server-only and must not be imported from client code.");
}

export const env: Env = parseEnv(process.env);
