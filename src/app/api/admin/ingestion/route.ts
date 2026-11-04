import { requireAdmin } from "@/lib/identity/auth";
import { runIngestion } from "@/lib/ingestion/runner";
import { unauthorized, serverError } from "@/lib/validation";
import { db } from "@/lib/db";

/** Manual ingestion trigger (admin). Deployment schedulers can call it too. */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();
  try {
    const url = new URL(request.url);
    const volatility = url.searchParams.get("volatility") ?? undefined;
    const result = await runIngestion({ volatility: volatility ?? undefined });
    await db.auditEvent.create({
      data: {
        actorId: admin.id,
        action: "ingestion_run",
        targetType: "ingestion",
        detailJson: JSON.stringify({
          sources: result.outcomes.length,
          failed: result.outcomes.filter((o) => o.status === "failed").length,
        }),
      },
    });
    return Response.json({ ok: true, data: result });
  } catch {
    return serverError();
  }
}
