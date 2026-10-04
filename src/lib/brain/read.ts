import type { Query } from "../backup/dump.ts";

/**
 * Reads the brain export's data (milestone 9) from the three views in the `brain` schema,
 * as `brain_reader`, the role that can read those views and nothing else
 * (drizzle/0008_brain_export.sql). The allowlist of fields lives in the database; this
 * module only proves, before reading, that it really is connected as that role.
 *
 * This module imports nothing from the app, so `npm run brain:export` can load it.
 */

export const BRAIN_ROLE = "brain_reader";

export type BrainMember = {
  memberNumber: number;
  userId: string;
  /** Null until the member has chosen one in onboarding. */
  username: string | null;
  displayName: string | null;
  /** YYYY-MM-DD, UTC. */
  joinedOn: string;
  discordUsername: string | null;
  /** Since 0009_brain_email (owner, 2026-10-01). Shown in the note's body only. */
  email: string;
};

export type BrainCompletion = { userId: string; lessonId: string; completedOn: string };
export type BrainStep = { userId: string; step: string; achievedOn: string };

export type BrainData = {
  members: BrainMember[];
  completions: BrainCompletion[];
  steps: BrainStep[];
};

/** A fixed sentence for the owner: never a value from the database or the URL. */
export class BrainReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrainReadError";
  }
}

/**
 * Refuses unless this connection is `brain_reader` with no special attribute, no other
 * role, no right to read any table of the app (the `public` and `drizzle` schemas, column
 * grants included; the host's own schemas are not ours to judge) and the right to read the
 * brain's views.
 * Fail closed: a connection that could read more than the allowlist is not used at all.
 */
export async function assertBrainRole(query: Query): Promise<void> {
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
  const [views] = await query(
    `SELECT count(*)::int AS readable
       FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'brain' AND c.relname IN ('members', 'lessons_completed', 'rank_steps')
        AND pg_catalog.has_table_privilege(c.oid, 'SELECT')`,
  );
  if (views?.readable !== 3) {
    throw new BrainReadError(
      "The brain's views are missing or unreadable. Apply the migration 0008_brain_export first (npm run db:migrate).",
    );
  }
}

const text = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

/**
 * Everything in ONE statement, so the three lists come from one consistent snapshot of
 * the database in a single round trip. Dates arrive as YYYY-MM-DD text.
 */
export async function readBrain(query: Query): Promise<BrainData> {
  const [row] = await query(BRAIN_QUERY).catch((error: unknown) => {
    // 42703, "undefined column": the views are older than this command.
    if ((error as { code?: string }).code === "42703") {
      throw new BrainReadError(
        "The brain's views are older than this command: a migration is waiting. Run `npm run db:backup`, then `npm run db:migrate`, and try again.",
      );
    }
    throw error;
  });
  // postgres.js and PGlite both hand back json already parsed; a string is parsed here.
  const list = (value: unknown): Record<string, unknown>[] => {
    const parsed = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
    if (!Array.isArray(parsed))
      throw new BrainReadError("The brain's views answered in an unexpected shape.");
    return parsed as Record<string, unknown>[];
  };
  return {
    members: list(row?.members).map((member) => ({
      memberNumber: Number(member.memberNumber),
      userId: String(member.userId),
      username: text(member.username),
      displayName: text(member.displayName),
      joinedOn: String(member.joinedOn),
      discordUsername: text(member.discordUsername),
      email: String(member.email),
    })),
    completions: list(row?.completions).map((completion) => ({
      userId: String(completion.userId),
      lessonId: String(completion.lessonId),
      completedOn: String(completion.completedOn),
    })),
    steps: list(row?.steps).map((step) => ({
      userId: String(step.userId),
      step: String(step.step),
      achievedOn: String(step.achievedOn),
    })),
  };
}

const BRAIN_QUERY = `SELECT
       (SELECT coalesce(json_agg(json_build_object(
                  'memberNumber', m.member_number, 'userId', m.user_id::text,
                  'username', m.username, 'displayName', m.display_name,
                  'joinedOn', m.joined_on::text, 'discordUsername', m.discord_username, 'email', m.email)
                ORDER BY m.member_number), '[]'::json)
          FROM brain.members m) AS members,
       (SELECT coalesce(json_agg(json_build_object(
                  'userId', l.user_id::text, 'lessonId', l.lesson_id,
                  'completedOn', l.completed_on::text)
                ORDER BY l.completed_on, l.lesson_id), '[]'::json)
          FROM brain.lessons_completed l) AS completions,
       (SELECT coalesce(json_agg(json_build_object(
                  'userId', s.user_id::text, 'step', s.step, 'achievedOn', s.achieved_on::text)
                ORDER BY s.achieved_on, s.step), '[]'::json)
          FROM brain.rank_steps s) AS steps`;
