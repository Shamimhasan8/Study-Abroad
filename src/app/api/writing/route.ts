import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { draftSchema, badRequest, unauthorized, notFound, serverError } from "@/lib/validation";

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function serialize(row: {
  id: string;
  kind: string;
  title: string;
  institutionPrompt: string | null;
  wordLimit: number | null;
  aiPolicy: string;
  currentContent: string;
  updatedAt: Date;
  createdAt: Date;
  versions: { id: string; content: string; wordCount: number; note: string | null; createdAt: Date }[];
}) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    institutionPrompt: row.institutionPrompt ?? undefined,
    wordLimit: row.wordLimit ?? undefined,
    aiPolicy: row.aiPolicy,
    currentContent: row.currentContent,
    versions: row.versions.map((v) => ({
      id: v.id,
      content: v.content,
      wordCount: v.wordCount,
      note: v.note ?? undefined,
      createdAt: v.createdAt.toISOString(),
    })),
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const rows = await db.writingDraft.findMany({
    where: { userId: user.id },
    include: { versions: { orderBy: { createdAt: "desc" }, take: 10 } },
    orderBy: { updatedAt: "desc" },
  });
  return Response.json({ ok: true, data: { drafts: rows.map(serialize) } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const parsed = draftSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");
    const draft = parsed.data;

    if (draft.id) {
      const existing = await db.writingDraft.findUnique({ where: { id: draft.id } });
      if (!existing || existing.userId !== user.id) return notFound();

      const contentChanged = existing.currentContent !== draft.content;
      const updated = await db.writingDraft.update({
        where: { id: draft.id },
        data: {
          title: draft.title,
          institutionPrompt: draft.institutionPrompt ?? null,
          wordLimit: draft.wordLimit ?? null,
          aiPolicy: draft.aiPolicy,
          currentContent: draft.content,
          versions: contentChanged
            ? { create: { content: draft.content, wordCount: wordCount(draft.content), note: "autosave" } }
            : undefined,
        },
        include: { versions: { orderBy: { createdAt: "desc" }, take: 10 } },
      });
      return Response.json({ ok: true, data: { draft: serialize(updated) } });
    }

    const created = await db.writingDraft.create({
      data: {
        userId: user.id,
        kind: draft.kind,
        title: draft.title,
        institutionPrompt: draft.institutionPrompt ?? null,
        wordLimit: draft.wordLimit ?? null,
        aiPolicy: draft.aiPolicy,
        currentContent: draft.content,
        versions: { create: { content: draft.content, wordCount: wordCount(draft.content), note: "initial" } },
      },
      include: { versions: { orderBy: { createdAt: "desc" }, take: 10 } },
    });
    return Response.json({ ok: true, data: { draft: serialize(created) } });
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
  const existing = await db.writingDraft.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return notFound();
  await db.writingDraft.delete({ where: { id } });
  return Response.json({ ok: true, data: { deleted: true } });
}
