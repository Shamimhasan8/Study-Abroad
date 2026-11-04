/**
 * Uraan funding engine — the affordability worksheet.
 *
 * Rules of honesty:
 * - Competitive awards are shown but never counted as guaranteed coverage.
 * - Unknown amounts keep the total from being reported as exact.
 * - The planning exchange rate is user-set and clearly labelled; no live
 *   rates are fetched or implied.
 */
import { sumAnnualCosts, sumFunding, sumUpfront } from "@/lib/money";
import type { FundingWorksheet, Opportunity, ProfileData } from "@/lib/types";

/** Sensible default planning rates (clearly labelled as user-editable). */
export const DEFAULT_PLANNING_RATES: Record<string, number> = {
  USD: 118, // BDT per USD
  EUR: 128, // BDT per EUR
  JPY: 0.78, // BDT per JPY
};

export function buildFundingWorksheet(
  opportunity: Opportunity,
  profile: ProfileData,
  customRate?: number,
): FundingWorksheet {
  const rates: Record<string, number> = { ...DEFAULT_PLANNING_RATES, BDT: 1 };
  if (customRate && customRate > 0) {
    // A single custom rate applies to the opportunity's dominant currency.
    const dominant = opportunity.costs[0]?.currency ?? opportunity.funding[0]?.currency;
    if (dominant) rates[dominant] = customRate;
  }

  const costResult = sumAnnualCosts(opportunity.costs, rates[opportunity.costs[0]?.currency ?? "USD"]);
  const fundingResult = sumFunding(opportunity.funding, rates[opportunity.funding[0]?.currency ?? "USD"]);
  const upfront = sumUpfront(opportunity.costs, rates[opportunity.costs[0]?.currency ?? "USD"]);

  const hasUnknownCosts = costResult.missing > 0 || upfront.missing > 0 || fundingResult.hasUnknownAmounts;

  let uncoveredAnnualBdt: number | undefined;
  if (costResult.total !== null && fundingResult.guaranteedAnnualBdt !== null) {
    const uncovered = costResult.total - fundingResult.guaranteedAnnualBdt;
    uncoveredAnnualBdt = Math.max(0, uncovered);
  }

  // Upfront need: one-time costs not covered by guaranteed funding that
  // pays out later (stipends) — compares against the user's upfront funds.
  let upfrontNeededBdt: number | undefined;
  if (upfront.upfrontBdt !== null) {
    upfrontNeededBdt = upfront.upfrontBdt;
  }

  // Attach the planning rate actually used for the first foreign currency.
  const firstForeign =
    opportunity.costs.find((c) => c.currency !== "BDT")?.currency ??
    opportunity.funding.find((f) => f.currency !== "BDT")?.currency;

  return {
    opportunitySlug: opportunity.slug,
    costLines: costResult.lines.map(({ item, annualBdt }) => ({ ...item, amountBdt: annualBdt ?? undefined })),
    fundingLines: fundingResult.lines.map(({ item, annualBdt }) => ({ ...item, amountBdt: annualBdt ?? undefined })),
    uncoveredAnnualBdt,
    upfrontNeededBdt,
    hasUnknownCosts,
    guaranteedAnnualBdt: fundingResult.guaranteedAnnualBdt ?? undefined,
    competitiveAnnualBdt: fundingResult.competitiveAnnualBdt ?? undefined,
    planningRate: firstForeign ? rates[firstForeign] : undefined,
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
