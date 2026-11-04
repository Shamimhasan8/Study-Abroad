import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { researchNoteSchema, badRequest, unauthorized, serverError } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const row = await db.researchNote.findUnique({ where: { userId: user.id } });
  if (!row) return Response.json({ ok: true, data: { note: null } });
  return Response.json({
    ok: true,
    data: {
      note: {
        interestStatement: row.interestStatement ?? undefined,
        readingLog: JSON.parse(row.readingJson),
        projectSummary: row.projectSummary ?? undefined,
        facultyFitNotes: row.facultyFitNotes ?? undefined,
        outreachDraft: row.outreachDraft ?? undefined,
        updatedAt: row.updatedAt.toISOString(),
      },
    },
  });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const parsed = researchNoteSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");
    const note = parsed.data;
    await db.researchNote.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        interestStatement: note.interestStatement ?? null,
        readingJson: JSON.stringify(note.readingLog),
        projectSummary: note.projectSummary ?? null,
        facultyFitNotes: note.facultyFitNotes ?? null,
        outreachDraft: note.outreachDraft ?? null,
      },
      update: {
        interestStatement: note.interestStatement ?? null,
        readingJson: JSON.stringify(note.readingLog),
        projectSummary: note.projectSummary ?? null,
        facultyFitNotes: note.facultyFitNotes ?? null,
        outreachDraft: note.outreachDraft ?? null,
      },
    });
    return Response.json({ ok: true, data: { saved: true } });
  } catch {
    return serverError();
  }
}
