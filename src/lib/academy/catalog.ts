import { join } from "node:path";
import { env } from "@/env";
import { type Catalog, ContentError, loadCatalog } from "./content";

/**
 * The Academy's lessons for the running site. Server-only.
 *
 * On the live site the folder is read once and kept. On the laptop it is read on every
 * request, so a lesson the owner has just saved in Obsidian shows at the next refresh.
 *
 * The folder ships with the site: `outputFileTracingIncludes` in `next.config.ts` puts
 * `content/academy/**` into the server bundle (SECURITY.md, hosting assumptions ledger).
 */

let cached: Catalog | null = null;

export function getCatalog(): Catalog {
  if (cached) return cached;
  const catalog = loadCatalog(join(process.cwd(), "content", "academy"));
  if (env.APP_ENV === "production") cached = catalog;
  return catalog;
}

export type CatalogState =
  | { status: "ready"; catalog: Catalog }
  /** `problems` is shown only on the laptop, where it helps the owner fix a lesson. */
  | { status: "broken"; problems: string[] };

/** The same, for a page: a broken lesson folder becomes a message, never a crash. */
export function readCatalog(): CatalogState {
  try {
    return { status: "ready", catalog: getCatalog() };
  } catch (error) {
    const problems =
      error instanceof ContentError ? error.problems : ["The lessons could not be read."];
    console.error(`[academy] the lesson folder has ${problems.length} problem(s)`);
    return { status: "broken", problems: env.APP_ENV === "local" ? problems : [] };
  }
}
