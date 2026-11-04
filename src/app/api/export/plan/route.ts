import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { dataRoute, unauthorized } from "@/lib/validation";

/** Readable plan export (markdown) for printing or sharing with family. */
export async function GET() {
  return dataRoute(async () => {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const goal = await db.goal.findFirst({
    where: { userId: user.id, status: "active" },
    include: { plans: { where: { isActive: true }, include: { tasks: true }, take: 1 } },
  });
  if (!goal || !goal.plans[0]) {
    return new Response("# Uraan plan export\n\nNo active plan yet.\n", {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  const plan = goal.plans[0];
  const opportunity = await db.opportunity.findUnique({ where: { slug: goal.opportunitySlug } });
  const lines: string[] = [
    `# Uraan preparation plan`,
    ``,
    `**Target:** ${opportunity?.title ?? goal.opportunitySlug}`,
    `**Destination:** ${opportunity?.countryLabel ?? "—"}`,
    `**Horizon:** ${plan.horizonMonths} months · Generated ${plan.generatedAt.toISOString().slice(0, 10)} · Engine ${plan.engineVersion}`,
    ``,
  ];
  if (plan.infeasible && plan.feasibilityNote) {
    lines.push(`> ⚠️ ${plan.feasibilityNote}`, ``);
  }
  lines.push(`## Tasks`, ``);
  const tasks = [...plan.tasks].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  for (const task of tasks) {
    const status = task.status === "done" ? "x" : task.status === "skipped" ? "-" : " ";
    const due = task.dueDate ? ` — due ${task.dueDate} (${task.dateBasis === "official" ? "official date" : "suggested date"})` : "";
    lines.push(`- [${status}] ${task.title}${due}`);
    lines.push(`    ${task.purpose}`);
    if (task.notes) lines.push(`    Note: ${task.notes}`);
  }
  lines.push(
    ``,
    `---`,
    `Dates marked *suggested* are planning aids. Official dates come only from official sources — verify each on the programme page before relying on it.`,
    `Meeting every task does not guarantee admission or funding; final decisions belong to institutions.`,
  );

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="uraan-plan.md"',
      "Cache-Control": "no-store",
    },
  });
  });
}
