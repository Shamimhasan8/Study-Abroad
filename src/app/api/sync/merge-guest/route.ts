import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { mergeGuestSchema, badRequest, unauthorized, serverError } from "@/lib/validation";

/**
 * One-time guest → account migration.
 * Runs inside a transaction so the move either fully happens or not at all;
 * idempotent shortlist/application upserts prevent duplicates.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const parsed = mergeGuestSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_payload");
    const { profile, plan, shortlist, goalSlug, applications } = parsed.data;

    await db.$transaction(async (tx) => {
      if (profile) {
        await tx.profile.upsert({
          where: { userId: user.id },
          create: { userId: user.id, data: JSON.stringify(profile) },
          update: { data: JSON.stringify(profile) },
        });
      }

      for (const slug of shortlist ?? []) {
        await tx.shortlistItem.upsert({
          where: { userId_opportunitySlug: { userId: user.id, opportunitySlug: slug } },
          create: { userId: user.id, opportunitySlug: slug },
          update: {},
        });
      }

      for (const app of applications ?? []) {
        const existing = await tx.application.findFirst({
          where: { userId: user.id, opportunitySlug: app.opportunitySlug },
        });
        if (existing) {
          await tx.application.update({
            where: { id: existing.id },
            data: {
              status: app.status,
              intendedIntake: app.intendedIntake ?? existing.intendedIntake,
              notes: app.notes ?? existing.notes,
            },
          });
        } else {
          await tx.application.create({
            data: {
              userId: user.id,
              opportunitySlug: app.opportunitySlug,
              opportunityTitle: app.opportunityTitle,
              status: app.status,
              intendedIntake: app.intendedIntake ?? null,
              notes: app.notes ?? null,
            },
          });
        }
      }

      if (plan && (goalSlug || plan.goalSlug)) {
        const slug = goalSlug ?? plan.goalSlug!;
        // Archive any prior active goal/plan so the merge never duplicates.
        await tx.goal.updateMany({
          where: { userId: user.id, status: "active" },
          data: { status: "archived" },
        });
        const goal = await tx.goal.create({
          data: {
            userId: user.id,
            opportunitySlug: slug,
            degreeLevel: profile?.degreeLevel ?? "undecided",
            targetIntake: profile?.targetIntakeYear ? String(profile.targetIntakeYear) : null,
            status: "active",
          },
        });
        const created = await tx.plan.create({
          data: {
            goalId: goal.id,
            horizonMonths: plan.horizonMonths,
            engineVersion: "guest-merge-1.0",
            infeasible: plan.infeasible,
            feasibilityNote: plan.feasibilityNote ?? null,
            isActive: true,
          },
        });
        await tx.goal.update({ where: { id: goal.id }, data: { activePlanId: created.id } });
        for (const task of plan.tasks) {
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
              status: task.status,
              completedAt: task.status === "done" ? new Date() : null,
              notes: task.notes ?? null,
              userEdited: task.userEdited,
              order: task.order,
            },
          });
        }
      }
    });

    return Response.json({ ok: true, data: { merged: true } });
  } catch {
    return serverError();
  }
}
