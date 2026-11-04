import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { documentPurposeSchema, badRequest, unauthorized, serverError, dataRoute } from "@/lib/validation";
import { ALLOWED_EXTENSIONS, ALLOWED_MIME, maxUploadBytes, newStorageKey, purgeDocument, safeOriginalName, saveDocument, sha256, signatureMatches } from "@/lib/documents/storage";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return dataRoute(async () => {
    const rows = await db.privateDocument.findMany({
      where: { userId: user.id, status: "stored" },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({
      ok: true,
      data: {
        documents: rows.map((r) => ({
          id: r.id,
          purpose: r.purpose,
          originalName: r.originalName,
          mimeType: r.mimeType,
          sizeBytes: r.sizeBytes,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        })),
      },
      }, { headers: { "Cache-Control": "no-store" } });
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const form = await request.formData();
    const file = form.get("file");
    const purposeRaw = String(form.get("purpose") ?? "other");
    const purposeParsed = documentPurposeSchema.safeParse(purposeRaw);
    if (!(file instanceof File)) return badRequest("missing_file");
    if (!purposeParsed.success) return badRequest("invalid_purpose");
    const purpose = purposeParsed.data;

    if (!ALLOWED_MIME.has(file.type)) {
      return badRequest("unsupported_type");
    }
    if (file.size > maxUploadBytes()) {
      return badRequest("too_large");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    // Content signature check: the bytes must match the declared type —
    // a renamed executable never passes as a PDF or image.
    if (!signatureMatches(bytes, file.type)) {
      return badRequest("content_type_mismatch");
    }

    const key = newStorageKey();
    await saveDocument(user.id, key, bytes, file.type);

    try {
      const record = await db.privateDocument.create({
        data: {
          userId: user.id,
          purpose,
          originalName: safeOriginalName(file.name || ALLOWED_EXTENSIONS[file.type]),
          storageKey: key,
          mimeType: file.type,
          sizeBytes: bytes.byteLength,
          sha256: sha256(bytes),
          status: "stored",
        },
      });

      return Response.json(
        {
          ok: true,
          data: {
            document: {
              id: record.id,
              purpose: record.purpose,
              originalName: record.originalName,
              mimeType: record.mimeType,
              sizeBytes: record.sizeBytes,
              status: record.status,
              createdAt: record.createdAt.toISOString(),
            },
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (err) {
      // Metadata write failed: clean up the orphaned stored object so the
      // bucket never accumulates unreachable files.
      await purgeDocument(user.id, key).catch(() => undefined);
      throw err;
    }
  } catch {
    return serverError();
  }
}
