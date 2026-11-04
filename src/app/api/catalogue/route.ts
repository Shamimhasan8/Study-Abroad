import { listOpportunities, listCountryGuides } from "@/lib/catalogue/queries";

/** Public catalogue — no auth required (guest browsing works). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const opportunities = await listOpportunities({
    country: url.searchParams.get("country") ?? undefined,
    level: url.searchParams.get("level") ?? undefined,
    fundingType: url.searchParams.get("funding") ?? undefined,
    cycleStatus: url.searchParams.get("cycle") ?? undefined,
    query: url.searchParams.get("q") ?? undefined,
  });
  const guides = await listCountryGuides();
  return Response.json({ ok: true, data: { opportunities, guides } });
}
