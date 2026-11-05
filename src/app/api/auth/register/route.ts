import { db } from "@/lib/db";
import { hashPassword, createSession, setSessionCookie } from "@/lib/identity/auth";
import { registerSchema, badRequest, serverError } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Public registration ALWAYS creates a student account.
 *
 * Privilege model (audited fix P0-4): no first-user, allowlist, or
 * client-supplied flag can ever mint an admin here. Administrators are
 * provisioned only by the owner through `bun run admin:grant -- <email>`
 * (scripts/admin-grant.ts) on a trusted machine with database access.
 * ADMIN_EMAILS is advisory metadata for that tool — it is deliberately
 * ignored by every public request path.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const field = first?.path?.[0];
      const message =
        field === "password" ? "weak_password" : field === "email" ? "invalid_email" : "invalid_input";
      return badRequest(message);
    }
    const { name, email, password } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return badRequest("email_taken");

    const passwordHash = await hashPassword(password);

    try {
      const user = await db.user.create({
        data: { email, passwordHash, displayName: name ?? null, role: "student" },
      });

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
    } catch (err) {
      // Unique-constraint race between two concurrent registrations.
      const code = (err as { code?: string })?.code;
      if (code === "P2002") return badRequest("email_taken");
      throw err;
    }
  } catch {
    return serverError();
  }
}
