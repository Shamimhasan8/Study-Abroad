import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/identity/auth";
import { badRequest, unauthorized, notFound, serverError } from "@/lib/validation";
import { parseFieldPath, coerceFactValue } from "@/lib/editorial/fields";
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
  /** Opportunity version this extraction was made against. */
  expectedVersion: z.number().int().min(1).optional(),
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

    // Reject invalid field paths at submission time — they can never even
    // queue for publication.
    const field = parseFieldPath(input.fieldPath);
    if (field.kind === "invalid") return badRequest(`field_path_rejected: ${field.reason}`);

    const source = await db.source.findUnique({ where: { key: input.sourceKey } });
    if (!source) return badRequest("unknown_source");

    let expectedVersion: number | null = input.expectedVersion ?? null;
    if (expectedVersion === null && input.opportunitySlug) {
      const opp = await db.opportunity.findUnique({ where: { slug: input.opportunitySlug }, select: { version: true } });
      expectedVersion = opp?.version ?? null;
    }

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
        // expected version travels with the evidence until review time
        expectedVersion: expectedVersion ?? null,
      },
    });
    await db.reviewEvent.create({
      data: { evidenceId: evidence.id, actorId: admin.id, action: "submitted", note: "assisted extraction" },
    });
    return Response.json({ ok: true, data: { evidenceId: evidence.id } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return serverError();
  }
}

/**
 * Approve (publish) or reject evidence.
 *
 * Publishing is transactional and complete:
 * 1. The field path must be in the allowlist and the value must pass its
 *    typed validator.
 * 2. The opportunity version must match the version the evidence was
 *    extracted against (optimistic concurrency) — a stale extraction is
 *    rejected for re-review, never merged blind.
 * 3. The previous row is snapshotted into OpportunityVersion history.
 * 4. The published value is written into the actual Opportunity row.
 * 5. Every affected active plan gets ONE deduplicated notice; completed
 *    tasks and manual edits are never rewritten.
 * Any failure rolls the whole transaction back — no "published" notification
 * ever goes out for a change that did not land.
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
    if (evidence.reviewState === "approved") return badRequest("already_reviewed");

    if (action === "reject") {
      await db.$transaction(async (tx) => {
        await tx.factEvidence.update({
          where: { id: evidenceId },
          data: { reviewState: "rejected", reviewerId: admin.id, reviewedAt: new Date() },
        });
        await tx.reviewEvent.create({
          data: { evidenceId, actorId: admin.id, action: "rejected", note: note ?? null },
        });
        await tx.auditEvent.create({
          data: { actorId: admin.id, action: "fact_rejected", targetType: "fact_evidence", targetId: evidenceId, detailJson: JSON.stringify({ fieldPath: evidence.fieldPath, opportunitySlug: evidence.opportunitySlug }) },
        });
      });
      return Response.json({ ok: true, data: { published: false } }, { headers: { "Cache-Control": "no-store" } });
    }

    // ---- Approve: publish if (and only if) a valid target + field exists ----
    const slug = evidence.opportunitySlug;
    const field = parseFieldPath(evidence.fieldPath);

    if (!slug || field.kind === "invalid") {
      // No publishable target: stays a REVIEWED note — never called published.
      await db.$transaction(async (tx) => {
        await tx.factEvidence.update({
          where: { id: evidenceId },
          data: { reviewState: "approved", reviewerId: admin.id, reviewedAt: new Date() },
        });
        await tx.reviewEvent.create({
          data: { evidenceId, actorId: admin.id, action: "reviewed", note: note ?? "no publishable target — recorded as reviewed evidence only" },
        });
        await tx.auditEvent.create({
          data: { actorId: admin.id, action: "fact_reviewed", targetType: "fact_evidence", targetId: evidenceId, detailJson: JSON.stringify({ fieldPath: evidence.fieldPath, opportunitySlug: slug ?? null, reason: field.kind === "invalid" ? field.reason : "no target slug" }) },
        });
      });
      return Response.json({ ok: true, data: { published: false, reviewedOnly: true } }, { headers: { "Cache-Control": "no-store" } });
    }

    const coerce = coerceFactValue(evidence.factValue ?? "", field.validator);
    if (!coerce.ok) {
      return badRequest(`value_failed_validation: ${coerce.error}`);
    }

    // Version check: the evidence must have been extracted against the
    // CURRENT published version; otherwise someone published a change in
    // between and this candidate needs re-review against the new facts.
    const expectedVersion = evidence.expectedVersion ?? undefined;

    const result = await db.$transaction(async (tx) => {
      const opp = await tx.opportunity.findUnique({ where: { slug } });
      if (!opp) throw new Error("target_not_found");
      if (expectedVersion !== undefined && opp.version !== expectedVersion) {
        return { versionConflict: true, currentVersion: opp.version, expectedVersion };
      }

      // 1. Snapshot the previous version.
      await tx.opportunityVersion.create({
        data: {
          opportunitySlug: slug,
          version: opp.version,
          snapshotJson: JSON.stringify(opp),
          changedBy: admin.id,
          changeReason: note ?? `editorial publish: ${evidence.fieldPath}`,
        },
      });

      // 2. Apply the validated write to the live row.
      let before: unknown;
      let after: unknown;
      const bumpedVersion = opp.version + 1;
      if (field.kind === "scalar") {
        before = (opp as unknown as Record<string, unknown>)[field.column];
        after = coerce.value;
        await tx.opportunity.update({
          where: { slug },
          data: { [field.column]: coerce.value, version: bumpedVersion, updatedAt: new Date() } as Record<string, unknown>,
        });
      } else {
        const items = JSON.parse((opp as unknown as Record<string, string>)[field.jsonColumn] ?? "[]") as Record<string, unknown>[];
        const idx = items.findIndex((it) => String(it.id) === field.itemId);
        if (idx === -1) throw new Error("item_not_found");
        before = items[idx][field.key];
        items[idx][field.key] = coerce.value;
        after = coerce.value;
        await tx.opportunity.update({
          where: { slug },
          data: { [field.jsonColumn]: JSON.stringify(items), version: bumpedVersion, updatedAt: new Date() } as Record<string, unknown>,
        });
      }

      // 3. Evidence is approved; review + audit records carry the diff.
      await tx.factEvidence.update({
        where: { id: evidenceId },
        data: { reviewState: "approved", reviewerId: admin.id, reviewedAt: new Date() },
      });
      await tx.reviewEvent.create({
        data: { evidenceId, actorId: admin.id, action: "published", note: note ?? null },
      });
      await tx.auditEvent.create({
        data: {
          actorId: admin.id,
          action: "fact_published",
          targetType: "opportunity",
          targetId: slug,
          detailJson: JSON.stringify({
            fieldPath: evidence.fieldPath,
            label: field.label,
            before: before === undefined ? null : before,
            after: after === undefined ? null : after,
            version: bumpedVersion,
            evidenceId,
          }),
        },
      });

      // 4. ONE deduplicated notice per affected user (active goals on this
      //    opportunity). Completed tasks and manual edits are untouched.
      const goals = await tx.goal.findMany({
        where: { opportunitySlug: slug, status: "active" },
        select: { userId: true },
      });
      const seen = new Set<string>();
      for (const goal of goals) {
        if (seen.has(goal.userId)) continue;
        seen.add(goal.userId);
        await tx.notificationEvent.create({
          data: {
            userId: goal.userId,
            kind: "source_change",
            title: "A source fact for your target changed",
            body: `"${field.label}" was reviewed and published for your target opportunity (${evidence.fieldPath}). Review the updated detail page; your completed tasks and edits are untouched.`,
          },
        });
      }

      return { versionConflict: false, published: true, slug, fieldPath: evidence.fieldPath, before, after, version: bumpedVersion, notifiedUsers: seen.size };
    });

    if (result.versionConflict) {
      return Response.json(
        { ok: false, error: "version_conflict", data: result },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json({ ok: true, data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (message === "target_not_found" || message === "item_not_found") {
      return badRequest(`publish_target_missing: ${message}`);
    }
    return serverError();
  }
}
