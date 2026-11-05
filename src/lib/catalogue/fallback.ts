/**
 * Verified-seed fallback for deployments without a reachable database.
 *
 * Serverless hosts (e.g. Vercel without a DATABASE_URL) have no SQLite file
 * and a read-only filesystem. The public catalogue must not collapse into
 * 503s there: reads serve the exact committed, editorially reviewed seed
 * records — the same source of truth `prisma/seed.ts` writes into SQLite —
 * in a clearly flagged read-only mode (see the health route's
 * `catalogue: "seed-fallback"`).
 *
 * Honesty rules:
 * - Fallback data is the verified seed snapshot, never invented content.
 * - The fallback covers READS only. Editorial/admin/auth write paths keep
 *   failing honestly with typed 503 envelopes — they never fake success.
 * - The fallback activates on database FAILURE only. A reachable but empty
 *   database still returns an honest empty list (an operator issue, not a
 *   connectivity issue).
 */
import { COUNTRY_GUIDES } from "../../../prisma/seeds/countries";
import { JAPAN_OPPORTUNITIES } from "../../../prisma/seeds/opportunities-japan";
import { US_OPPORTUNITIES } from "../../../prisma/seeds/opportunities-us";
import { EU_OPPORTUNITIES } from "../../../prisma/seeds/opportunities-eu";
import { SOURCES } from "../../../prisma/seeds/sources";
import type { Opportunity, SourceRef } from "@/lib/types";

/** Guide shape returned by the catalogue queries (DB row and seed agree). */
export interface GuideSummary {
  code: string;
  nameEn: string;
  nameBn: string;
  contentEn: string;
  contentBn: string;
  sources: SourceRef[];
}

/** Seed catalogue, ordered identically to the DB query (country, title). */
export const FALLBACK_OPPORTUNITIES: Opportunity[] = [
  ...JAPAN_OPPORTUNITIES,
  ...US_OPPORTUNITIES,
  ...EU_OPPORTUNITIES,
].sort((a, b) =>
  a.country === b.country
    ? a.title.localeCompare(b.title)
    : a.country.localeCompare(b.country),
);

/** Seed guides, ordered identically to the DB query (code). */
export const FALLBACK_GUIDES: GuideSummary[] = [...COUNTRY_GUIDES].sort((a, b) =>
  a.code.localeCompare(b.code),
);

/** Seed source registry — used by the health route to report fallback size. */
export const FALLBACK_SOURCES = SOURCES;
