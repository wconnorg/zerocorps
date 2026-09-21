import type { Query } from "../backup/dump.ts";

/**
 * Proves what the app's database role can and cannot do. `npm run db:check-role`.
 *
 * With one database shared by the laptop and the live site, this role is the main
 * protection against a destructive mistake. The proof is read from Postgres's own
 * privilege catalogue, which is what Postgres itself consults, plus one live attempt
 * to create a table inside a transaction that is always rolled back.
 *
 * ALTER and DROP need ownership in Postgres (or superuser, or membership of the
 * owner), so "owns nothing, is not a superuser, belongs to no role" IS the proof that
 * it cannot alter or drop. Nothing is attempted against a real table.
 */

export const APP_ROLE = "zerocorps_app";

export type CheckStatus = "pass" | "fail" | "review" | "info";
export type CheckLine = { status: CheckStatus; label: string; detail?: string };

export type RoleCheckInput = {
  query: Query;
  /** Runs one statement in a transaction that is ALWAYS rolled back. */
  attemptAndRollBack: (statement: string) => Promise<{ allowed: boolean; code?: string }>;
};

const list = (rows: Record<string, unknown>[], key = "name") =>
  rows.map((row) => String(row[key])).join(", ");

export async function checkAppRole({
  query,
  attemptAndRollBack,
}: RoleCheckInput): Promise<CheckLine[]> {
  const lines: CheckLine[] = [];
  const add = (ok: boolean, label: string, detail?: string) =>
    lines.push({ status: ok ? "pass" : "fail", label, detail: ok ? undefined : detail });

  const [who] = await query("SELECT current_user::text AS name");
  const connectedAs = String(who?.name);
  add(
    connectedAs === APP_ROLE,
    `Connected as ${APP_ROLE}`,
    `DATABASE_URL connects as "${connectedAs}". Change its username to ${APP_ROLE}.<project-ref> and use that role's password.`,
  );
  if (connectedAs !== APP_ROLE) return lines;

  const [role] = await query(
    `SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
     FROM pg_roles WHERE rolname = current_user`,
  );
  const attributes = Object.entries(role ?? {})
    .filter(([, value]) => value === true)
    .map(([name]) => name.replace(/^rol/, ""));
  add(
    attributes.length === 0,
    "Holds no special attribute (superuser, createdb, createrole, replication, bypassrls)",
    `It has: ${attributes.join(", ")}.`,
  );

  const memberships = await query(
    `SELECT r.rolname AS name FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.roleid
     WHERE m.member = (SELECT oid FROM pg_roles WHERE rolname = current_user)`,
  );
  add(
    memberships.length === 0,
    "Belongs to no other role",
    `It is a member of: ${list(memberships)}.`,
  );

  const owned = await query(
    `SELECT n.nspname || '.' || c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
     UNION ALL SELECT 'schema ' || nspname FROM pg_namespace
       WHERE nspowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
     UNION ALL SELECT 'function ' || p.proname FROM pg_proc p
       WHERE p.proowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
     UNION ALL SELECT 'database ' || datname FROM pg_database
       WHERE datdba = (SELECT oid FROM pg_roles WHERE rolname = current_user)`,
  );
  add(
    owned.length === 0,
    "Owns nothing (no table, schema, function or database)",
    `It owns: ${list(owned)}.`,
  );
  add(
    owned.length === 0 && attributes.length === 0 && memberships.length === 0,
    "Cannot ALTER or DROP any table (that needs ownership, and it has none)",
    "See the lines above.",
  );

  const creatable = await query(
    `SELECT nspname AS name FROM pg_namespace
     WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema'
       AND has_schema_privilege(current_user, oid, 'CREATE')`,
  );
  add(
    creatable.length === 0,
    "Cannot CREATE anything in any schema",
    `It can create in: ${list(creatable)}.`,
  );

  const [database] = await query(
    "SELECT has_database_privilege(current_user, current_database(), 'CREATE') AS can_create",
  );
  add(
    database?.can_create !== true,
    "Cannot create schemas in the database",
    "It has CREATE on the database.",
  );

  const probe = await attemptAndRollBack("CREATE TABLE public.zz_role_probe (id integer)");
  add(
    !probe.allowed && probe.code === "42501",
    "A real CREATE TABLE attempt is refused (rolled back either way)",
    probe.allowed
      ? "The table was created (and rolled back)."
      : `Unexpected result: ${probe.code ?? "no error code"}.`,
  );

  const excessive = await query(
    `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
       AND (has_table_privilege(current_user, c.oid, 'TRUNCATE')
         OR has_table_privilege(current_user, c.oid, 'REFERENCES')
         OR has_table_privilege(current_user, c.oid, 'TRIGGER'))`,
  );
  add(
    excessive.length === 0,
    "Cannot TRUNCATE, add triggers to, or add foreign keys to any table",
    `It can on: ${list(excessive)}.`,
  );

  const tables = await query(
    `SELECT c.relname AS name,
            c.relrowsecurity AS rls,
            EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname
                    AND current_user = ANY (p.roles)) AS has_policy,
            has_table_privilege(current_user, c.oid, 'SELECT') AND has_table_privilege(current_user, c.oid, 'INSERT')
              AND has_table_privilege(current_user, c.oid, 'UPDATE') AND has_table_privilege(current_user, c.oid, 'DELETE') AS can_use
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') ORDER BY 1`,
  );
  const unprotected = tables.filter((table) => table.rls !== true);
  const closed = tables.filter((table) => table.has_policy !== true || table.can_use !== true);
  add(
    tables.length > 0,
    "The app's tables exist",
    "There are no tables in public yet. Run the migrations first.",
  );
  add(
    unprotected.length === 0,
    "Row-level security is on for every table",
    `It is OFF on: ${list(unprotected)}.`,
  );
  add(
    closed.length === 0,
    `Every table is opened to it by an explicit policy (${tables.length} tables)`,
    `No policy or grant for: ${list(closed)}. The app cannot use these.`,
  );

  const outside = await query(
    `SELECT n.nspname || '.' || c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
       AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\\_toast%'
       AND has_schema_privilege(current_user, n.oid, 'USAGE')
       AND has_table_privilege(current_user, c.oid, 'SELECT')
       AND NOT (n.nspname = 'public' AND c.relkind IN ('r', 'p') AND EXISTS (
             SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname
               AND current_user = ANY (p.roles)))
     ORDER BY 1`,
  );
  lines.push(
    outside.length === 0
      ? { status: "pass", label: "Can read nothing outside the app's own tables" }
      : {
          status: "review",
          label: `Can read ${outside.length} object(s) outside the app's tables`,
          detail: `${list(outside)}. These are usually open to every role by the host. Names only; nothing was read.`,
        },
  );

  const [temp] = await query(
    "SELECT has_database_privilege(current_user, current_database(), 'TEMP') AS can_temp",
  );
  if (temp?.can_temp === true) {
    lines.push({
      status: "info",
      label: "May create temporary tables",
      detail:
        "Every Postgres role can by default. They are private to one connection and vanish with it.",
    });
  }
  return lines;
}
