import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { taskPatchSchema, badRequest, unauthorized, notFound, serverError } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Task completion and notes — server-side ownership check included. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const parsed = taskPatchSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");
    const { taskId, status, notes, userEdited } = parsed.data;

    const task = await db.task.findUnique({
      where: { id: taskId },
      include: { plan: { include: { goal: true } } },
    });
    if (!task || task.plan.goal.userId !== user.id) return notFound();

    const updated = await db.task.update({
      where: { id: taskId },
      data: {
        status: status ?? task.status,
        notes: notes ?? task.notes,
        userEdited: userEdited ?? task.userEdited,
        completedAt: status === "done" ? new Date() : status ? null : task.completedAt,
      },
    });

    return Response.json({
      ok: true,
      data: {
        task: {
          id: updated.id,
          status: updated.status,
          notes: updated.notes ?? undefined,
          completedAt: updated.completedAt?.toISOString() ?? undefined,
        },
      },
    });
  } catch {
    return serverError();
  }
}
