import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { getOpportunity } from "@/lib/catalogue/queries";
import { evaluateOpportunity } from "@/lib/matching/engine";
import { generatePlan } from "@/lib/planning/engine";
import { planGenerateSchema, badRequest, notFound, serverError } from "@/lib/validation";
import type { PlanData, PlanTask, ProfileData } from "@/lib/types";

/**
 * Plan generation. Guests receive the generated plan for local persistence;
 * signed-in users get it saved server-side. Regeneration preserves
 * completed tasks and manual edits via stable keys.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = planGenerateSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");
    const { slug, profile: guestProfile, confirmReplace } = parsed.data;

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

    const evaluation = evaluateOpportunity(opportunity.requirements, profile, slug);
    const { plan, assumedIntake } = generatePlan(profile, opportunity, evaluation);

    if (!user) {
      // Guest: return the plan; the client persists it locally.
      return Response.json({ ok: true, data: { plan: { ...plan, id: `guest-${Date.now()}` }, assumedIntake } });
    }

    // Signed-in: regenerate-with-preservation under a transaction.
    const activeGoal = await db.goal.findFirst({
      where: { userId: user.id, status: "active" },
      include: { plans: { where: { isActive: true }, include: { tasks: true }, take: 1 } },
    });

    // Preserve completed/edited tasks by stable key.
    const preserved = new Map<string, { status: string; notes: string | null; userEdited: boolean; completedAt: Date | null }>();
    if (activeGoal?.plans[0]) {
      for (const t of activeGoal.plans[0].tasks) {
        if (t.status === "done" || t.userEdited) {
          preserved.set(t.stableKey, { status: t.status, notes: t.notes, userEdited: t.userEdited, completedAt: t.completedAt });
        }
      }
    }

    const requiresConfirm = activeGoal && activeGoal.plans[0] && activeGoal.plans[0].tasks.some((t) => t.userEdited);
    if (requiresConfirm && !confirmReplace) {
      const previewTasks: PlanTask[] = plan.tasks.map((t, idx) => {
        const prev = preserved.get(t.stableKey);
        return {
          ...t,
          id: `preview-${idx}`,
          status: (prev?.status as PlanTask["status"]) ?? t.status,
          notes: prev?.notes ?? undefined,
          userEdited: prev?.userEdited ?? false,
        };
      });
      return Response.json({
        ok: true,
        data: {
          requiresConfirmation: true,
          preview: { ...plan, id: "preview", tasks: previewTasks },
        },
      });
    }

    const result = await db.$transaction(async (tx) => {
      await tx.goal.updateMany({
        where: { userId: user.id, status: "active" },
        data: { status: "archived" },
      });
      await tx.plan.updateMany({
        where: { goal: { userId: user.id }, isActive: true },
        data: { isActive: false },
      });
      const goal = await tx.goal.create({
        data: {
          userId: user.id,
          opportunitySlug: slug,
          degreeLevel: profile!.degreeLevel,
          targetIntake: profile!.targetIntakeYear ? String(profile!.targetIntakeYear) : null,
          status: "active",
        },
      });
      const created = await tx.plan.create({
        data: {
          goalId: goal.id,
          horizonMonths: plan.horizonMonths,
          engineVersion: plan.engineVersion,
          infeasible: plan.infeasible,
          feasibilityNote: plan.feasibilityNote ?? null,
          isActive: true,
        },
      });
      await tx.goal.update({ where: { id: goal.id }, data: { activePlanId: created.id } });
      for (const task of plan.tasks) {
        const prev = preserved.get(task.stableKey);
        await tx.task.create({
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
            status: prev?.status ?? task.status,
            completedAt: prev?.completedAt ?? null,
            notes: prev?.notes ?? null,
            userEdited: prev?.userEdited ?? false,
            order: task.order,
          },
        });
      }
      return created;
    });

    const savedPlan: PlanData = {
      ...plan,
      id: result.id,
      tasks: plan.tasks.map((t, idx) => {
        const prev = preserved.get(t.stableKey);
        return {
          ...t,
          id: `${result.id}-${idx}`,
          status: (prev?.status as PlanTask["status"]) ?? t.status,
          notes: prev?.notes ?? undefined,
          userEdited: prev?.userEdited ?? false,
        };
      }),
    };

    return Response.json({ ok: true, data: { plan: savedPlan, assumedIntake } });
  } catch {
    return serverError();
  }
}
