import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { languageLogSchema, badRequest, unauthorized, serverError } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const rows = await db.languageLogEntry.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
    take: 200,
  });
  return Response.json({
    ok: true,
    data: {
      entries: rows.map((r) => ({
        id: r.id,
        skill: r.skill,
        minutes: r.minutes,
        note: r.note ?? undefined,
        date: r.date,
      })),
    },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const parsed = languageLogSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");
    const entry = await db.languageLogEntry.create({
      data: {
        userId: user.id,
        skill: parsed.data.skill,
        minutes: parsed.data.minutes,
        note: parsed.data.note ?? null,
        date: parsed.data.date,
      },
    });
    return Response.json({ ok: true, data: { id: entry.id } });
  } catch {
    return serverError();
  }
}
