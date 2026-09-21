import { z } from "zod";
import { parseEmailList } from "./lib/email-address.ts";

/**
 * The environment schema and its parser. Pure: importing this file reads nothing
 * and validates nothing, so tests can use it freely. `src/env.ts` is the module
 * that actually parses `process.env`.
 *
 * Every key in `.env.example` has an entry here (a unit test enforces that).
 * Keys for later milestones are optional until the milestone that first needs
 * them; that milestone flips them to required.
 *
 * Error messages name keys only. Values are never included, so a secret cannot
 * leak into a build log.
 */

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
const SECRET_KEYS = ["BETTER_AUTH_SECRET", "HMAC_SECRET", "CRON_SECRET"] as const;
const MIN_SECRET_LENGTH = 32;

/** Blank values (`KEY=` copied from `.env.example`) count as unset. */
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(blankToUndefined, z.string().trim().optional());

function isLocalOrigin(origin: string): boolean {
  return LOCAL_HOSTNAMES.has(new URL(origin).hostname);
}

function appUrlSchema(isProductionBuild: boolean) {
  return z.preprocess(
    (value) => blankToUndefined(value) ?? (isProductionBuild ? undefined : "http://localhost:3000"),
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
        if (isProductionBuild && url.protocol !== "https:" && !LOCAL_HOSTNAMES.has(url.hostname)) {
          ctx.addIssue({ code: "custom", message: "Must use https:// in production" });
          return z.NEVER;
        }
        return url.origin;
      }),
  );
}

/** `local` is the owner's laptop, `production` is the live site. There is no third. */
function appEnvSchema(isProductionBuild: boolean) {
  return z.preprocess(
    (value) => blankToUndefined(value) ?? (isProductionBuild ? undefined : "local"),
    z.enum(["local", "production"], {
      error:
        "Required for a production build. Set it to local (the laptop) or production (the live site)",
    }),
  );
}

function isPostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "postgres:" || url.protocol === "postgresql:") && url.hostname !== "";
  } catch {
    return false;
  }
}

const POSTGRES_URL_HELP =
  "Must be a postgres:// URL that parses. Run `npm run env:check` to see what is wrong with it";

const requiredPostgresUrl = z.preprocess(
  blankToUndefined,
  z.string({ error: "Required" }).trim().refine(isPostgresUrl, POSTGRES_URL_HELP),
);

const optionalPostgresUrl = z.preprocess(
  blankToUndefined,
  z.string().trim().refine(isPostgresUrl, POSTGRES_URL_HELP).optional(),
);

const requiredSecret = z.preprocess(
  blankToUndefined,
  z
    .string({ error: "Required. `npm run env:secrets` fills in the blank ones" })
    .trim()
    .min(
      MIN_SECRET_LENGTH,
      `Must be at least ${MIN_SECRET_LENGTH} characters. \`npm run env:secrets\` generates one`,
    ),
);

/** A comma-separated list of email addresses, normalised (trim + lowercase). */
const emailList = z.preprocess(blankToUndefined, z.string().optional()).transform((value, ctx) => {
  const list = parseEmailList(value);
  if (list === null) {
    ctx.addIssue({
      code: "custom",
      message: "Must be a comma-separated list of email addresses",
    });
    return z.NEVER;
  }
  return list;
});

/** Where people can reach us: a web address or a mailto: link. Public by design. */
const optionalContactUri = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .refine(
      (value) => /^https:\/\/\S+$/.test(value) || /^mailto:[^\s@]+@[^\s@]+$/.test(value),
      "Must start with https:// or mailto:",
    )
    .optional(),
);

export function createEnvShape(isProductionBuild: boolean) {
  return {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // Milestone 1: app
    NEXT_PUBLIC_APP_URL: appUrlSchema(isProductionBuild),

    // Milestone 2: environment and sign-up mode
    APP_ENV: appEnvSchema(isProductionBuild),
    SIGNUP_MODE: z.preprocess(
      blankToUndefined,
      z.enum(["closed", "allowlist", "open"]).default("closed"),
    ),
    SIGNUP_ALLOWLIST: emailList,

    // Milestone 2: database
    DATABASE_URL: requiredPostgresUrl,
    DATABASE_URL_MIGRATIONS: optionalPostgresUrl,
    BACKUP_DIR: optionalString,

    // Milestone 2: secrets
    BETTER_AUTH_SECRET: requiredSecret,
    HMAC_SECRET: requiredSecret,
    CRON_SECRET: requiredSecret,

    // Milestone 2: email
    RESEND_API_KEY: optionalString,
    EMAIL_FROM: z.preprocess(
      blankToUndefined,
      z.string().trim().default("ZeroCorps <no-reply@zerocorps.org>"),
    ),
    EMAIL_ALLOWLIST: emailList,

    // Milestone 2: abuse limits, contacts, links
    TRUSTED_IP_HEADER: z.preprocess(
      blankToUndefined,
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9-]+$/, "Must be a header name such as x-forwarded-for")
        .default("x-forwarded-for"),
    ),
    SECURITY_CONTACT: optionalContactUri,
    PRIVACY_CONTACT: optionalContactUri,
    DISCORD_INVITE_URL: z.preprocess(
      blankToUndefined,
      z
        .string()
        .trim()
        .refine((value) => /^https:\/\/\S+$/.test(value), "Must start with https://")
        .optional(),
    ),

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
  };
}

export function createEnvSchema(isProductionBuild: boolean) {
  return z.object(createEnvShape(isProductionBuild)).superRefine((env, ctx) => {
    const issue = (key: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [key], message });

    // One leaked secret must not open a second door.
    SECRET_KEYS.forEach((key, index) => {
      const earlier = SECRET_KEYS.slice(0, index).find((other) => env[other] === env[key]);
      if (earlier) issue(key, `Must be different from ${earlier}`);
    });

    if (env.SIGNUP_MODE === "allowlist" && env.SIGNUP_ALLOWLIST.length === 0) {
      issue("SIGNUP_ALLOWLIST", "Required when SIGNUP_MODE is allowlist");
    }

    const isLocalUrl = isLocalOrigin(env.NEXT_PUBLIC_APP_URL);
    if (env.APP_ENV === "local" && !isLocalUrl) {
      issue("APP_ENV", "Is local, but NEXT_PUBLIC_APP_URL is not a localhost address");
    }
    if (env.APP_ENV === "production") {
      if (isLocalUrl || !env.NEXT_PUBLIC_APP_URL.startsWith("https://")) {
        issue(
          "NEXT_PUBLIC_APP_URL",
          "Must be the public https:// address when APP_ENV is production",
        );
      }
      if (env.EMAIL_ALLOWLIST.length > 0) {
        issue("EMAIL_ALLOWLIST", "Must be empty in production: it limits who receives email");
      }
      if (!env.RESEND_API_KEY) issue("RESEND_API_KEY", "Required in production");
      if (!env.SECURITY_CONTACT) issue("SECURITY_CONTACT", "Required in production");
      if (!env.PRIVACY_CONTACT) issue("PRIVACY_CONTACT", "Required in production");
    }
  });
}

export type Env = z.infer<ReturnType<typeof createEnvSchema>>;

/**
 * Parses and validates an environment. Throws one error listing every problem,
 * naming keys only. Values are never included, so secrets cannot leak into logs.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const isProductionBuild = source.NODE_ENV === "production";
  const result = createEnvSchema(isProductionBuild).safeParse(source);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => {
    const key = issue.path.join(".") || "(root)";
    return `  - ${key}: ${issue.message}`;
  });
  throw new Error(
    [
      "Invalid environment variables:",
      ...problems,
      "Compare your .env.local (or host settings) with .env.example, or run `npm run env:check`.",
    ].join("\n"),
  );
}
