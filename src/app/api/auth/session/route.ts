import { getCurrentUser } from "@/lib/identity/auth";

export async function GET() {
  const user = await getCurrentUser();
  return Response.json({
    ok: true,
    data: user ? { user: { id: user.id, email: user.email, name: user.displayName ?? undefined, role: user.role } } : { user: null },
  });
}
