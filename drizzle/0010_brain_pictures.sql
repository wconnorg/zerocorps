-- The brain shows each member's profile picture (owner, 2026-10-04: the brain lists
-- "email username date signed up profile picture"); the privacy page says so. Still never
-- a phone, an IP, a device, a password, a code or a session.
--
-- Two parts, so a picture is read only when the vault does not have it yet:
--
-- - brain.members gains `picture_version`: the short hash of the member's picture that the
--   site already keeps beside the account (`users.avatar_url`, written in the same
--   transaction as the picture), and NULL for a member without one. CREATE OR REPLACE may
--   only add columns at the end, which is what this does; the view's grants stay.
-- - brain.member_pictures holds the pictures themselves: the 256x256 WebP the site made
--   from the member's upload (only pixels; a table check allows nothing else), by user id.
--   Read by brain_reader alone, like the other views.
CREATE OR REPLACE VIEW brain.members AS
SELECT
  (row_number() OVER (ORDER BY u.created_at, u.id))::integer AS member_number,
  u.id AS user_id,
  u.username,
  NULLIF(u.display_name, '') AS display_name,
  (u.created_at AT TIME ZONE 'UTC')::date AS joined_on,
  d.discord_username,
  u.email,
  CASE WHEN a.user_id IS NULL THEN NULL ELSE u.avatar_url END AS picture_version
FROM public.users u
LEFT JOIN public.discord_links d ON d.user_id = u.id
LEFT JOIN public.avatars a ON a.user_id = u.id;
--> statement-breakpoint
CREATE VIEW brain.member_pictures AS
SELECT a.user_id, a.image
FROM public.avatars a;
--> statement-breakpoint
REVOKE ALL ON brain.member_pictures FROM PUBLIC;
--> statement-breakpoint
GRANT SELECT ON brain.member_pictures TO brain_reader;
--> statement-breakpoint
-- Supabase's API roles, where they exist, get nothing on the new view either, whatever
-- default privileges the platform keeps (they have no use of the schema since 0008).
DO $$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON brain.member_pictures FROM %I', api_role);
    END IF;
  END LOOP;
END
$$;
