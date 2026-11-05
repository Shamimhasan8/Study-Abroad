import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { applicationSchema, applicationPatchSchema, badRequest, unauthorized, notFound, serverError } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const rows = await db.application.findMany({
    where: { userId: user.id },
    include: { events: { orderBy: { createdAt: "desc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return Response.json({
    ok: true,
    data: {
      applications: rows.map((a) => ({
        id: a.id,
        opportunitySlug: a.opportunitySlug,
        opportunityTitle: a.opportunityTitle,
        status: a.status,
        intendedIntake: a.intendedIntake ?? undefined,
        notes: a.notes ?? undefined,
        events: a.events.map((e) => ({ id: e.id, type: e.type, note: e.note ?? undefined, createdAt: e.createdAt.toISOString() })),
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
    },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const parsed = applicationSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");
    const app = parsed.data;
    const existing = await db.application.findFirst({
      where: { userId: user.id, opportunitySlug: app.opportunitySlug },
    });
    if (existing) return badRequest("already_tracked");
    const created = await db.application.create({
      data: {
        userId: user.id,
        opportunitySlug: app.opportunitySlug,
        opportunityTitle: app.opportunityTitle,
        status: app.status,
        intendedIntake: app.intendedIntake ?? null,
        notes: app.notes ?? null,
        events: { create: { type: "created", note: app.status } },
      },
      include: { events: true },
    });
    return Response.json({ ok: true, data: { application: created } });
  } catch {
    return serverError();
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const parsed = applicationPatchSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");
    const { id, ...patch } = parsed.data;
    const existing = await db.application.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) return notFound();
    const updated = await db.application.update({
      where: { id },
      data: {
        status: patch.status ?? existing.status,
        notes: patch.notes ?? existing.notes,
        intendedIntake: patch.intendedIntake ?? existing.intendedIntake,
        events:
          patch.status && patch.status !== existing.status
            ? { create: { type: "status_changed", note: `${existing.status} → ${patch.status}` } }
            : undefined,
      },
      include: { events: { orderBy: { createdAt: "desc" } } },
    });
    return Response.json({ ok: true, data: { application: updated } });
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
  const existing = await db.application.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return notFound();
  await db.application.delete({ where: { id } });
  return Response.json({ ok: true, data: { deleted: true } });
}
