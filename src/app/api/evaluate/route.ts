import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { getOpportunity } from "@/lib/catalogue/queries";
import { evaluateOpportunity } from "@/lib/matching/engine";
import { evaluateSchema, badRequest, notFound } from "@/lib/validation";
import type { ProfileData } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Deterministic requirement evaluation. Works for guests (profile in the
 * request body) and signed-in users (profile from the database).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = evaluateSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");
    const { slug } = parsed.data;

    const opportunity = await getOpportunity(slug);
    if (!opportunity) return notFound();

    let profile: ProfileData | null = null;
    const user = await getCurrentUser();
    if (user) {
      const row = await db.profile.findUnique({ where: { userId: user.id } });
      profile = row ? (JSON.parse(row.data) as ProfileData) : null;
    }
    if (!profile && parsed.data.profile) profile = parsed.data.profile;
    if (!profile) {
      return Response.json({ ok: false, error: "needs_profile" }, { status: 422 });
    }

    const evaluation = evaluateOpportunity(opportunity.requirements, profile, slug);
    return Response.json({ ok: true, data: { evaluation } });
  } catch {
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
