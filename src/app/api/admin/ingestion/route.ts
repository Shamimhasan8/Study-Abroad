import { requireAdmin } from "@/lib/identity/auth";
import { runIngestion } from "@/lib/ingestion/runner";
import { unauthorized, serverError } from "@/lib/validation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Ingestion trigger. Two authorized callers:
 *
 * 1. A signed-in admin (button in the admin view) — POST with a cookie
 *    session. A GET request never accepts a session: side effects must not
 *    be triggerable through ambient cookie auth (CSRF-safe by design).
 * 2. A deployment scheduler (Vercel Cron) — which sends GET with
 *    `Authorization: Bearer $INGESTION_CRON_SECRET`. A machine caller never
 *    needs an admin session cookie, and the secret is never a user
 *    credential.
 *
 * Vercel Cron invokes GET, so the cron path is exposed on GET; POST stays
 * the admin path. Both share one audited runner.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.INGESTION_CRON_SECRET;
  const isCron =
    cronSecret &&
    authHeader.startsWith("Bearer ") &&
    authHeader.slice(7).length === cronSecret.length &&
    // constant-time compare (values are equal-length)
    safeEqual(authHeader.slice(7), cronSecret);

  let actorId: string | null = null;
  if (!isCron) {
    const admin = await requireAdmin();
    if (!admin) return unauthorized();
    actorId = admin.id;
  }
  return runAndAudit(request, actorId, Boolean(isCron));
}

/** Scheduler entry point (Vercel Cron sends GET + Bearer secret). */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.INGESTION_CRON_SECRET;
  const isCron =
    cronSecret &&
    authHeader.startsWith("Bearer ") &&
    authHeader.slice(7).length === cronSecret.length &&
    safeEqual(authHeader.slice(7), cronSecret);
  if (!isCron) return unauthorized();
  return runAndAudit(request, null, true);
}

async function runAndAudit(request: Request, actorId: string | null, viaCron: boolean) {
  try {
    const url = new URL(request.url);
    const volatility = url.searchParams.get("volatility") ?? undefined;
    const result = await runIngestion({ volatility: volatility ?? undefined });
    await db.auditEvent.create({
      data: {
        actorId,
        action: viaCron ? "ingestion_run_cron" : "ingestion_run",
        targetType: "ingestion",
        detailJson: JSON.stringify({
          sources: result.outcomes.length,
          failed: result.outcomes.filter((o) => o.status === "failed").length,
          via: viaCron ? "cron" : "admin",
        }),
      },
    });
    return Response.json({ ok: true, data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return serverError();
  }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
