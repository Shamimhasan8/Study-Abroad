import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { getOpportunity } from "@/lib/catalogue/queries";
import { evaluateOpportunity } from "@/lib/matching/engine";
import { explainEvaluation, templateExplanation } from "@/lib/ai/features";
import { aiExplainSchema, badRequest, notFound } from "@/lib/validation";
import type { ProfileData } from "@/lib/types";

/**
 * Evidence-bound plan/gap explanation. The AI explains deterministic
 * results and never overrides them. Falls back to a labelled template.
 */
function clientIp(request: Request): string | undefined {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 60) || undefined;
  return undefined;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = aiExplainSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");
    const { slug, lang } = parsed.data;

    const opportunity = await getOpportunity(slug);
    if (!opportunity) return notFound();

    let profile: ProfileData | null = null;
    const user = await getCurrentUser();
    if (user) {
      const row = await db.profile.findUnique({ where: { userId: user.id } });
      profile = row ? (JSON.parse(row.data) as ProfileData) : null;
    }
    if (!profile && parsed.data.profile) profile = parsed.data.profile;
    if (!profile) return Response.json({ ok: false, error: "needs_profile" }, { status: 422 });

    const evaluation = evaluateOpportunity(opportunity.requirements, profile, slug);
    const result = await explainEvaluation({
      profile,
      evaluation,
      opportunity,
      lang,
      userId: user?.id,
      ip: clientIp(request),
    });

    if (result.ok) {
      return Response.json({ ok: true, data: { explanation: result.explanation, aiGenerated: true } });
    }
    if (result.error === "quota") {
      return Response.json({ ok: false, error: "quota" }, { status: 429 });
    }
    // Graceful, labelled fallback — never presented as live AI.
    return Response.json({
      ok: true,
      data: { explanation: templateExplanation(evaluation, lang), aiGenerated: false },
    });
  } catch {
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
