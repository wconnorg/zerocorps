import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  index,
  integer,
  pgPolicy,
  pgRole,
  pgTable,
  primaryKey,
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
    /**
     * The name other members see, unique without regard to case. NULL until onboarding
     * asks for it, which is what sends a member there. Always stored lower-cased and
     * trimmed; the rules and the reserved words are in `src/lib/username.ts`, and a test
     * proves the pattern below is the same one.
     */
    username: text("username"),
    /**
     * The name this member had before their last change, HELD so nobody else can take it
     * and pass themselves off as them. It is free again once the hold has run out; the
     * daily cleanup clears it then. NULL for a member who has never changed their name.
     */
    previousUsername: text("previous_username"),
    /** When the name last changed. Together with the column above it says what is held. */
    usernameChangedAt: instant("username_changed_at"),
    /** Better Auth's `name`. Empty until onboarding asks for it. */
    displayName: text("display_name").notNull().default(""),
    /** Better Auth's `image`. Holds the storage object key, never a full URL. */
    avatarUrl: text("avatar_url"),
    termsAcceptedAt: instant("terms_accepted_at"),
    termsVersion: text("terms_version"),
    /**
     * Better Auth's two-factor flag (milestone 5): true once an authenticator app is set up
     * AND confirmed with a first code. Sign-in then asks for a code after the password.
     */
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    check("users_email_normalised", sql`${table.email} = lower(btrim(${table.email}))`),
    // Postgres lets a unique index hold many NULLs, so every member without a name yet
    // sits here happily, and the first one to claim a name wins it. THIS is the guard
    // against two people taking one name: not the check in the browser, and not the one
    // on the server, both of which can be raced.
    uniqueIndex("users_username_unique").on(table.username),
    check(
      "users_username_shape",
      sql`${table.username} IS NULL OR ${table.username} ~ '^[a-z0-9_]{3,20}$'`,
    ),
    check(
      "users_previous_username_shape",
      sql`${table.previousUsername} IS NULL OR ${table.previousUsername} ~ '^[a-z0-9_]{3,20}$'`,
    ),
    // A held name means nothing without the moment it started being held.
    check(
      "users_previous_username_dated",
      sql`${table.previousUsername} IS NULL OR ${table.usernameChangedAt} IS NOT NULL`,
    ),
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

// ── The Academy (milestone 7) ─────────────────────────────────────────────────
//
// The lessons themselves live in `content/academy/`, not here. These tables hold only
// what a member has DONE, keyed by the ids in the lesson files, which never change. All
// three go when the account goes (ON DELETE CASCADE), and none holds anything but ids,
// dates and scores.

/** The same shape `src/lib/academy/content.ts` enforces on every id. */
const idShape = (column: unknown) =>
  sql`${column} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(${column}) <= 80`;

/** A lesson a member marked complete. Once, at the first moment they did. */
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id").notNull(),
    completedAt: instant("completed_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "lesson_progress_pkey", columns: [table.userId, table.lessonId] }),
    check("lesson_progress_lesson_id_shape", idShape(table.lessonId)),
    appAccess(),
  ],
);

/**
 * A chapter checkpoint a member passed: the first pass is kept. Failed attempts are not
 * stored at all; the limiter counts them without knowing what they were.
 */
export const checkpointPasses = pgTable(
  "checkpoint_passes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").notNull(),
    score: integer("score").notNull(),
    outOf: integer("out_of").notNull(),
    passedAt: instant("passed_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "checkpoint_passes_pkey", columns: [table.userId, table.chapterId] }),
    check("checkpoint_passes_chapter_id_shape", idShape(table.chapterId)),
    check(
      "checkpoint_passes_score_range",
      sql`${table.outOf} BETWEEN 1 AND 50 AND ${table.score} BETWEEN 0 AND ${table.outOf}`,
    ),
    appAccess(),
  ],
);

/**
 * Every step a member has earned, once, with when (the brief's `rank_history`). A step
 * is never taken away, which is why it is stored rather than worked out each time: a
 * lesson added to a finished level later must not undo anyone's step. Today the steps
 * are `rookie-level-1` to `rookie-level-3` (`src/lib/academy/standing.ts`).
 */
export const rankHistory = pgTable(
  "rank_history",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rank: text("rank").notNull(),
    achievedAt: instant("achieved_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("rank_history_user_rank_unique").on(table.userId, table.rank),
    check("rank_history_rank_shape", idShape(table.rank)),
    appAccess(),
  ],
);

// ── Discord (milestone 6) ─────────────────────────────────────────────────────

/**
 * A member's linked Discord account: the Discord id, the Discord username and when it was
 * linked, and nothing else (hard rule 5). No token is ever stored anywhere. One row per
 * member, and the unique index makes one Discord account link to one member only.
 *
 * Its own table rather than columns on `users` (a deliberate change from the brief, like
 * `rank_history`): Better Auth reads every column of `users` on every request, so the
 * auth tables stay untouched, and unlinking is deleting one row.
 */
export const discordLinks = pgTable(
  "discord_links",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    discordId: text("discord_id").notNull(),
    discordUsername: text("discord_username").notNull(),
    linkedAt: instant("linked_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("discord_links_discord_id_unique").on(table.discordId),
    check("discord_links_discord_id_shape", sql`${table.discordId} ~ '^[0-9]{17,20}$'`),
    check("discord_links_username_length", sql`length(${table.discordUsername}) BETWEEN 1 AND 64`),
    appAccess(),
  ],
);

// ── Profile pictures (milestone 3) ────────────────────────────────────────────

/**
 * Raw bytes. postgres.js returns a Buffer and PGlite a Uint8Array; both come out a Buffer.
 */
const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => Buffer.from(value),
});

/**
 * A member's profile picture, in the database like everything else (owner, 2026-09-21:
 * "everything lives in database"). Only what the server made is ever stored: the upload
 * is decoded, resized to 256 by 256 and re-encoded as WebP, which also drops everything
 * but the pixels (a phone's GPS position, the camera, the original file). One per member,
 * gone with the account, and never more than the size check below.
 */
export const avatars = pgTable(
  "avatars",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    image: bytea("image").notNull(),
    contentType: text("content_type").notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("avatars_content_type", sql`${table.contentType} = 'image/webp'`),
    check("avatars_size", sql`octet_length(${table.image}) BETWEEN 1 AND 131072`),
    appAccess(),
  ],
);

/**
 * Two-factor (milestone 5), Better Auth's `twoFactor` model: one row per member who has
 * started setting up an authenticator app. The app's secret and the backup codes are
 * encrypted by Better Auth with BETTER_AUTH_SECRET; neither is ever stored readable.
 * `verified` stays false until the member types a first code from the app, and the two
 * counters are Better Auth's lock after 10 wrong codes in a row. Gone with the account.
 */
export const twoFactors = pgTable(
  "two_factors",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: boolean("verified").notNull().default(true),
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    lockedUntil: instant("locked_until"),
    createdAt: createdAt(),
  },
  (table) => [
    // One per member: two set-ups at once cannot leave two secrets behind.
    uniqueIndex("two_factors_user_id_unique").on(table.userId),
    check("two_factors_failed_count", sql`${table.failedVerificationCount} >= 0`),
    appAccess(),
  ],
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
  twoFactor: twoFactors,
};
