import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { dataRoute } from "@/lib/validation";
import type { PlanData, ProfileData, PlanTask } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Hydrate the client store for a signed-in user. Guests get empty state. */
export async function GET() {
  return dataRoute(async () => {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ ok: true, data: { user: null } }, { headers: { "Cache-Control": "no-store" } });
  }

  const [profileRow, goalRow, shortlistRows, applicationRows] = await Promise.all([
    db.profile.findUnique({ where: { userId: user.id } }),
    db.goal.findFirst({ where: { userId: user.id, status: "active" }, include: { plans: { where: { isActive: true }, include: { tasks: true }, orderBy: { generatedAt: "desc" }, take: 1 } } }),
    db.shortlistItem.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    db.application.findMany({ where: { userId: user.id }, include: { events: { orderBy: { createdAt: "desc" } } }, orderBy: { updatedAt: "desc" } }),
  ]);

  let plan: PlanData | null = null;
  if (goalRow && goalRow.plans.length > 0) {
    const active = goalRow.plans[0];
    const tasks: PlanTask[] = active.tasks
      .map((t) => ({
        id: t.id,
        stableKey: t.stableKey,
        title: t.title,
        titleBn: t.titleBn ?? undefined,
        purpose: t.purpose,
        purposeBn: t.purposeBn ?? undefined,
        category: t.category as PlanTask["category"],
        effortHours: t.effortHours,
        dueDate: t.dueDate ?? undefined,
        dateBasis: t.dateBasis as PlanTask["dateBasis"],
        status: t.status as PlanTask["status"],
        completedAt: t.completedAt?.toISOString() ?? undefined,
        notes: t.notes ?? undefined,
        userEdited: t.userEdited,
        order: t.order,
      }))
      .sort((a, b) => a.order - b.order);
    const goalOpportunity = await db.opportunity.findUnique({
      where: { slug: goalRow.opportunitySlug },
      select: { title: true },
    });
    plan = {
      id: active.id,
      goalSlug: goalRow.opportunitySlug,
      goalTitle: goalOpportunity?.title,
      horizonMonths: active.horizonMonths,
      generatedAt: active.generatedAt.toISOString(),
      engineVersion: active.engineVersion,
      infeasible: active.infeasible,
      feasibilityNote: active.feasibilityNote ?? undefined,
      tasks,
    };
  }

  const profile: ProfileData | null = profileRow ? JSON.parse(profileRow.data) : null;

  return Response.json({
    ok: true,
    data: {
      user: { id: user.id, email: user.email, name: user.displayName ?? undefined, role: user.role },
      profile,
      plan,
      goalSlug: goalRow?.opportunitySlug ?? null,
      shortlist: shortlistRows.map((s) => s.opportunitySlug),
      applications: applicationRows.map((a) => ({
        id: a.id,
        opportunitySlug: a.opportunitySlug,
        opportunityTitle: a.opportunityTitle,
        status: a.status,
        intendedIntake: a.intendedIntake ?? undefined,
        notes: a.notes ?? undefined,
        events: a.events.map((e) => ({ id: e.id, type: e.type, note: e.note ?? undefined, createdAt: e.createdAt.toISOString() })),
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
    },
  }, { headers: { "Cache-Control": "no-store" } });
  });
}
