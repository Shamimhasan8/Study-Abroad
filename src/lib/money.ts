/**
 * Money helpers — integer arithmetic only, explicit units and periods.
 * No float math on currency. Unknown amounts stay undefined so totals
 * refuse to become falsely precise.
 */
import type { CostItem, FundingItem } from "./types";

export type Period = CostItem["period"];

/** Convert a period-scoped amount to a per-year view; null when unknown. */
export function toAnnual(amount: number, period: Period): number | null {
  switch (period) {
    case "annual":
    case "total_award":
      return amount;
    case "semester":
      return amount * 2;
    case "monthly":
      return amount * 12;
    case "one_time":
      return amount; // counted in the year it falls due
    default:
      return null;
  }
}

/**
 * Sum documented cost lines into an annual planning figure.
 * Returns { total, missing } where missing>0 keeps honest incompleteness:
 * a total is only reported when nothing is missing.
 */
export function sumAnnualCosts(costs: CostItem[], rate?: number): {
  total: number | null;
  missing: number;
  lines: { item: CostItem; annualBdt: number | null }[];
} {
  let total = 0;
  let missing = 0;
  const lines = costs.map((item) => {
    if (item.amount === undefined) {
      missing += 1;
      return { item, annualBdt: null };
    }
    const annual = toAnnual(item.amount, item.period);
    if (annual === null) {
      missing += 1;
      return { item, annualBdt: null };
    }
    const inBdt = item.currency === "BDT" ? annual : rate ? Math.round(annual * rate) : null;
    if (inBdt === null) {
      missing += 1; // no planning rate → conversion impossible
      return { item, annualBdt: null };
    }
    total += inBdt;
    return { item, annualBdt: inBdt };
  });
  return { total: missing > 0 ? null : total, missing, lines };
}

/**
 * Split funding into guaranteed vs competitive annual BDT.
 * Competitive awards are NEVER counted as guaranteed coverage.
 */
export function sumFunding(funding: FundingItem[], rate?: number): {
  guaranteedAnnualBdt: number | null;
  competitiveAnnualBdt: number | null;
  hasUnknownAmounts: boolean;
  lines: { item: FundingItem; annualBdt: number | null }[];
} {
  let guaranteed = 0;
  let competitive = 0;
  let hasUnknownAmounts = false;
  const lines = funding.map((item) => {
    if (item.amount === undefined) {
      hasUnknownAmounts = true;
      return { item, annualBdt: null };
    }
    const annual = toAnnual(item.amount, item.period);
    if (annual === null) {
      hasUnknownAmounts = true;
      return { item, annualBdt: null };
    }
    const inBdt = item.currency === "BDT" ? annual : rate ? Math.round(annual * rate) : null;
    if (inBdt === null) {
      hasUnknownAmounts = true;
      return { item, annualBdt: null };
    }
    if (item.guaranteed) guaranteed += inBdt;
    else competitive += inBdt;
    return { item, annualBdt: inBdt };
  });
  return {
    guaranteedAnnualBdt: guaranteed,
    competitiveAnnualBdt: competitive,
    hasUnknownAmounts,
    lines,
  };
}

/** One-time/upfront needs: deposits, admission fees, test costs, travel. */
export function sumUpfront(costs: CostItem[], rate?: number): {
  upfrontBdt: number | null;
  missing: number;
} {
  let upfront = 0;
  let missing = 0;
  for (const item of costs) {
    const isUpfront =
      item.period === "one_time" ||
      item.kind === "deposit" ||
      item.kind === "test" ||
      item.kind === "visa";
    if (!isUpfront || item.amount === undefined) {
      if (isUpfront && item.amount === undefined) missing += 1;
      continue;
    }
    const inBdt = item.currency === "BDT" ? item.amount : rate ? Math.round(item.amount * rate) : null;
    if (inBdt === null) {
      missing += 1;
      continue;
    }
    upfront += inBdt;
  }
  return { upfrontBdt: missing > 0 ? null : upfront, missing };
}

export function formatBdt(amount: number): string {
  return `৳${amount.toLocaleString("en-IN")}`;
}

export function formatForeign(amount: number, currency: string): string {
  const symbols: Record<string, string> = { USD: "$", EUR: "€", JPY: "¥" };
  const symbol = symbols[currency] ?? `${currency} `;
  return `${symbol}${amount.toLocaleString("en-US")}`;
}
