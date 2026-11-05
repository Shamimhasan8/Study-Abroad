import { db } from "@/lib/db";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/identity/auth";
import { loginSchema, badRequest, serverError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const MAX_FAILURES = 8;
const WINDOW_MINUTES = 15;

/**
 * Same-origin guard for credential endpoints: when a browser supplies an
 * Origin header (all cross-site POSTs do), it must match the request host.
 * Combined with the SameSite=Lax session cookie this closes CSRF on auth.
 */
function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches and non-browser clients
  try {
    const host = request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 60);
  return null;
}

export async function POST(request: Request) {
  try {
    if (!originAllowed(request)) return badRequest("cross_origin_blocked");

    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");

    const { email, password } = parsed.data;

    // Durable per-email throttle (shared across instances via the DB).
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
    const failures = await db.loginAttempt.count({
      where: { email, ok: false, createdAt: { gte: windowStart } },
    });
    if (failures >= MAX_FAILURES) {
      return Response.json(
        { ok: false, error: "too_many_attempts", retryable: true, retryAfterMinutes: WINDOW_MINUTES },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(WINDOW_MINUTES * 60) } },
      );
    }

    const user = await db.user.findUnique({ where: { email } });
    const valid = user ? await verifyPassword(password, user.passwordHash) : false;

    // Record every attempt (success resets nothing; the window bounds it).
    await db.loginAttempt
      .create({ data: { email, ip: clientIp(request), ok: valid } })
      .catch(() => undefined);

    if (!user || !valid) {
      // Identical response for unknown email and wrong password.
      return Response.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
    }

    const token = await createSession(user.id);
    await setSessionCookie(token);

    return Response.json(
      {
        ok: true,
        data: {
          user: { id: user.id, email: user.email, name: user.displayName ?? undefined, role: user.role },
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return serverError();
  }
}
