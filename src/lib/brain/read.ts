import type { Query } from "../backup/dump.ts";

/**
 * Reads the brain export's data (milestone 9) from the views in the `brain` schema, as
 * `brain_reader`, the role that can read those views and nothing else
 * (drizzle/0008_brain_export.sql, 0009 and 0010). The allowlist of fields lives in the
 * database; this module only proves, before reading, that it really is connected as that
 * role, and reads no more than the brain it is asked for needs.
 *
 * This module imports nothing from the app, so `npm run brain:export` can load it.
 */

export const BRAIN_ROLE = "brain_reader";

/**
 * The views the export cannot work without. Fewer readable means a migration has not been
 * applied yet. The pictures (0010) are optional: until they exist the brain is built
 * without them, so it stays up to date in the meantime.
 */
const REQUIRED_VIEWS = ["members", "lessons_completed", "rank_steps"];

/**
 * A picture's version, as the site writes it beside the account: the first 22 characters
 * of the picture's SHA-256 in base64url. It names the picture's file in the vault, so a
 * value that is anything else is never used.
 */
export const PICTURE_VERSION = /^[A-Za-z0-9_-]{22}$/;

export type BrainMember = {
  memberNumber: number;
  userId: string;
  /** Null until the member has chosen one in onboarding. */
  username: string | null;
  displayName: string | null;
  /** The day the account was made: YYYY-MM-DD, UTC. */
  joinedOn: string;
  discordUsername: string | null;
  /** Since 0009_brain_email (owner, 2026-10-01). Shown in the note's body only. */
  email: string;
  /** Since 0010_brain_pictures (owner, 2026-10-04). Null without a profile picture. */
  pictureVersion: string | null;
};

export type BrainCompletion = { userId: string; lessonId: string; completedOn: string };
export type BrainStep = { userId: string; step: string; achievedOn: string };

export type BrainData = {
  members: BrainMember[];
  /** Read for the Academy's brain only (`--academy`); empty otherwise. */
  completions: BrainCompletion[];
  /** Read for the Academy's brain only (`--academy`); empty otherwise. */
  steps: BrainStep[];
};

/** A fixed sentence for the owner: never a value from the database or the URL. */
export class BrainReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrainReadError";
  }
}

/** Says what is missing, and when to apply it: never earlier than the release that needs it. */
const MIGRATION_WAITING =
  "The brain's views are older than this command: a database migration is waiting. Apply it once the release that needs it is live (`npm run db:backup`, then `npm run db:migrate`); until then the brain is left as it is.";

/**
 * Refuses unless this connection is `brain_reader` with no special attribute, no other
 * role, no right to read any table of the app (the `public` and `drizzle` schemas, column
 * grants included; the host's own schemas are not ours to judge) and the right to read the
 * brain's views. Answers whether the database can give the members' pictures yet.
 * Fail closed: a connection that could read more than the allowlist is not used at all.
 */
export async function assertBrainRole(query: Query): Promise<{ pictures: boolean }> {
  const [who] = await query(
    `SELECT current_user::text AS name,
            r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication
              AS special,
            EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member = r.oid) AS member_of
       FROM pg_catalog.pg_roles r
      WHERE r.rolname = current_user`,
  );
  if (who?.name !== BRAIN_ROLE) {
    throw new BrainReadError(
      `BRAIN_DATABASE_URL does not connect as ${BRAIN_ROLE}. Run: npm run brain:setup`,
    );
  }
  if (who.special !== false || who.member_of !== false) {
    throw new BrainReadError(
      `${BRAIN_ROLE} holds a special attribute or belongs to another role, so it could read more than the brain's allowlist. Nothing was read.`,
    );
  }
  const readable = await query(
    `SELECT n.nspname || '.' || c.relname AS name
       FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public', 'drizzle')
        AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
        AND (pg_catalog.has_table_privilege(c.oid, 'SELECT')
          OR pg_catalog.has_any_column_privilege(c.oid, 'SELECT'))`,
  );
  if (readable.length > 0) {
    throw new BrainReadError(
      `${BRAIN_ROLE} can read ${readable.length} table(s) outside the brain's views (${readable.map((row) => String(row.name)).join(", ")}), so it could read more than the brain's allowlist. Nothing was read.`,
    );
  }
  // The list goes as an array literal in a text[] parameter: both drivers send it as is.
  const [views] = await query(
    `SELECT (SELECT count(*)::int
               FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'brain' AND c.relname = ANY ($1::text[])
                AND pg_catalog.has_table_privilege(c.oid, 'SELECT')) AS readable,
            EXISTS (SELECT 1
               FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'brain' AND c.relname = 'member_pictures'
                AND pg_catalog.has_table_privilege(c.oid, 'SELECT'))
            AND EXISTS (SELECT 1
               FROM pg_catalog.pg_attribute a
               JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
               JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'brain' AND c.relname = 'members'
                AND a.attname = 'picture_version' AND NOT a.attisdropped) AS pictures`,
    [`{${REQUIRED_VIEWS.join(",")}}`],
  );
  if (views?.readable !== REQUIRED_VIEWS.length) throw new BrainReadError(MIGRATION_WAITING);
  return { pictures: views.pictures === true };
}

const text = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

/**
 * Everything the brain needs in ONE statement, so the lists come from one consistent
 * snapshot of the database in a single round trip. Dates arrive as YYYY-MM-DD text. The
 * lessons and rank steps are read only for the Academy's brain, and the pictures' versions
 * only once the database has them (`assertBrainRole` says).
 */
export async function readBrain(
  query: Query,
  options: { academy?: boolean; pictures?: boolean } = {},
): Promise<BrainData> {
  const academy = options.academy ?? false;
  const members = membersQuery(options.pictures ?? true);
  const [row] = await query(academy ? `${members},${ACADEMY_LISTS}` : members).catch(
    (error: unknown) => {
      // 42703, "undefined column": the views are older than this command.
      if ((error as { code?: string }).code === "42703")
        throw new BrainReadError(MIGRATION_WAITING);
      throw error;
    },
  );
  // postgres.js and PGlite both hand back json already parsed; a string is parsed here.
  const list = (value: unknown): Record<string, unknown>[] => {
    const parsed = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
    if (!Array.isArray(parsed))
      throw new BrainReadError("The brain's views answered in an unexpected shape.");
    return parsed as Record<string, unknown>[];
  };
  return {
    members: list(row?.members).map((member) => {
      const version = text(member.pictureVersion);
      return {
        memberNumber: Number(member.memberNumber),
        userId: String(member.userId),
        username: text(member.username),
        displayName: text(member.displayName),
        joinedOn: String(member.joinedOn),
        discordUsername: text(member.discordUsername),
        email: String(member.email),
        // Only a value in the site's own format ever names a file.
        pictureVersion: version !== null && PICTURE_VERSION.test(version) ? version : null,
      };
    }),
    completions: academy
      ? list(row?.completions).map((completion) => ({
          userId: String(completion.userId),
          lessonId: String(completion.lessonId),
          completedOn: String(completion.completedOn),
        }))
      : [],
    steps: academy
      ? list(row?.steps).map((step) => ({
          userId: String(step.userId),
          step: String(step.step),
          achievedOn: String(step.achievedOn),
        }))
      : [],
  };
}

/**
 * The pictures of the members asked for, by user id: only the ones the vault does not
 * have yet, so an unchanged picture is never read twice. A member whose picture went
 * meanwhile is simply missing from the answer.
 */
export async function readPictures(
  query: Query,
  userIds: readonly string[],
): Promise<Map<string, Buffer>> {
  const pictures = new Map<string, Buffer>();
  if (userIds.length === 0) return pictures;
  // `$1::text`, then jsonb: postgres.js serializes a parameter the server reports as json or
  // jsonb with JSON.stringify, which would turn this JSON text into one JSON string, and
  // every read would fail on the real database (PGlite, in the tests, does not). Bound as
  // text, both drivers send it as it is.
  const rows = await query(
    `SELECT p.user_id::text AS user_id, p.image
       FROM brain.member_pictures p
      WHERE p.user_id IN (SELECT (jsonb_array_elements_text($1::text::jsonb))::uuid)`,
    [JSON.stringify(userIds)],
  );
  for (const row of rows) {
    if (!(row.image instanceof Uint8Array)) {
      throw new BrainReadError("The brain's views answered in an unexpected shape.");
    }
    pictures.set(String(row.user_id), Buffer.from(row.image));
  }
  return pictures;
}

/** Before 0010 the members' view has no `picture_version`, and it is not asked for. */
const membersQuery = (pictures: boolean) => `SELECT
       (SELECT coalesce(json_agg(json_build_object(
                  'memberNumber', m.member_number, 'userId', m.user_id::text,
                  'username', m.username, 'displayName', m.display_name,
                  'joinedOn', m.joined_on::text, 'discordUsername', m.discord_username,
                  'email', m.email, 'pictureVersion', ${pictures ? "m.picture_version" : "NULL::text"})
                ORDER BY m.member_number), '[]'::json)
          FROM brain.members m) AS members`;

const ACADEMY_LISTS = `
       (SELECT coalesce(json_agg(json_build_object(
                  'userId', l.user_id::text, 'lessonId', l.lesson_id,
                  'completedOn', l.completed_on::text)
                ORDER BY l.completed_on, l.lesson_id), '[]'::json)
          FROM brain.lessons_completed l) AS completions,
       (SELECT coalesce(json_agg(json_build_object(
                  'userId', s.user_id::text, 'step', s.step, 'achievedOn', s.achieved_on::text)
                ORDER BY s.achieved_on, s.step), '[]'::json)
          FROM brain.rank_steps s) AS steps`;
