import { db } from "@/lib/db";
import { FALLBACK_OPPORTUNITIES, FALLBACK_SOURCES } from "@/lib/catalogue/fallback";

export const dynamic = "force-dynamic";

/**
 * Operational health check — reachability and catalogue serving mode.
 *
 * Readiness: returns 200 while the service can serve its public experience —
 * either from the database ("healthy") or, when the database is unreachable
 * (e.g. serverless deployments without DATABASE_URL), from the committed
 * verified seeds in read-only fallback mode ("degraded"). A 503 is reserved
 * for states where the service cannot serve at all. Operational detail stays
 * non-sensitive (counts and mode, no driver data); the counts are real
 * serving counts, never hardcoded copy.
 * no-store: stats feeding public copy must never be stale-cached.
 */
export async function GET() {
  const time = new Date().toISOString();
  try {
    const [opportunities, sources] = await Promise.all([
      db.opportunity.count(),
      db.source.count(),
    ]);
    return Response.json(
      {
        ok: true,
        data: {
          status: "healthy",
          database: "reachable",
          catalogue: "database",
          opportunities,
          sources,
          time,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    // Database unreachable — the public catalogue still serves every read
    // from the verified seed fallback. Signed-in write paths degrade
    // honestly (typed 503 envelopes); guest flows are fully functional.
    return Response.json(
      {
        ok: true,
        data: {
          status: "degraded",
          database: "unreachable",
          catalogue: "seed-fallback",
          opportunities: FALLBACK_OPPORTUNITIES.length,
          sources: FALLBACK_SOURCES.length,
          time,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
