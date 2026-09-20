/**
 * Dumps and restores the app's data as plain text, one row per line.
 *
 * The SCHEMA is not in a backup: it lives in this repository as migrations. A backup
 * holds the rows of every table in `public`, written by Postgres itself as JSON
 * (`to_jsonb`) and read back by Postgres itself (`jsonb_populate_recordset`). The
 * row text is never parsed in JavaScript, so nothing is rounded or re-encoded on the
 * way: a bigint, a timestamp with its zone and a uuid come back exactly as they were.
 *
 * Restore NEVER overwrites. It refuses if any table it would fill already has rows.
 *
 * It talks to the database through a one-function interface so the same code runs on
 * postgres.js (the real database) and PGlite (tests and the restore drill). The
 * caller supplies the transaction: REPEATABLE READ, READ ONLY for a dump, so every
 * table is read at the same instant.
 *
 * This module imports nothing, so the scripts in `scripts/` can load it.
 */

export type Query = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

export type DumpSummary = {
  createdAt: string;
  tables: { qualified: string; rows: number }[];
  migrations: string[];
};

const DUMP_MARKER = "#zerocorps-dump";
const DUMP_VERSION = "1";
const RESTORE_BATCH = 500;

export class RestoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestoreError";
  }
}

async function appliedMigrations(query: Query): Promise<string[]> {
  const [present] = await query(
    "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present",
  );
  if (!present?.present) return [];
  const rows = await query("SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at");
  return rows.map((row) => String(row.hash));
}

async function publicTables(query: Query): Promise<string[]> {
  const rows = await query(
    `SELECT quote_ident(n.nspname) || '.' || quote_ident(c.relname) AS qualified
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
     ORDER BY c.relname`,
  );
  return rows.map((row) => String(row.qualified));
}

export async function dumpDatabase(
  query: Query,
  createdAt: string,
): Promise<{ text: string; summary: DumpSummary }> {
  const summary: DumpSummary = {
    createdAt,
    tables: [],
    migrations: await appliedMigrations(query),
  };
  const lines: string[] = [];
  for (const qualified of await publicTables(query)) {
    // `qualified` comes from quote_ident() above, never from user input.
    const rows = await query(`SELECT to_jsonb(t)::text AS row FROM ${qualified} AS t`);
    for (const row of rows) lines.push(`${qualified}\t${String(row.row)}`);
    summary.tables.push({ qualified, rows: rows.length });
  }
  const head = [DUMP_MARKER, DUMP_VERSION, JSON.stringify(summary)].join("\t");
  return { text: [head, ...lines].join("\n") + "\n", summary };
}

export function readDumpSummary(text: string): DumpSummary {
  const [marker, version, json] = (text.split("\n", 1)[0] ?? "").split("\t");
  if (marker !== DUMP_MARKER)
    throw new RestoreError("This does not look like a ZeroCorps database dump.");
  if (version !== DUMP_VERSION)
    throw new RestoreError(`This dump uses version ${version}, which this command cannot read.`);
  return JSON.parse(json ?? "{}") as DumpSummary;
}

/** Parents before children, so foreign keys hold while rows go in. */
async function restoreOrder(query: Query, tables: string[]): Promise<string[]> {
  const edges = await query(
    `SELECT quote_ident(cn.nspname) || '.' || quote_ident(c.relname) AS child,
            quote_ident(pn.nspname) || '.' || quote_ident(p.relname) AS parent
     FROM pg_constraint k
     JOIN pg_class c ON c.oid = k.conrelid JOIN pg_namespace cn ON cn.oid = c.relnamespace
     JOIN pg_class p ON p.oid = k.confrelid JOIN pg_namespace pn ON pn.oid = p.relnamespace
     WHERE k.contype = 'f' AND cn.nspname = 'public'`,
  );
  const waitingOn = new Map(tables.map((table) => [table, new Set<string>()]));
  for (const edge of edges) {
    const child = String(edge.child);
    const parent = String(edge.parent);
    if (child !== parent && waitingOn.has(child) && waitingOn.has(parent))
      waitingOn.get(child)?.add(parent);
  }
  const ordered: string[] = [];
  while (waitingOn.size > 0) {
    const ready = [...waitingOn]
      .filter(([, parents]) => parents.size === 0)
      .map(([table]) => table);
    if (ready.length === 0)
      throw new RestoreError(
        "The tables reference each other in a circle; cannot order the restore.",
      );
    for (const table of ready.sort()) {
      ordered.push(table);
      waitingOn.delete(table);
      for (const parents of waitingOn.values()) parents.delete(table);
    }
  }
  return ordered;
}

export async function restoreDatabase(query: Query, text: string): Promise<DumpSummary> {
  const summary = readDumpSummary(text);

  const rowsByTable = new Map<string, string[]>(
    summary.tables.map((table) => [table.qualified, []]),
  );
  for (const line of text.split("\n").slice(1)) {
    if (line === "") continue;
    const tab = line.indexOf("\t");
    const rows = rowsByTable.get(line.slice(0, tab));
    if (!rows)
      throw new RestoreError("The dump holds a row for a table it does not list. It is damaged.");
    rows.push(line.slice(tab + 1));
  }
  for (const table of summary.tables) {
    if (rowsByTable.get(table.qualified)?.length !== table.rows) {
      throw new RestoreError(
        `The dump is incomplete: ${table.qualified} should have ${table.rows} rows.`,
      );
    }
  }

  const applied = new Set(await appliedMigrations(query));
  if (summary.migrations.some((hash) => !applied.has(hash))) {
    throw new RestoreError(
      "The target database is older than the backup: run the migrations on it first, then restore.",
    );
  }

  const existing = new Set(await publicTables(query));
  for (const table of summary.tables) {
    if (!existing.has(table.qualified))
      throw new RestoreError(`The target has no table ${table.qualified}.`);
    const [row] = await query(`SELECT EXISTS (SELECT 1 FROM ${table.qualified}) AS has_rows`);
    if (row?.has_rows) {
      throw new RestoreError(
        `Refusing to restore: ${table.qualified} already has rows. A restore never overwrites; use an empty database.`,
      );
    }
  }

  for (const qualified of await restoreOrder(
    query,
    summary.tables.map((table) => table.qualified),
  )) {
    const rows = rowsByTable.get(qualified) ?? [];
    for (let start = 0; start < rows.length; start += RESTORE_BATCH) {
      const batch = `[${rows.slice(start, start + RESTORE_BATCH).join(",")}]`;
      await query(
        `INSERT INTO ${qualified} SELECT * FROM jsonb_populate_recordset(NULL::${qualified}, $1::jsonb)`,
        [batch],
      );
    }
    const [count] = await query(`SELECT count(*)::int AS rows FROM ${qualified}`);
    if (Number(count?.rows) !== rows.length)
      throw new RestoreError(`Row count mismatch after restoring ${qualified}.`);
  }
  return summary;
}
