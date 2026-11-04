import { destroySession } from "@/lib/identity/auth";

export async function POST() {
  await destroySession();
  return Response.json({ ok: true, data: {} });
}
