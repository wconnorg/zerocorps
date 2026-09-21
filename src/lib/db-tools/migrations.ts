import type { Query } from "../backup/dump.ts";

/**
 * Works out which migrations in `drizzle/` have not been applied yet, the same way
 * drizzle-orm's migrator decides: everything in the journal that is newer than the
 * newest row in `drizzle.__drizzle_migrations`.
 */

export type JournalEntry = { idx: number; when: number; tag: string };

export function parseJournal(json: string): JournalEntry[] {
  const journal = JSON.parse(json) as { entries?: JournalEntry[] };
  return [...(journal.entries ?? [])].sort((a, b) => a.idx - b.idx);
}

export async function pendingMigrations(
  query: Query,
  journal: JournalEntry[],
): Promise<JournalEntry[]> {
  const [present] = await query(
    "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present",
  );
  if (!present?.present) return journal;
  const [last] = await query(
    "SELECT max(created_at)::text AS newest FROM drizzle.__drizzle_migrations",
  );
  const newest = last?.newest == null ? -1 : Number(last.newest);
  return journal.filter((entry) => entry.when > newest);
}
