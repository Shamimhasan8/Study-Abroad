/**
 * Uraan funding engine — the affordability worksheet.
 *
 * Rules of honesty (audited repairs in this version):
 * - Competitive awards are shown but never counted as guaranteed coverage.
 * - Unknown amounts/periods keep totals from being reported as exact; the
 *   known subtotal and unknown categories are surfaced instead.
 * - A `total_award` without a duration is never annualized.
 * - Planning rates are per-currency, user-entered, and clearly labelled as
 *   planning values — there are NO hardcoded rates and no live-rate claim.
 * - Empty cost records mean "living costs undocumented", never zero.
 */
import { sumAnnualCosts, sumFunding, sumUpfront } from "@/lib/money";
import type { FundingWorksheet, Opportunity, ProfileData } from "@/lib/types";

/** Currencies that appear in this opportunity's costs/funding. */
export function worksheetCurrencies(opportunity: Opportunity): string[] {
  const set = new Set<string>();
  for (const c of opportunity.costs) if (c.currency !== "BDT") set.add(c.currency);
  for (const f of opportunity.funding) if (f.currency !== "BDT") set.add(f.currency);
  return [...set].sort();
}

export function buildFundingWorksheet(
  opportunity: Opportunity,
  profile: ProfileData,
  planningRates: Record<string, number> = {},
): FundingWorksheet {
  // BDT is native; every other currency needs a user-entered planning rate.
  const rates: Record<string, number> = { BDT: 1 };
  for (const [currency, rate] of Object.entries(planningRates)) {
    if (rate > 0) rates[currency] = rate;
  }

  const costResult = sumAnnualCosts(opportunity.costs, rates);
  const fundingResult = sumFunding(opportunity.funding, rates);
  const upfront = sumUpfront(opportunity.costs, rates);

  const hasUnknownCosts =
    costResult.noDocumentedCosts ||
    costResult.missing > 0 ||
    upfront.missing > 0 ||
    fundingResult.hasUnknownAmounts;

  // Uncovered annual cost is only exact when the full annual cost total is
  // known AND the guaranteed side is fully resolved.
  // Uncovered after POLICY-promise coverage: conditional on admission/aid
  // application; competitive awards never reduce this figure.
  let uncoveredAnnualBdt: number | undefined;
  if (costResult.total !== null && fundingResult.policyAnnualBdt !== null) {
    const uncovered = costResult.total - fundingResult.policyAnnualBdt;
    uncoveredAnnualBdt = Math.max(0, uncovered);
  }

  // Upfront cash need: one-time items must be available before they fall
  // due. A future stipend never nets against today's deposit here — timing
  // is handled in the note, not by subtraction.
  let upfrontNeededBdt: number | undefined;
  if (upfront.upfrontBdt !== null) {
    upfrontNeededBdt = upfront.upfrontBdt;
  }

  const foreign = worksheetCurrencies(opportunity);
  const missingRateCurrencies = foreign.filter((c) => !rates[c]);

  return {
    opportunitySlug: opportunity.slug,
    costLines: costResult.lines.map(({ item, annualBdt }) => ({ ...item, amountBdt: annualBdt ?? undefined })),
    fundingLines: fundingResult.lines.map(({ item, annualBdt }) => ({ ...item, amountBdt: annualBdt ?? undefined })),
    uncoveredAnnualBdt,
    upfrontNeededBdt,
    hasUnknownCosts,
    policyAnnualBdt: fundingResult.policyAnnualBdt ?? undefined,
    competitiveAnnualBdt: fundingResult.competitiveAnnualBdt ?? undefined,
    planningRates: foreign.length > 0 ? Object.fromEntries(foreign.map((c) => [c, rates[c] ?? null])) : undefined,
    knownCostSubtotalBdt: costResult.knownSubtotal > 0 ? costResult.knownSubtotal : undefined,
    unknownCategories: [...new Set([...costResult.unknownCategories])],
    noDocumentedCosts: costResult.noDocumentedCosts,
    missingRateCurrencies,
  };
}

/** Family contribution context, shown next to the uncovered figure. */
export function contributionContext(
  profile: ProfileData,
  uncoveredAnnualBdt?: number,
): { contributionBdt?: number; gapBdt?: number; note: string } {
  const contribution = profile.annualContributionBdt;
  if (uncoveredAnnualBdt === undefined || contribution === undefined) {
    return {
      contributionBdt: contribution,
      note: "Cannot compute a full gap yet — some amounts are unknown. That is honest, not broken.",
    };
  }
  const gap = Math.max(0, uncoveredAnnualBdt - contribution);
  return {
    contributionBdt: contribution,
    gapBdt: gap,
    note:
      gap > 0
        ? "This gap is real. It must be closed by a confirmed award, changed plans, or a funded alternative — never by assumed part-time work or unnamed future scholarships."
        : "Your recorded contribution covers the documented uncovered costs. Re-check each cycle as costs move.",
  };
}
