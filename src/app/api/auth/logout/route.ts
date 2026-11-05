import { destroySession } from "@/lib/identity/auth";
import { dataRoute } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST() {
  return dataRoute(async () => {
    await destroySession();
    return Response.json({ ok: true, data: {} }, { headers: { "Cache-Control": "no-store" } });
  });
}
