import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { unauthorized, serverError } from "@/lib/validation";
import { z } from "zod";

const toggleSchema = z.object({ slug: z.string().min(1).max(120) });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const rows = await db.shortlistItem.findMany({ where: { userId: user.id } });
  return Response.json({ ok: true, data: { shortlist: rows.map((r) => r.opportunitySlug) } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const parsed = toggleSchema.safeParse(body);
    if (!parsed.success) return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
    const existing = await db.shortlistItem.findUnique({
      where: { userId_opportunitySlug: { userId: user.id, opportunitySlug: parsed.data.slug } },
    });
    if (existing) {
      await db.shortlistItem.delete({ where: { id: existing.id } });
      return Response.json({ ok: true, data: { shortlisted: false } });
    }
    await db.shortlistItem.create({ data: { userId: user.id, opportunitySlug: parsed.data.slug } });
    return Response.json({ ok: true, data: { shortlisted: true } });
  } catch {
    return serverError();
  }
}
