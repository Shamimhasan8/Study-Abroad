import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { buildICS, type IcsEvent } from "@/lib/dates";
import { dataRoute, unauthorized } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Calendar export (.ics) — all-day events only. Date-only precision is
 * preserved; no time or timezone is ever invented.
 */
export async function GET() {
  return dataRoute(async () => {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const goal = await db.goal.findFirst({
    where: { userId: user.id, status: "active" },
    include: { plans: { where: { isActive: true }, include: { tasks: true }, take: 1 } },
  });
  const applications = await db.application.findMany({
    where: { userId: user.id },
    include: { events: { orderBy: { createdAt: "desc" } } },
  });

  const events: IcsEvent[] = [];

  // Official deadline events from the opportunity catalogue.
  if (goal) {
    const opportunity = await db.opportunity.findUnique({ where: { slug: goal.opportunitySlug } });
    if (opportunity) {
      const deadlines = JSON.parse(opportunity.deadlinesJson) as { id: string; type: string; closeDate?: string; official: boolean; note?: string }[];
      for (const d of deadlines) {
        if (!d.closeDate || !d.official) continue;
        events.push({
          uid: `official-${d.id}`,
          date: d.closeDate,
          summary: `[Official deadline] ${opportunity.title} (${d.type})`,
          description: d.note ?? "From the official source record. Verify on the official page.",
        });
      }
    }
    const plan = goal.plans[0];
    if (plan) {
      for (const task of plan.tasks) {
        if (!task.dueDate || task.status === "done" || task.status === "skipped") continue;
        events.push({
          uid: `task-${task.id}`,
          date: task.dueDate,
          summary: `[Prep ${task.dateBasis === "official" ? "official" : "suggested"}] ${task.title}`,
          description: task.purpose.slice(0, 400),
        });
      }
    }
  }

  // Application milestones — mirrors the in-app calendar: only submitted /
  // awaiting applications appear, dated by the recorded 'submitted' event
  // (newest first) with updatedAt as fallback, so the export and the app
  // never show the same logical milestone on different days.
  for (const app of applications) {
    if (app.status !== "submitted" && app.status !== "awaiting") continue;
    const submittedEvent = app.events.find((e) => e.type === "submitted");
    events.push({
      uid: `app-${app.id}`,
      date: (submittedEvent?.createdAt ?? app.updatedAt).toISOString().slice(0, 10),
      summary: `[Application] ${app.opportunityTitle} — ${app.status}`,
      description: "Self-reported application record.",
    });
  }

  const ics = buildICS(events, "Uraan — preparation calendar");
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="uraan-calendar.ics"',
      "Cache-Control": "no-store",
    },
  });
  });
}
