import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { notFound, unauthorized } from "@/lib/validation";
import { purgeDocument, readDocument } from "@/lib/documents/storage";

/** Authenticated, owner-checked download. Never a public path. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const record = await db.privateDocument.findUnique({ where: { id } });
  if (!record || record.userId !== user.id || record.status !== "stored") return notFound();

  try {
    const bytes = await readDocument(user.id, record.storageKey);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": record.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(record.originalName)}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return notFound();
  }
}

/** Deletion revokes access immediately and removes the stored file. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const record = await db.privateDocument.findUnique({ where: { id } });
  if (!record || record.userId !== user.id) return notFound();

  await purgeDocument(user.id, record.storageKey);
  await db.privateDocument.update({
    where: { id },
    data: { status: "deleted", deletedAt: new Date() },
  });
  return Response.json({ ok: true, data: { deleted: true } });
}
