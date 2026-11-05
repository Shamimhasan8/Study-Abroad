import { getCurrentUser } from "@/lib/identity/auth";
import { dataRoute } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  return dataRoute(async () => {
    const user = await getCurrentUser();
    return Response.json(
      {
        ok: true,
        data: user
          ? { user: { id: user.id, email: user.email, name: user.displayName ?? undefined, role: user.role } }
          : { user: null },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
