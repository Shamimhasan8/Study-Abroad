import { listOpportunities, listCountryGuides } from "@/lib/catalogue/queries";
import { dataRoute, publicJson } from "@/lib/validation";

/**
 * Public catalogue — no auth required (guest browsing works).
 * Bounded public caching (60s) keeps load low; editorial publishes are
 * visible within a minute. A dependency failure returns a typed 503
 * envelope with a request ID — never a blank 500 or a fake empty list.
 */
export async function GET(request: Request) {
  return dataRoute(async () => {
    const url = new URL(request.url);
    const opportunities = await listOpportunities({
      country: url.searchParams.get("country") ?? undefined,
      level: url.searchParams.get("level") ?? undefined,
      fundingType: url.searchParams.get("funding") ?? undefined,
      cycleStatus: url.searchParams.get("cycle") ?? undefined,
      query: url.searchParams.get("q") ?? undefined,
    });
    const guides = await listCountryGuides();
    return publicJson({ opportunities, guides });
  });
}
