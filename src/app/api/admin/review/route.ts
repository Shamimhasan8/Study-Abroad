import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/identity/auth";
import { badRequest, unauthorized, notFound, serverError } from "@/lib/validation";
import { z } from "zod";

const submitSchema = z.object({
  sourceKey: z.string().min(1).max(60),
  opportunitySlug: z.string().max(120).optional(),
  fieldPath: z.string().min(1).max(200),
  factValue: z.string().min(1).max(1000),
  unit: z.string().max(40).optional(),
  effectiveFrom: z.string().max(20).optional(),
  confidence: z.enum(["official_page", "secondary_official", "unverified"]).default("official_page"),
  conflictNote: z.string().max(500).optional(),
});

const reviewSchema = z.object({
  evidenceId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
});

/** Submit candidate evidence for review (editorial, admin-only). */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");
    const input = parsed.data;

    const source = await db.source.findUnique({ where: { key: input.sourceKey } });
    if (!source) return badRequest("unknown_source");

    const evidence = await db.factEvidence.create({
      data: {
        sourceId: source.id,
        opportunitySlug: input.opportunitySlug ?? null,
        fieldPath: input.fieldPath,
        factValue: input.factValue,
        unit: input.unit ?? null,
        effectiveFrom: input.effectiveFrom ?? null,
        extraction: "assisted",
        reviewState: "pending",
        confidence: input.confidence,
        conflictNote: input.conflictNote ?? null,
      },
    });
    await db.reviewEvent.create({
      data: { evidenceId: evidence.id, actorId: admin.id, action: "submitted", note: "assisted extraction" },
    });
    return Response.json({ ok: true, data: { evidenceId: evidence.id } });
  } catch {
    return serverError();
  }
}

/**
 * Approve (publish) or reject evidence. Publishing creates an audit entry
 * and notifies every affected plan in-app — user-edited tasks are never
 * silently rewritten.
 */
export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");
    const { evidenceId, action, note } = parsed.data;

    const evidence = await db.factEvidence.findUnique({ where: { id: evidenceId } });
    if (!evidence) return notFound();

    await db.$transaction(async (tx) => {
      await tx.factEvidence.update({
        where: { id: evidenceId },
        data: {
          reviewState: action === "approve" ? "approved" : "rejected",
          reviewerId: admin.id,
          reviewedAt: new Date(),
        },
      });
      await tx.reviewEvent.create({
        data: { evidenceId, actorId: admin.id, action: action === "approve" ? "published" : "rejected", note: note ?? null },
      });
      await tx.auditEvent.create({
        data: {
          actorId: admin.id,
          action: action === "approve" ? "fact_published" : "fact_rejected",
          targetType: "fact_evidence",
          targetId: evidenceId,
          detailJson: JSON.stringify({ fieldPath: evidence.fieldPath, opportunitySlug: evidence.opportunitySlug }),
        },
      });

      if (action === "approve" && evidence.opportunitySlug) {
        // Find affected plans (active goals on this opportunity) and notify.
        const goals = await tx.goal.findMany({
          where: { opportunitySlug: evidence.opportunitySlug, status: "active" },
          select: { userId: true },
        });
        for (const goal of goals) {
          await tx.notificationEvent.create({
            data: {
              userId: goal.userId,
              kind: "source_change",
              title: "A source fact for your target changed",
              body: `Field "${evidence.fieldPath}" was reviewed and published for your target opportunity. Review the updated detail page; your completed tasks and edits are untouched.`,
            },
          });
        }
      }
    });

    return Response.json({ ok: true, data: { published: action === "approve" } });
  } catch {
    return serverError();
  }
}
