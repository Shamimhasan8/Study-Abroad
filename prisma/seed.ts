/**
 * Uraan seed runner — idempotent upserts of country guides, allowlisted
 * sources, and the verified opportunity catalogue.
 * Run: bun prisma/seed.ts
 */
import { db } from "../src/lib/db";
import { SOURCES } from "./seeds/sources";
import { COUNTRY_GUIDES } from "./seeds/countries";
import { JAPAN_OPPORTUNITIES } from "./seeds/opportunities-japan";
import { US_OPPORTUNITIES } from "./seeds/opportunities-us";
import { EU_OPPORTUNITIES } from "./seeds/opportunities-eu";
import type { Opportunity } from "../src/lib/types";

const ALL_OPPORTUNITIES: Opportunity[] = [
  ...JAPAN_OPPORTUNITIES,
  ...US_OPPORTUNITIES,
  ...EU_OPPORTUNITIES,
];

async function seedSources() {
  for (const s of SOURCES) {
    await db.source.upsert({
      where: { key: s.key },
      create: { key: s.key, url: s.url, title: s.title, publisher: s.publisher, tier: s.tier, volatility: s.volatility },
      update: { url: s.url, title: s.title, publisher: s.publisher, tier: s.tier, volatility: s.volatility },
    });
  }
  console.log(`✔ sources: ${SOURCES.length} upserted`);
}

async function seedCountryGuides() {
  for (const g of COUNTRY_GUIDES) {
    await db.countryGuide.upsert({
      where: { code: g.code },
      create: {
        code: g.code,
        nameEn: g.nameEn,
        nameBn: g.nameBn,
        contentEn: g.contentEn,
        contentBn: g.contentBn,
        sourcesJson: JSON.stringify(g.sources),
      },
      update: {
        nameEn: g.nameEn,
        nameBn: g.nameBn,
        contentEn: g.contentEn,
        contentBn: g.contentBn,
        sourcesJson: JSON.stringify(g.sources),
      },
    });
  }
  console.log(`✔ country guides: ${COUNTRY_GUIDES.length} upserted`);
}

function opportunityToData(o: Opportunity) {
  return {
    slug: o.slug,
    kind: o.kind,
    level: o.level,
    title: o.title,
    titleBn: o.titleBn,
    country: o.country,
    countryLabel: o.countryLabel,
    institution: o.institution,
    subjectAreasJson: JSON.stringify(o.subjectAreas),
    routeNote: o.routeNote,
    routeNoteBn: o.routeNoteBn,
    description: o.description,
    descriptionBn: o.descriptionBn,
    fundingType: o.fundingType,
    applyUrl: o.applyUrl,
    cycleYear: o.cycleYear,
    cycleStatus: o.cycleStatus,
    deadlineNote: o.deadlineNote,
    deadlinesJson: JSON.stringify(o.deadlines),
    requirementsJson: JSON.stringify(o.requirements),
    costsJson: JSON.stringify(o.costs),
    fundingJson: JSON.stringify(o.funding),
    exclusionsJson: JSON.stringify(o.exclusions),
    exclusionsBn: o.exclusionsBn ? JSON.stringify(o.exclusionsBn) : null,
    sourcesJson: JSON.stringify(o.sources),
    reviewState: o.reviewState,
    retrievedAt: new Date(o.retrievedAt),
    nextReviewAt: new Date(o.nextReviewAt ?? "2027-01-04"),
  };
}

async function seedOpportunities() {
  for (const o of ALL_OPPORTUNITIES) {
    await db.opportunity.upsert({
      where: { slug: o.slug },
      create: opportunityToData(o),
      update: opportunityToData(o),
    });
  }
  console.log(`✔ opportunities: ${ALL_OPPORTUNITIES.length} upserted`);
}

async function main() {
  await seedSources();
  await seedCountryGuides();
  await seedOpportunities();
  const count = await db.opportunity.count();
  console.log(`Database now holds ${count} opportunities.`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
