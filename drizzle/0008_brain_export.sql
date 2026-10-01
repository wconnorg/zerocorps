-- Milestone 9: the brain export for the owner's Obsidian vault (docs/BRIEF.md, "Brain
-- export"). Hand-written: drizzle-kit does not manage roles, views in their own schema, or
-- grants here.
--
-- The field allowlist is enforced HERE, in the database, not only in code: three views in
-- their own schema, and a role that may read those views and nothing else. They hold the
-- member number, the user id, the username, the display name, the day the account was
-- made, the Discord username if linked, the lessons completed and the rank steps, each by
-- day. Never an email, a phone, an IP, a device, a password, a code, a session or anything
-- else about signing in.
--
-- The views read the tables as their owner (the role running migrations), which owns the
-- tables and so is not held back by their row-level security; brain_reader needs, and
-- has, no right on any table.
--
-- brain_reader is created WITHOUT a password and WITHOUT the right to log in, so no secret
-- is ever committed. The owner switches it on with `npm run brain:setup`, which sets a
-- random password that is never shown (docs/SECURITY.md, "Set up the brain").

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'brain_reader') THEN
    CREATE ROLE brain_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint
-- Belt and braces: even a right granted by mistake cannot write, and nothing runs long.
ALTER ROLE brain_reader SET default_transaction_read_only = on;
--> statement-breakpoint
ALTER ROLE brain_reader SET statement_timeout = '30s';
--> statement-breakpoint
CREATE SCHEMA brain;
--> statement-breakpoint
REVOKE ALL ON SCHEMA brain FROM PUBLIC;
--> statement-breakpoint
-- One row per account. The member number is the account's place in the order accounts
-- were made (ties, which cannot really happen, broken by id); an account deleted later
-- moves the ones after it up by one.
CREATE VIEW brain.members AS
SELECT
  (row_number() OVER (ORDER BY u.created_at, u.id))::integer AS member_number,
  u.id AS user_id,
  u.username,
  NULLIF(u.display_name, '') AS display_name,
  (u.created_at AT TIME ZONE 'UTC')::date AS joined_on,
  d.discord_username
FROM public.users u
LEFT JOIN public.discord_links d ON d.user_id = u.id;
--> statement-breakpoint
CREATE VIEW brain.lessons_completed AS
SELECT p.user_id, p.lesson_id, (p.completed_at AT TIME ZONE 'UTC')::date AS completed_on
FROM public.lesson_progress p;
--> statement-breakpoint
CREATE VIEW brain.rank_steps AS
SELECT r.user_id, r.rank AS step, (r.achieved_at AT TIME ZONE 'UTC')::date AS achieved_on
FROM public.rank_history r;
--> statement-breakpoint
REVOKE ALL ON brain.members, brain.lessons_completed, brain.rank_steps FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA brain TO brain_reader;
--> statement-breakpoint
GRANT SELECT ON brain.members, brain.lessons_completed, brain.rank_steps TO brain_reader;
--> statement-breakpoint
-- Supabase's API roles, where they exist, get nothing here either, whatever default
-- privileges the platform keeps. (The Data API does not expose this schema anyway.)
DO $$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA brain FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON SCHEMA brain FROM %I', api_role);
    END IF;
  END LOOP;
END
$$;
