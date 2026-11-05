import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Operational health check — DB reachability and catalogue size.
 * Readiness: returns 200 only when the database is reachable and counts
 * answer. Operational detail stays non-sensitive (counts, no driver data).
 * no-store: stats feeding public copy must never be stale-cached.
 */
export async function GET() {
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
          opportunities,
          sources,
          time: new Date().toISOString(),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        ok: false,
        error: "service_unavailable",
        data: { status: "degraded", database: "unreachable" },
        retryable: true,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
