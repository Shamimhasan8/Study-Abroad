import { db } from "@/lib/db";
import { hashPassword, createSession, setSessionCookie } from "@/lib/identity/auth";
import { registerSchema, badRequest, serverError } from "@/lib/validation";
import { db as prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.code;
      const message =
        issue === "too_small" ? "weak_password" : issue === "invalid_string" ? "invalid_email" : "invalid_input";
      return badRequest(message);
    }
    const { name, email, password } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return badRequest("email_taken");

    const passwordHash = await hashPassword(password);

    // First user becomes admin when no admin exists and no allowlist is set.
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const anyAdmin = adminEmails.length
      ? await prisma.user.count({ where: { role: "admin", email: { in: adminEmails } } })
      : await prisma.user.count({ where: { role: "admin" } });
    const role = adminEmails.includes(email) || anyAdmin === 0 ? "admin" : "student";

    const user = await db.user.create({
      data: { email, passwordHash, displayName: name ?? null, role },
    });

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
