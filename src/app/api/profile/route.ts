import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { profileSchema, badRequest, unauthorized, serverError } from "@/lib/validation";

/** Save the onboarding profile (authenticated users). */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_profile");

    const data = JSON.stringify(parsed.data);
    await db.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, data },
      update: { data },
    });
    return Response.json({ ok: true, data: { saved: true } });
  } catch {
    return serverError();
  }
}
