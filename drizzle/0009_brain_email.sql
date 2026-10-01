-- The brain export also shows each member's email address (owner, 2026-10-01), which
-- replaces the brief's "NEVER email" for the brain; the privacy page says so. Still never
-- a phone, an IP, a device, a password, a code or a session.
--
-- CREATE OR REPLACE may only add columns at the end, which is what this does; the view's
-- grants (brain_reader alone) stay as they are.
CREATE OR REPLACE VIEW brain.members AS
SELECT
  (row_number() OVER (ORDER BY u.created_at, u.id))::integer AS member_number,
  u.id AS user_id,
  u.username,
  NULLIF(u.display_name, '') AS display_name,
  (u.created_at AT TIME ZONE 'UTC')::date AS joined_on,
  d.discord_username,
  u.email
FROM public.users u
LEFT JOIN public.discord_links d ON d.user_id = u.id;
