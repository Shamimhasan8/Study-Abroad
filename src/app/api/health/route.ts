import { db } from "@/lib/db";

/** Operational health check — DB reachability and catalogue size. */
export async function GET() {
  try {
    const [opportunities, sources] = await Promise.all([
      db.opportunity.count(),
      db.source.count(),
    ]);
    return Response.json({
      ok: true,
      data: {
        status: "healthy",
        database: "reachable",
        opportunities,
        sources,
        time: new Date().toISOString(),
      },
    });
  } catch {
    return Response.json(
      { ok: false, data: { status: "degraded", database: "unreachable" } },
      { status: 503 },
    );
  }
}
