/**
 * Catalogue queries — parse Prisma rows into typed domain objects and
 * provide search/filter used by the API and the guest experience.
 */
import { db } from "@/lib/db";
import type {
  CostItem,
  DeadlineEvent,
  FundingItem,
  Opportunity,
  RequirementRule,
  SourceRef,
} from "@/lib/types";

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

type OpportunityRow = Awaited<ReturnType<typeof db.opportunity.findFirst>>;
type GuideRow = Awaited<ReturnType<typeof db.countryGuide.findFirst>>;

export function rowToOpportunity(row: NonNullable<OpportunityRow>): Opportunity {
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind as Opportunity["kind"],
    level: row.level as Opportunity["level"],
    title: row.title,
    titleBn: row.titleBn ?? undefined,
    country: row.country,
    countryLabel: row.countryLabel,
    institution: row.institution ?? undefined,
    subjectAreas: safeParse<string[]>(row.subjectAreasJson, []),
    routeNote: row.routeNote,
    routeNoteBn: row.routeNoteBn ?? undefined,
    description: row.description,
    descriptionBn: row.descriptionBn ?? undefined,
    fundingType: row.fundingType,
    applyUrl: row.applyUrl,
    cycleYear: row.cycleYear ?? undefined,
    cycleStatus: row.cycleStatus as Opportunity["cycleStatus"],
    deadlineNote: row.deadlineNote,
    deadlines: safeParse<DeadlineEvent[]>(row.deadlinesJson, []),
    requirements: safeParse<RequirementRule[]>(row.requirementsJson, []),
    costs: safeParse<CostItem[]>(row.costsJson, []),
    funding: safeParse<FundingItem[]>(row.fundingJson, []),
    exclusions: safeParse<string[]>(row.exclusionsJson, []),
    exclusionsBn: row.exclusionsBn ? safeParse<string[]>(row.exclusionsBn, []) : undefined,
    sources: safeParse<SourceRef[]>(row.sourcesJson, []),
    reviewState: row.reviewState as Opportunity["reviewState"],
    retrievedAt: row.retrievedAt.toISOString().slice(0, 10),
    nextReviewAt: row.nextReviewAt?.toISOString().slice(0, 10),
  };
}

export async function listOpportunities(filters?: {
  country?: string;
  level?: string;
  fundingType?: string;
  cycleStatus?: string;
  query?: string;
}): Promise<Opportunity[]> {
  const where: Record<string, unknown> = {};
  if (filters?.country && filters.country !== "all") where.country = filters.country;
  if (filters?.level && filters.level !== "all") where.level = filters.level;
  if (filters?.cycleStatus && filters.cycleStatus !== "all") where.cycleStatus = filters.cycleStatus;
  const rows = await db.opportunity.findMany({
    where,
    orderBy: [{ country: "asc" }, { title: "asc" }],
  });
  let items = rows.map(rowToOpportunity);
  if (filters?.fundingType && filters.fundingType !== "all") {
    items = items.filter((o) => o.funding.some((f) => f.kind === filters.fundingType));
  }
  if (filters?.query) {
    const q = filters.query.toLowerCase();
    items = items.filter(
      (o) =>
        o.title.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q) ||
        (o.institution ?? "").toLowerCase().includes(q) ||
        o.subjectAreas.some((s) => s.toLowerCase().includes(q)),
    );
  }
  return items;
}

export async function getOpportunity(slug: string): Promise<Opportunity | null> {
  const row = await db.opportunity.findUnique({ where: { slug } });
  return row ? rowToOpportunity(row) : null;
}

export async function listCountryGuides() {
  const rows = await db.countryGuide.findMany({ orderBy: { code: "asc" } });
  return rows.map((row: NonNullable<GuideRow>) => ({
    code: row.code,
    nameEn: row.nameEn,
    nameBn: row.nameBn,
    contentEn: row.contentEn,
    contentBn: row.contentBn,
    sources: safeParse<SourceRef[]>(row.sourcesJson, []),
  }));
}

export async function getCountryGuide(code: string) {
  const row = await db.countryGuide.findUnique({ where: { code } });
  if (!row) return null;
  return {
    code: row.code,
    nameEn: row.nameEn,
    nameBn: row.nameBn,
    contentEn: row.contentEn,
    contentBn: row.contentBn,
    sources: safeParse<SourceRef[]>(row.sourcesJson, []),
  };
}
