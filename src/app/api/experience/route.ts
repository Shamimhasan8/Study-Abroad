import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { experienceSchema, badRequest, unauthorized, notFound, serverError } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const rows = await db.experienceEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return Response.json({
    ok: true,
    data: {
      experiences: rows.map((e) => ({
        id: e.id,
        kind: e.kind,
        title: e.title,
        description: e.description,
        reflection: e.reflection ?? undefined,
        startDate: e.startDate ?? undefined,
        endDate: e.endDate ?? undefined,
        links: e.linksJson ? JSON.parse(e.linksJson) : [],
        createdAt: e.createdAt.toISOString(),
      })),
    },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const parsed = experienceSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");
    const entry = parsed.data;
    if (entry.id) {
      const existing = await db.experienceEntry.findUnique({ where: { id: entry.id } });
      if (!existing || existing.userId !== user.id) return notFound();
      const updated = await db.experienceEntry.update({
        where: { id: entry.id },
        data: {
          kind: entry.kind,
          title: entry.title,
          description: entry.description,
          reflection: entry.reflection ?? null,
          startDate: entry.startDate ?? null,
          endDate: entry.endDate ?? null,
          linksJson: JSON.stringify(entry.links),
        },
      });
      return Response.json({ ok: true, data: { id: updated.id } });
    }
    const created = await db.experienceEntry.create({
      data: {
        userId: user.id,
        kind: entry.kind,
        title: entry.title,
        description: entry.description,
        reflection: entry.reflection ?? null,
        startDate: entry.startDate ?? null,
        endDate: entry.endDate ?? null,
        linksJson: JSON.stringify(entry.links),
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
  const existing = await db.experienceEntry.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return notFound();
  await db.experienceEntry.delete({ where: { id } });
  return Response.json({ ok: true, data: { deleted: true } });
}
