import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { getOpportunity } from "@/lib/catalogue/queries";
import { evaluateOpportunity } from "@/lib/matching/engine";
import { generatePlan } from "@/lib/planning/engine";
import { planGenerateSchema, badRequest, notFound, serverError } from "@/lib/validation";
import {
  canonicalPreviewJson,
  mergePreservedTasks,
  parsePlanGenerateOk,
  planPreviewDocSchema,
  preservedCounts,
  PREVIEW_TTL_MS,
  REPLAN_ERRORS,
  type PlanPreviewDoc,
  type PreservedTask,
} from "@/lib/planning/replan";
import type { PlanData, PlanTask, ProfileData } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Plan generation — the single replan contract (src/lib/planning/replan.ts).
 *
 * Guests receive the generated plan for local persistence. Signed-in users:
 * - Regeneration over an edited plan answers `kind:"confirmation"` with a
 *   PERSISTED preview (token + hash). Confirm echoes the token back and the
 *   server applies EXACTLY the persisted tasks — never a regenerated
 *   proposal — re-merging completed/edited work from the current plan.
 * - Cancel is purely client-side: nothing here mutates the active plan.
 * - A missing/expired/mismatched token is `409 stale_preview`.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = planGenerateSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");
    const { slug, profile: guestProfile, confirmReplace, previewToken, scenario } = parsed.data;

    const opportunity = await getOpportunity(slug);
    if (!opportunity) return notFound();

    let profile: ProfileData | null = null;
    const user = await getCurrentUser();
    if (user) {
      const row = await db.profile.findUnique({ where: { userId: user.id } });
      profile = row ? (JSON.parse(row.data) as ProfileData) : null;
    }
    if (!profile && guestProfile) profile = guestProfile;
    if (!profile) {
      return Response.json({ ok: false, error: "needs_profile" }, { status: 422 });
    }
    // Scenario overrides: preview-only profile merge (never persisted).
    if (scenario && !confirmReplace) {
      profile = {
        ...profile,
        ...(scenario.weeklyHours !== undefined ? { weeklyHours: scenario.weeklyHours } : {}),
        ...(scenario.targetIntakeYear !== undefined ? { targetIntakeYear: scenario.targetIntakeYear } : {}),
        ...(scenario.targetIntakeTerm !== undefined ? { targetIntakeTerm: scenario.targetIntakeTerm } : {}),
        ...(scenario.annualContributionBdt !== undefined ? { annualContributionBdt: scenario.annualContributionBdt } : {}),
        ...(scenario.upfrontFundsBdt !== undefined ? { upfrontFundsBdt: scenario.upfrontFundsBdt } : {}),
      };
    }

    // ---------- Confirmation: apply the persisted, reviewed proposal ----------
    if (user && confirmReplace) {
      if (!previewToken) {
        return Response.json(
          { ok: false, error: REPLAN_ERRORS.tokenRequired },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      const row = await db.planPreview.findFirst({
        where: { id: previewToken, userId: user.id },
      });
      if (!row || row.expiresAt.getTime() <= Date.now()) {
        return Response.json(
          { ok: false, error: REPLAN_ERRORS.stalePreview, retryable: false },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
      const docParsed = planPreviewDocSchema.safeParse(JSON.parse(row.previewJson));
      if (!docParsed.success) {
        // Corrupted preview can never be applied — force a fresh review.
        await db.planPreview.delete({ where: { id: row.id } }).catch(() => {});
        return Response.json(
          { ok: false, error: REPLAN_ERRORS.stalePreview, retryable: false },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
      const doc = docParsed.data;
      const recomputed = createHash("sha256")
        .update(canonicalPreviewJson(doc))
        .digest("hex")
        .slice(0, 32);
      if (recomputed !== row.proposalHash) {
        return Response.json(
          { ok: false, error: REPLAN_ERRORS.hashMismatch, retryable: false },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }

      // Re-merge preserved work from the CURRENT active plan so progress
      // made after the preview was generated is still kept; definitions
      // (titles/dates/effort/order) stay exactly the reviewed ones.
      const preserved = await loadPreserved(user.id);
      const appliedTasks = mergePreservedTasks(
        doc.preview.tasks as PlanTask[],
        preserved,
      );

      const savedPlan = await applyPlan(user.id, slug, profile, appliedTasks, {
        horizonMonths: doc.preview.horizonMonths,
        engineVersion: doc.preview.engineVersion,
        infeasible: doc.preview.infeasible,
        feasibilityNote: doc.preview.feasibilityNote,
        goalSlug: doc.preview.goalSlug ?? slug,
        goalTitle: doc.preview.goalTitle,
      });

      // One-time use: a consumed preview can never be applied twice.
      await db.planPreview.delete({ where: { id: row.id } }).catch(() => {});

      return Response.json(
        { ok: true, data: { kind: "plan", plan: savedPlan, assumedIntake: doc.assumedIntake } },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // ---------- Generate a fresh proposal ----------
    const evaluation = evaluateOpportunity(opportunity.requirements, profile, slug);
    const { plan, assumedIntake } = generatePlan(profile, opportunity, evaluation);

    // Scenario requests are PREVIEW-ONLY for everyone: cancel must mutate
    // nothing, so the proposal is never applied here. Apply = save the
    // profile, then generate normally (confirmation gate included).
    if (scenario && !confirmReplace) {
      const preserved = user ? await loadPreserved(user.id) : new Map<string, PreservedTask>();
      const previewTasks = mergePreservedTasks(plan.tasks, preserved).map((t, idx) => ({
        ...t,
        id: `scenario-${idx}`,
      }));
      return Response.json({
        ok: true,
        data: {
          kind: "plan",
          plan: { ...plan, id: `scenario-preview-${Date.now()}`, tasks: previewTasks },
          assumedIntake,
          scenario: true,
        },
      });
    }

    if (!user) {
      // Guest: return the plan; the client persists it locally. Guests never
      // enter the confirmation branch — their edits live in one local plan.
      return Response.json({
        ok: true,
        data: { kind: "plan", plan: { ...plan, id: `guest-${Date.now()}` }, assumedIntake },
      });
    }

    const activeGoal = await db.goal.findFirst({
      where: { userId: user.id, status: "active" },
      include: { plans: { where: { isActive: true }, include: { tasks: true }, take: 1 } },
    });
    const preserved = await loadPreserved(user.id);
    const requiresConfirm =
      activeGoal && activeGoal.plans[0] && activeGoal.plans[0].tasks.some((t) => t.userEdited);

    if (requiresConfirm && !confirmReplace) {
      // Persist the EXACT proposal the student will review.
      const previewTasks = mergePreservedTasks(plan.tasks, preserved).map((t, idx) => ({
        ...t,
        id: `preview-${idx}`,
      }));
      const doc: PlanPreviewDoc = {
        preview: { ...plan, id: "preview", tasks: previewTasks },
        assumedIntake,
      };
      const proposalHash = createHash("sha256")
        .update(canonicalPreviewJson(doc))
        .digest("hex")
        .slice(0, 32);
      // Keep at most the latest 5 pending previews per user.
      const stale = await db.planPreview.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        skip: 4,
        select: { id: true },
      });
      if (stale.length > 0) {
        await db.planPreview.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
      }
      const row = await db.planPreview.create({
        data: {
          userId: user.id,
          goalSlug: slug,
          proposalHash,
          previewJson: JSON.stringify(doc),
          assumedIntake,
          preservedCompleted: preservedCounts(preserved).completed,
          preservedEdited: preservedCounts(preserved).edited,
          expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
        },
      });
      const payload = {
        kind: "confirmation" as const,
        previewToken: row.id,
        proposalHash,
        preview: doc.preview,
        assumedIntake,
        preserved: preservedCounts(preserved),
      };
      // Boundary guarantee: what we send must parse as the public contract.
      const selfCheck = parsePlanGenerateOk(payload);
      if (!selfCheck) return serverError();
      return Response.json({ ok: true, data: payload }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // No edited tasks (or guest-equivalent path): apply the fresh proposal now.
    const appliedTasks = mergePreservedTasks(plan.tasks, preserved);
    const savedPlan = await applyPlan(user.id, slug, profile, appliedTasks, {
      horizonMonths: plan.horizonMonths,
      engineVersion: plan.engineVersion,
      infeasible: plan.infeasible,
      feasibilityNote: plan.feasibilityNote,
      goalSlug: plan.goalSlug,
      goalTitle: plan.goalTitle,
    });
    return Response.json(
      { ok: true, data: { kind: "plan", plan: savedPlan, assumedIntake } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return serverError();
  }
}

/** Completed or user-edited tasks of the current active plan, by stable key. */
async function loadPreserved(userId: string): Promise<Map<string, PreservedTask>> {
  const preserved = new Map<string, PreservedTask>();
  const activeGoal = await db.goal.findFirst({
    where: { userId, status: "active" },
    include: { plans: { where: { isActive: true }, include: { tasks: true }, take: 1 } },
  });
  if (activeGoal?.plans[0]) {
    for (const t of activeGoal.plans[0].tasks) {
      if (t.status === "done" || t.userEdited) {
        preserved.set(t.stableKey, {
          status: t.status as PreservedTask["status"],
          notes: t.notes,
          userEdited: t.userEdited,
          completedAt: t.completedAt,
        });
      }
    }
  }
  return preserved;
}

/** Archive prior goals/plans and write the (reviewed) tasks transactionally. */
async function applyPlan(
  userId: string,
  slug: string,
  profile: ProfileData,
  tasks: PlanTask[],
  meta: {
    horizonMonths: number;
    engineVersion: string;
    infeasible: boolean;
    feasibilityNote?: string;
    goalSlug?: string;
    goalTitle?: string;
  },
): Promise<PlanData> {
  const result = await db.$transaction(async (tx) => {
    await tx.goal.updateMany({
      where: { userId, status: "active" },
      data: { status: "archived" },
    });
    await tx.plan.updateMany({
      where: { goal: { userId }, isActive: true },
      data: { isActive: false },
    });
    const goal = await tx.goal.create({
      data: {
        userId,
        opportunitySlug: slug,
        degreeLevel: profile.degreeLevel,
        targetIntake: profile.targetIntakeYear ? String(profile.targetIntakeYear) : null,
        status: "active",
      },
    });
    const created = await tx.plan.create({
      data: {
        goalId: goal.id,
        horizonMonths: meta.horizonMonths,
        engineVersion: meta.engineVersion,
        infeasible: meta.infeasible,
        feasibilityNote: meta.feasibilityNote ?? null,
        isActive: true,
      },
    });
    await tx.goal.update({ where: { id: goal.id }, data: { activePlanId: created.id } });
    const savedTaskIds: string[] = [];
    for (const task of tasks) {
      const createdTask = await tx.task.create({
        data: {
          planId: created.id,
          stableKey: task.stableKey,
          title: task.title,
          titleBn: task.titleBn ?? null,
          purpose: task.purpose,
          purposeBn: task.purposeBn ?? null,
          category: task.category,
          effortHours: task.effortHours,
          dueDate: task.dueDate ?? null,
          dateBasis: task.dateBasis,
          status: task.status,
          completedAt: task.completedAt ? new Date(task.completedAt) : (task.status === "done" ? new Date() : null),
          notes: task.notes ?? null,
          userEdited: task.userEdited,
          order: task.order,
        },
      });
      savedTaskIds.push(createdTask.id);
    }
    return { planId: created.id, taskIds: savedTaskIds };
  });

  return {
    id: result.planId,
    goalSlug: meta.goalSlug ?? slug,
    goalTitle: meta.goalTitle,
    horizonMonths: meta.horizonMonths,
    generatedAt: new Date().toISOString(),
    engineVersion: meta.engineVersion,
    infeasible: meta.infeasible,
    feasibilityNote: meta.feasibilityNote,
    tasks: tasks.map((t, idx) => ({
      ...t,
      id: result.taskIds[idx] ?? t.id,
    })),
  };
}
