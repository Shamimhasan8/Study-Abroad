/**
 * Catalogue queries — parse Prisma rows into typed domain objects and
 * provide search/filter used by the API and the guest experience.
 *
 * Serverless fallback: when the database is unreachable (no DATABASE_URL or
 * no SQLite file, e.g. read-only serverless deployments), every READ falls
 * back to the committed verified seeds (see ./fallback.ts) so the public
 * catalogue keeps serving. Filters are applied through one shared pure
 * function so the database path and the fallback path can never drift.
 * Writes elsewhere in the app never fake success.
 */
import { db } from "@/lib/db";
import {
  FALLBACK_GUIDES,
  FALLBACK_OPPORTUNITIES,
  type GuideSummary,
} from "@/lib/catalogue/fallback";
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

/** Level inclusion: master's and PhD filters both include combined master_phd records. */
const LEVEL_INCLUSION: Record<string, string[]> = {
  bachelor: ["bachelor"],
  master: ["master", "master_phd"],
  phd: ["phd", "master_phd"],
  master_phd: ["master_phd"],
};

export interface OpportunityFilters {
  country?: string;
  level?: string;
  fundingType?: string;
  cycleStatus?: string;
  query?: string;
}

/**
 * Pure filter shared by the database path and the seed-fallback path so
 * both always agree on semantics (inclusion levels, funding kind, search).
 */
function applyFilters(items: Opportunity[], filters?: OpportunityFilters): Opportunity[] {
  let out = items;
  if (filters?.country && filters.country !== "all") {
    out = out.filter((o) => o.country === filters.country);
  }
  if (filters?.level && filters.level !== "all") {
    const levels = LEVEL_INCLUSION[filters.level] ?? [filters.level];
    out = out.filter((o) => levels.includes(o.level));
  }
  if (filters?.cycleStatus && filters.cycleStatus !== "all") {
    out = out.filter((o) => o.cycleStatus === filters.cycleStatus);
  }
  if (filters?.fundingType && filters.fundingType !== "all") {
    out = out.filter((o) => o.funding.some((f) => f.kind === filters.fundingType));
  }
  if (filters?.query) {
    const q = filters.query.toLowerCase();
    out = out.filter(
      (o) =>
        o.title.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q) ||
        (o.institution ?? "").toLowerCase().includes(q) ||
        o.subjectAreas.some((s) => s.toLowerCase().includes(q)),
    );
  }
  return out;
}

export async function listOpportunities(
  filters?: OpportunityFilters,
): Promise<Opportunity[]> {
  try {
    const rows = await db.opportunity.findMany({
      orderBy: [{ country: "asc" }, { title: "asc" }],
    });
    return applyFilters(rows.map(rowToOpportunity), filters);
  } catch {
    // Database unreachable (e.g. serverless without DATABASE_URL): serve
    // the committed verified seeds in read-only fallback mode.
    return applyFilters(FALLBACK_OPPORTUNITIES, filters);
  }
}

export async function getOpportunity(slug: string): Promise<Opportunity | null> {
  try {
    const row = await db.opportunity.findUnique({ where: { slug } });
    return row ? rowToOpportunity(row) : null;
  } catch {
    return FALLBACK_OPPORTUNITIES.find((o) => o.slug === slug) ?? null;
  }
}

export async function listCountryGuides(): Promise<GuideSummary[]> {
  try {
    const rows = await db.countryGuide.findMany({ orderBy: { code: "asc" } });
    return rows.map((row: NonNullable<GuideRow>) => ({
      code: row.code,
      nameEn: row.nameEn,
      nameBn: row.nameBn,
      contentEn: row.contentEn,
      contentBn: row.contentBn,
      sources: safeParse<SourceRef[]>(row.sourcesJson, []),
    }));
  } catch {
    return FALLBACK_GUIDES;
  }
}

export async function getCountryGuide(code: string): Promise<GuideSummary | null> {
  try {
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
  } catch {
    return FALLBACK_GUIDES.find((g) => g.code === code) ?? null;
  }
}
