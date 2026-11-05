import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { mergeGuestSchema, badRequest, unauthorized, serverError } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * One-time guest → account migration with real idempotency.
 *
 * - The client sends an `importId` (idempotency key) with the snapshot.
 *   Retrying the SAME import returns the original receipt without
 *   creating or archiving anything again.
 * - If the account already holds an active plan that this import did not
 *   create, the route answers 409 with a conflict preview (existing vs
 *   incoming summary). Nothing is overwritten until the client retries
 *   with `confirmReplace: true` after the user accepted the preview.
 * - The whole move runs in one transaction; the GuestImport row with its
 *   receipt is committed together with the data it describes.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const parsed = mergeGuestSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_payload");
    const { profile, plan, shortlist, goalSlug, applications, importId, confirmReplace } = parsed.data;

    // Idempotent replay: same user + same import key → same receipt.
    const prior = await db.guestImport.findUnique({
      where: { userId_importKey: { userId: user.id, importKey: importId } },
    });
    if (prior?.status === "completed") {
      return Response.json(
        {
          ok: true,
          data: { ...(prior.receiptJson ? JSON.parse(prior.receiptJson) : { merged: true, importId }), importId, idempotentReplay: true },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // Conflict: an active plan exists on the account that this import is
    // not replaying. Offer a preview instead of silently replacing it.
    const existingGoal = await db.goal.findFirst({
      where: { userId: user.id, status: "active" },
      include: { plans: { where: { isActive: true }, include: { tasks: true }, take: 1 } },
    });
    if (existingGoal && existingGoal.plans[0] && plan && !confirmReplace) {
      const existingTasks = existingGoal.plans[0].tasks;
      return Response.json(
        {
          ok: false,
          error: "conflict",
          data: {
            existing: {
              goalSlug: existingGoal.opportunitySlug,
              horizonMonths: existingGoal.plans[0].horizonMonths,
              generatedAt: existingGoal.plans[0].generatedAt.toISOString(),
              taskCount: existingTasks.length,
              completed: existingTasks.filter((t) => t.status === "done").length,
            },
            incoming: {
              goalSlug: goalSlug ?? plan.goalSlug ?? null,
              horizonMonths: plan.horizonMonths,
              taskCount: plan.tasks.length,
              completed: plan.tasks.filter((t) => t.status === "done").length,
            },
          },
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    let receipt: object;
    try {
      receipt = await db.$transaction(async (tx) => {
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

        let importedTasks = 0;
        let importedCompleted = 0;
        if (plan && (goalSlug || plan.goalSlug)) {
          const slug = goalSlug ?? plan.goalSlug!;
          // Replacing an existing plan (user accepted the 409 preview).
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
              engineVersion: "guest-merge-1.1",
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
            importedTasks += 1;
            if (task.status === "done") importedCompleted += 1;
          }
        }

        const result = {
          merged: true,
          importId,
          counts: {
            tasks: importedTasks,
            completedTasks: importedCompleted,
            shortlist: shortlist?.length ?? 0,
            applications: applications?.length ?? 0,
          },
        };

        // Commit the import record together with the data it describes.
        // A concurrent duplicate key rolls this whole transaction back.
        await tx.guestImport.create({
          data: {
            userId: user.id,
            importKey: importId,
            status: "completed",
            receiptJson: JSON.stringify(result),
            completedAt: new Date(),
          },
        });
        return result;
      });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "P2002") {
        // A concurrent request with the same import key finished first —
        // return its receipt (exactly-once semantics).
        const winner = await db.guestImport.findUnique({
          where: { userId_importKey: { userId: user.id, importKey: importId } },
        });
        if (winner?.status === "completed") {
          return Response.json(
            { ok: true, data: { ...(winner.receiptJson ? JSON.parse(winner.receiptJson) : { merged: true, importId }), importId, idempotentReplay: true } },
            { headers: { "Cache-Control": "no-store" } },
          );
        }
      }
      throw err;
    }

    return Response.json({ ok: true, data: receipt }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return serverError();
  }
}
