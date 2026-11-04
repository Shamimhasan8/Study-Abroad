import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/identity/auth";
import { unauthorized, serverError } from "@/lib/validation";

/** Editorial workspace data: queue, source health, audit trail. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();
  try {
    const [pending, sources, latestVersions, audit] = await Promise.all([
      db.factEvidence.findMany({
        where: { reviewState: "pending" },
        include: { source: true, reviewEvents: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.source.findMany({ where: { active: true }, orderBy: { key: "asc" } }),
      db.sourceVersion.findMany({ orderBy: { retrievedAt: "desc" }, take: 40, include: { source: true } }),
      db.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    ]);

    const published = await db.factEvidence.count({ where: { reviewState: "approved" } });

    return Response.json({
      ok: true,
      data: {
        queue: pending.map((e) => ({
          id: e.id,
          sourceKey: e.source.key,
          sourceTitle: e.source.title,
          opportunitySlug: e.opportunitySlug ?? undefined,
          fieldPath: e.fieldPath,
          factValue: e.factValue,
          unit: e.unit ?? undefined,
          extraction: e.extraction,
          confidence: e.confidence,
          conflictNote: e.conflictNote ?? undefined,
          createdAt: e.createdAt.toISOString(),
        })),
        sourcesHealth: latestVersions.map((v) => ({
          key: v.source.key,
          title: v.source.title,
          status: v.status,
          httpStatus: v.httpStatus ?? undefined,
          retrievedAt: v.retrievedAt.toISOString(),
          sizeBytes: v.sizeBytes ?? undefined,
          note: v.note ?? undefined,
        })),
        publishedCount: published,
        audit: audit.map((a) => ({
          id: a.id,
          action: a.action,
          targetType: a.targetType,
          targetId: a.targetId ?? undefined,
          detail: a.detailJson ?? undefined,
          createdAt: a.createdAt.toISOString(),
        })),
        sourceCount: sources.length,
      },
    });
  } catch {
    return serverError();
  }
}
