import { getOpportunity, getCountryGuide } from "@/lib/catalogue/queries";
import { notFound } from "@/lib/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const opportunity = await getOpportunity(slug);
  if (opportunity) {
    return Response.json({ ok: true, data: { opportunity } });
  }
  const guide = await getCountryGuide(slug);
  if (guide) {
    return Response.json({ ok: true, data: { guide } });
  }
  return notFound();
}
