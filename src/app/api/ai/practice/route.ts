import { getCurrentUser } from "@/lib/identity/auth";
import { practiceFeedback, templatePracticeFeedback } from "@/lib/ai/features";
import { aiPracticeSchema, badRequest } from "@/lib/validation";

/** Practice feedback — an honest estimate, never an official band score. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = aiPracticeSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");
    const user = await getCurrentUser();

    const result = await practiceFeedback({
      text: parsed.data.text,
      prompt: "Describe a problem in your community and one realistic step to improve it. (120–180 words)",
      lang: parsed.data.lang,
      userId: user?.id,
    });
    if (result.ok) {
      return Response.json({ ok: true, data: { feedback: result.feedback } });
    }
    if (result.error === "quota") {
      return Response.json({ ok: false, error: "quota" }, { status: 429 });
    }
    return Response.json({
      ok: true,
      data: { feedback: templatePracticeFeedback(parsed.data.text) },
    });
  } catch {
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
