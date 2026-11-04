import { db } from "@/lib/db";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/identity/auth";
import { loginSchema, badRequest, serverError } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");

    const { email, password } = parsed.data;
    const user = await db.user.findUnique({ where: { email } });
    if (!user) return Response.json({ ok: false, error: "invalid_credentials" }, { status: 401 });

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return Response.json({ ok: false, error: "invalid_credentials" }, { status: 401 });

    const token = await createSession(user.id);
    await setSessionCookie(token);

    return Response.json({
      ok: true,
      data: {
        user: { id: user.id, email: user.email, name: user.displayName ?? undefined, role: user.role },
      },
    });
  } catch {
    return serverError();
  }
}
