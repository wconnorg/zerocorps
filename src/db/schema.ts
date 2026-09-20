import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgPolicy,
  pgRole,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * The database schema. Postgres is the single source of truth (hard rule 4).
 *
 * READ THIS BEFORE CHANGING ANYTHING. There is one database, shared by the laptop
 * and the live site, and migrations are additive only: a column that is created can
 * never be dropped. So a change here is proven in the PGlite tests first, and only
 * then turned into a migration with `npm run db:generate`.
 *
 * Every table has row-level security switched on and one policy that opens it to
 * `zerocorps_app`, the role the app connects as. That role has no right to create,
 * alter or drop anything. A table without the policy is invisible to the app, which
 * is the safe way round; a test fails if a table is missing it.
 *
 * The property names (camelCase) are what Better Auth's Drizzle adapter looks up.
 * The column names (snake_case) are what is stored.
 */

/** Created by the first migration without a password. The owner sets one by hand. */
export const appRole = pgRole("zerocorps_app").existing();

/** The one policy every table carries: the app role may do everything a table owner's grants allow. */
const appAccess = () =>
  pgPolicy("zerocorps_app_all", {
    as: "permissive",
    for: "all",
    to: appRole,
    using: sql`true`,
    withCheck: sql`true`,
  });

const id = () =>
  uuid("id")
    .primaryKey()
    .default(sql`pg_catalog.gen_random_uuid()`);
const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => instant("created_at").notNull().defaultNow();
const updatedAt = () => instant("updated_at").notNull().defaultNow();

// ── Better Auth's core tables ────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: id(),
    /** Always stored trimmed and lower-cased; see `normalizeEmail`. */
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    /** Better Auth's `name`. Empty until onboarding asks for it. */
    displayName: text("display_name").notNull().default(""),
    /** Better Auth's `image`. Holds the storage object key, never a full URL. */
    avatarUrl: text("avatar_url"),
    termsAcceptedAt: instant("terms_accepted_at"),
    termsVersion: text("terms_version"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    check("users_email_normalised", sql`${table.email} = lower(btrim(${table.email}))`),
    appAccess(),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: instant("expires_at").notNull(),
    /** Never the raw address: a coarse prefix only. A hook rewrites it before it is stored. */
    ipAddress: text("ip_address"),
    /** Length-capped by the same hook. */
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("sessions_token_unique").on(table.token),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
    appAccess(),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Always "credential": accounts are created only with email and password (hard rule 1). */
    providerId: text("provider_id").notNull(),
    accountId: text("account_id").notNull(),
    /** The scrypt password hash. */
    password: text("password"),
    // Better Auth's core model includes these for social sign-in, which this project
    // never uses (hard rules 1 and 2). They exist so the schema matches the library
    // exactly, and they stay NULL: no token is ever stored (hard rule 5).
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: instant("access_token_expires_at"),
    refreshTokenExpiresAt: instant("refresh_token_expires_at"),
    scope: text("scope"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
    uniqueIndex("accounts_provider_account_unique").on(table.providerId, table.accountId),
    appAccess(),
  ],
);

/** Short-lived tokens Better Auth issues, such as a password-reset token. */
export const verifications = pgTable(
  "verifications",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: instant("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("verifications_identifier_idx").on(table.identifier),
    index("verifications_expires_at_idx").on(table.expiresAt),
    appAccess(),
  ],
);

/** Better Auth's own per-IP, per-path limiter. Memory storage is useless on serverless hosting. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    id: id(),
    key: text("key").notNull(),
    count: integer("count").notNull(),
    lastRequest: bigint("last_request", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("rate_limits_key_unique").on(table.key),
    index("rate_limits_last_request_idx").on(table.lastRequest),
    appAccess(),
  ],
);

/**
 * The schema object handed to Better Auth's Drizzle adapter, keyed by Better Auth's
 * own model names. Explicit on purpose: no pluralising magic to get wrong.
 */
export const authSchema = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
  rateLimit: rateLimits,
};
