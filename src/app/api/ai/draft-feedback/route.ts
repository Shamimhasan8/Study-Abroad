import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { draftFeedback } from "@/lib/ai/features";
import { aiDraftFeedbackSchema, badRequest, notFound, unauthorized } from "@/lib/validation";
import type { ProfileData } from "@/lib/types";

/**
 * Draft feedback on the student's own writing. Respects the target's
 * AI-use policy: when a draft is marked 'prohibited', feedback is
 * disabled for that draft instead of silently continuing.
 */
function clientIp(request: Request): string | undefined {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 60) || undefined;
  return undefined;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const parsed = aiDraftFeedbackSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");
    const { draftId, lang } = parsed.data;

    const draft = await db.writingDraft.findUnique({ where: { id: draftId } });
    if (!draft || draft.userId !== user.id) return notFound();
    if (!draft.currentContent.trim()) return badRequest("empty_draft");
    if (draft.aiPolicy === "prohibited") {
      return Response.json({ ok: false, error: "ai_policy_prohibited" }, { status: 451 });
    }

    const profileRow = await db.profile.findUnique({ where: { userId: user.id } });
    const profile = profileRow ? (JSON.parse(profileRow.data) as ProfileData) : null;
    const profileFacts = profile
      ? [
          `degree level: ${profile.degreeLevel}`,
          profile.qualifications.length
            ? `qualifications: ${profile.qualifications.map((q) => `${q.level} at ${q.institution} (${q.grades || "grades not stated"})`).join("; ")}`
            : "qualifications: none recorded",
          profile.tests.length
            ? `official tests: ${profile.tests.map((t) => `${t.testType} ${t.score}`).join("; ")}`
            : "official tests: none",
          profile.fieldInterests.length ? `interests: ${profile.fieldInterests.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join(". ")
      : "profile facts: none recorded";

    const result = await draftFeedback({
      kind: draft.kind as "essay" | "sop" | "research",
      prompt: draft.institutionPrompt ?? "",
      wordLimit: draft.wordLimit ?? undefined,
      draft: draft.currentContent,
      profileFacts,
      lang,
      userId: user.id,
      ip: clientIp(request),
    });

    if (result.ok) return Response.json({ ok: true, data: { feedback: result.feedback } });
    if (result.error === "quota") return Response.json({ ok: false, error: "quota" }, { status: 429 });
    return Response.json({ ok: false, error: "ai_unavailable" }, { status: 503 });
  } catch {
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
