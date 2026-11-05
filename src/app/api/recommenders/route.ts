import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { recommenderSchema, badRequest, unauthorized, notFound, serverError } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const rows = await db.recommenderRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return Response.json({
    ok: true,
    data: {
      recommenders: rows.map((r) => ({
        id: r.id,
        name: r.name,
        role: r.role ?? undefined,
        relationship: r.relationship ?? undefined,
        status: r.status,
        requestDraft: r.requestDraft ?? undefined,
        createdAt: r.createdAt.toISOString(),
      })),
    },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const parsed = recommenderSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");
    const rec = parsed.data;
    if (rec.id) {
      const existing = await db.recommenderRequest.findUnique({ where: { id: rec.id } });
      if (!existing || existing.userId !== user.id) return notFound();
      const updated = await db.recommenderRequest.update({
        where: { id: rec.id },
        data: {
          name: rec.name,
          role: rec.role ?? null,
          relationship: rec.relationship ?? null,
          status: rec.status,
          requestDraft: rec.requestDraft ?? null,
        },
      });
      return Response.json({ ok: true, data: { id: updated.id } });
    }
    const created = await db.recommenderRequest.create({
      data: {
        userId: user.id,
        name: rec.name,
        role: rec.role ?? null,
        relationship: rec.relationship ?? null,
        status: rec.status,
        requestDraft: rec.requestDraft ?? null,
      },
    });
    return Response.json({ ok: true, data: { id: created.id } });
  } catch {
    return serverError();
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return badRequest("missing_id");
  const existing = await db.recommenderRequest.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return notFound();
  await db.recommenderRequest.delete({ where: { id } });
  return Response.json({ ok: true, data: { deleted: true } });
}
