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

// ── The email-code sign-up and what surrounds it (our own tables) ────────────

/**
 * A sign-up that is waiting for its emailed code. NOTHING is written to `users` until
 * the code is correct. The row's id travels in a signed, httpOnly cookie, so a code is
 * only ever accepted from the browser that started the sign-up, never by email alone.
 *
 * Rows for one address are independent: starting another never cancels an earlier one.
 *
 * `passwordHash` is NULL for an address that already has an account. Such a row can
 * never create anything. It exists so the code screen behaves identically (attempts,
 * resend cooldown, expiry) whether or not the address is registered; the address gets
 * a "you already have an account" email instead of a code.
 */
export const pendingSignups = pgTable(
  "pending_signups",
  {
    id: id(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    /** HMAC of "<row id>:<code>" with HMAC_SECRET. The code itself is never stored. */
    codeHash: text("code_hash").notNull(),
    /** Short and not secret. Shown on the code screen and in the email, so two emails can be told apart. */
    reference: text("reference").notNull(),
    attempts: integer("attempts").notNull().default(0),
    sendCount: integer("send_count").notNull().default(1),
    lastSentAt: instant("last_sent_at").notNull().defaultNow(),
    expiresAt: instant("expires_at").notNull(),
    termsVersion: text("terms_version").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("pending_signups_email_idx").on(table.email),
    index("pending_signups_expires_at_idx").on(table.expiresAt),
    appAccess(),
  ],
);

/**
 * Browsers a user has signed in from, so a sign-in from a new one sends an alert. The
 * cookie holds a random token; only its SHA-256 is stored. "Known" is not "trusted":
 * this never skips a check.
 */
export const knownDevices = pgTable(
  "known_devices",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceHash: text("device_hash").notNull(),
    /** The browser family, for example "Chrome on Windows". Never the raw header. */
    userAgent: text("user_agent"),
    firstSeenAt: instant("first_seen_at").notNull().defaultNow(),
    lastSeenAt: instant("last_seen_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("known_devices_user_device_unique").on(table.userId, table.deviceHash),
    appAccess(),
  ],
);

/**
 * The security event log. 90-day retention. It never holds an email address or a raw
 * IP: the identifier and the IP are keyed hashes, next to a coarse IP prefix.
 *
 * `appEnv` says which side wrote the row. The laptop and the live site share this
 * table but hash with different keys, so this is how test noise is told from real
 * activity.
 */
export const authEvents = pgTable(
  "auth_events",
  {
    id: id(),
    type: text("type").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    identifierHash: text("identifier_hash"),
    ipHash: text("ip_hash"),
    ipPrefix: text("ip_prefix"),
    userAgent: text("user_agent"),
    /** A short machine-readable reason, such as "wrong_code". Never free text. */
    detail: text("detail"),
    appEnv: text("app_env").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("auth_events_created_at_idx").on(table.createdAt),
    index("auth_events_type_created_at_idx").on(table.type, table.createdAt),
    index("auth_events_user_id_idx").on(table.userId),
    index("auth_events_identifier_hash_idx").on(table.identifierHash),
    appAccess(),
  ],
);

/**
 * Our own limits: per email address, per address + IP, per day. The key is a keyed
 * hash of the rule and the identifier, so no address sits here in the clear.
 */
export const abuseCounters = pgTable(
  "abuse_counters",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    windowStartedAt: instant("window_started_at").notNull(),
    expiresAt: instant("expires_at").notNull(),
  },
  (table) => [index("abuse_counters_expires_at_idx").on(table.expiresAt), appAccess()],
);

/**
 * The schema object handed to Better Auth's Drizzle adapter, keyed by Better Auth's
 * own model names. Explicit on purpose: no pluralising magic to get wrong.
 *
 * `pendingSignup` and `knownDevice` are here because the sign-up's success path
 * touches them INSIDE Better Auth's transaction, and only calls made through its
 * adapter join that transaction (DECISIONS.md, finding 19).
 */
export const authSchema = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
  rateLimit: rateLimits,
  pendingSignup: pendingSignups,
  knownDevice: knownDevices,
};
