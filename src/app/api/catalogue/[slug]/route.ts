import { getOpportunity, getCountryGuide } from "@/lib/catalogue/queries";
import { dataRoute, notFound, publicJson } from "@/lib/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return dataRoute(async () => {
    const { slug } = await params;
    const opportunity = await getOpportunity(slug);
    if (opportunity) {
      return publicJson({ opportunity });
    }
    const guide = await getCountryGuide(slug);
    if (guide) {
      return publicJson({ guide });
    }
    return notFound();
  });
}
