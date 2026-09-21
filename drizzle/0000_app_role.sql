-- The role the app connects as. Hand-written: drizzle-kit does not manage roles here.
--
-- It is created WITHOUT a password and WITHOUT the right to log in, so no secret is
-- ever committed. The owner gives it a password by hand, once:
--     ALTER ROLE zerocorps_app WITH LOGIN PASSWORD '...';
--
-- It can never create, alter or drop anything: it owns no table, it has no CREATE
-- right on the schema or the database, and it holds no special attribute. It reaches
-- the app's tables through the grants below plus one row-level-security policy per
-- table, which each table's own migration adds. It does NOT get BYPASSRLS, which
-- would switch row-level security off everywhere, including tables added later.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'zerocorps_app') THEN
    CREATE ROLE zerocorps_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO zerocorps_app;
--> statement-breakpoint
-- Tables that THIS role (the one running migrations) creates in `public` from now on
-- are readable and writable by the app. A forgotten GRANT therefore cannot break the
-- app; a forgotten POLICY still leaves the table closed, and a test catches that.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO zerocorps_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO zerocorps_app;
