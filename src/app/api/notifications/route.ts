import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { unauthorized, serverError } from "@/lib/validation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const markSchema = z.object({ id: z.string().min(1).optional() });

/** In-app notifications (source changes, reminders). No email/push yet. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const rows = await db.notificationEvent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return Response.json({
    ok: true,
    data: {
      notifications: rows.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body ?? undefined,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
    },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const parsed = markSchema.safeParse(body);
    if (!parsed.success) return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
    if (parsed.data.id) {
      await db.notificationEvent.updateMany({
        where: { id: parsed.data.id, userId: user.id },
        data: { read: true },
      });
    } else {
      await db.notificationEvent.updateMany({ where: { userId: user.id }, data: { read: true } });
    }
    return Response.json({ ok: true, data: { marked: true } });
  } catch {
    return serverError();
  }
}
