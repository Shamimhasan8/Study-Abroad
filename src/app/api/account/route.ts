import { db } from "@/lib/db";
import { getCurrentUser, destroySession } from "@/lib/identity/auth";
import { purgeDocument } from "@/lib/documents/storage";
import { unauthorized, serverError } from "@/lib/validation";

/**
 * Account deletion: removes profile, goals, plans, drafts, applications,
 * documents (files + rows), sessions, and notifications. Public source
 * facts are unaffected. Runs transactionally; document files are purged
 * first so a mid-failure never leaves orphaned accessible files.
 */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const documents = await db.privateDocument.findMany({
      where: { userId: user.id, status: "stored" },
      select: { storageKey: true },
    });
    for (const doc of documents) {
      await purgeDocument(user.id, doc.storageKey);
    }
    await db.$transaction(async (tx) => {
      await tx.profile.deleteMany({ where: { userId: user.id } });
      await tx.goal.deleteMany({ where: { userId: user.id } });
      await tx.writingDraft.deleteMany({ where: { userId: user.id } });
      await tx.experienceEntry.deleteMany({ where: { userId: user.id } });
      await tx.recommenderRequest.deleteMany({ where: { userId: user.id } });
      await tx.researchNote.deleteMany({ where: { userId: user.id } });
      await tx.languageLogEntry.deleteMany({ where: { userId: user.id } });
      await tx.application.deleteMany({ where: { userId: user.id } });
      await tx.shortlistItem.deleteMany({ where: { userId: user.id } });
      await tx.privateDocument.deleteMany({ where: { userId: user.id } });
      await tx.notificationEvent.deleteMany({ where: { userId: user.id } });
      await tx.aiRun.deleteMany({ where: { userId: user.id } });
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.user.delete({ where: { id: user.id } });
    });
    await destroySession();
    return Response.json({ ok: true, data: { deleted: true } });
  } catch {
    return serverError();
  }
}
