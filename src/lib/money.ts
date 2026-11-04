/**
 * Uraan money helpers — integer arithmetic, explicit units and periods.
 * Audited repairs (see docs/REPAIR_AUDIT.md):
 * - `total_award` is never annualized without a duration/disbursement
 *   schedule; a missing duration makes the line unknown, not guessed.
 * - Conversion is per-line by that line's currency with a per-currency
 *   planning-rate map (no single rate silently applied to every foreign
 *   line, no hardcoded default rates).
 * - An empty cost list does NOT establish zero living costs — it marks
 *   living costs as undocumented.
 * - Unknown amounts keep totals from being exact; known subtotals and
 *   unknown categories are surfaced instead.
 */
import type { CostItem, FundingItem } from "./types";

export type Period = CostItem["period"];

/** Duration-aware annualization. */
export function toAnnual(amount: number, period: Period, durationMonths?: number): number | null {
  switch (period) {
    case "annual":
      return amount;
    case "semester":
      return amount * 2;
    case "monthly":
      return amount * 12;
    case "one_time":
      return amount; // counted in the year it falls due; also shown as upfront
    case "total_award": {
      if (durationMonths && durationMonths > 0) {
        return Math.round((amount / durationMonths) * 12);
      }
      return null; // duration unknown → annualization impossible
    }
    default:
      return null;
  }
}

/**
 * Convert one line into BDT using a per-currency planning-rate map.
 * Unknown currency → null (the line stays unknown, never a wrong number).
 */
export function toBdt(amount: number, currency: string, rates: Record<string, number>): number | null {
  if (currency === "BDT") return amount;
  const rate = rates[currency];
  if (!rate || rate <= 0) return null;
  return Math.round(amount * rate);
}

export interface CostTotals {
  total: number | null;
  knownSubtotal: number;
  missing: number;
  noDocumentedCosts: boolean;
  unknownCategories: string[];
  lines: { item: CostItem; annualBdt: number | null }[];
}

/**
 * Sum documented cost lines into an annual planning figure.
 * `total` is only exact when nothing is missing AND at least one cost is
 * documented (an empty catalogue of costs is not a zero-cost life).
 */
export function sumAnnualCosts(costs: CostItem[], rates: Record<string, number>): CostTotals {
  if (costs.length === 0) {
    return { total: null, knownSubtotal: 0, missing: 0, noDocumentedCosts: true, unknownCategories: ["living costs (not documented for this record)"], lines: [] };
  }
  let knownSubtotal = 0;
  let missing = 0;
  const unknownCategories: string[] = [];
  const lines = costs.map((item) => {
    const reason = lineUnknownReason(item, rates);
    if (reason) {
      missing += 1;
      unknownCategories.push(reason);
      return { item, annualBdt: null };
    }
    const annual = toAnnual(item.amount!, item.period);
    if (annual === null) {
      missing += 1;
      unknownCategories.push(`${item.label} (period unknown)`);
      return { item, annualBdt: null };
    }
    const inBdt = toBdt(annual, item.currency, rates);
    if (inBdt === null) {
      missing += 1;
      unknownCategories.push(`${item.label} (no planning rate for ${item.currency})`);
      return { item, annualBdt: null };
    }
    knownSubtotal += inBdt;
    return { item, annualBdt: inBdt };
  });
  return {
    total: missing > 0 ? null : knownSubtotal,
    knownSubtotal,
    missing,
    noDocumentedCosts: false,
    unknownCategories,
    lines,
  };
}

function lineUnknownReason(item: CostItem, rates: Record<string, number>): string | null {
  if (item.amount === undefined) return `${item.label} (amount not documented)`;
  if (item.currency !== "BDT" && !rates[item.currency]) return `${item.label} (no planning rate for ${item.currency})`;
  return null;
}

export interface FundingTotals {
  policyAnnualBdt: number | null;
  competitiveAnnualBdt: number | null;
  hasUnknownAmounts: boolean;
  lines: { item: FundingItem; annualBdt: number | null }[];
}

/**
 * Split funding into guaranteed vs competitive annual BDT.
 * Competitive awards are NEVER counted as guaranteed coverage. A `guaranteed`
 * line whose annualization or rate is unknown keeps the guaranteed total
 * itself unknown (0 must never masquerade as "no gap").
 */
export function sumFunding(funding: FundingItem[], rates: Record<string, number>): FundingTotals {
  let policy: number | null = 0;
  let competitive: number | null = 0;
  let hasUnknownAmounts = false;
  const lines = funding.map((item) => {
    const unknown = (): { item: FundingItem; annualBdt: number | null } => {
      hasUnknownAmounts = true;
      if (item.status === "policy") policy = null;
      else competitive = null;
      return { item, annualBdt: null };
    };
    if (item.amount === undefined || item.period === "total_award") return unknown();
    const annual = toAnnual(item.amount, item.period);
    if (annual === null) return unknown();
    const inBdt = toBdt(annual, item.currency, rates);
    if (inBdt === null) return unknown();
    if (item.status === "policy" && policy !== null) policy += inBdt;
    if (item.status === "competitive" && competitive !== null) competitive += inBdt;
    return { item, annualBdt: inBdt };
  });
  return { policyAnnualBdt: policy, competitiveAnnualBdt: competitive, hasUnknownAmounts, lines };
}

/** One-time/upfront needs: deposits, admission fees, test costs, travel. */
export function sumUpfront(costs: CostItem[], rates: Record<string, number>): {
  upfrontBdt: number | null;
  knownSubtotal: number;
  missing: number;
} {
  let knownSubtotal = 0;
  let missing = 0;
  for (const item of costs) {
    const isUpfront =
      item.period === "one_time" ||
      item.kind === "deposit" ||
      item.kind === "test" ||
      item.kind === "visa";
    if (!isUpfront) continue;
    if (item.amount === undefined) {
      missing += 1;
      continue;
    }
    const inBdt = toBdt(item.amount, item.currency, rates);
    if (inBdt === null) {
      missing += 1;
      continue;
    }
    knownSubtotal += inBdt;
  }
  return { upfrontBdt: missing > 0 ? null : knownSubtotal, knownSubtotal, missing };
}

export function formatBdt(amount: number): string {
  return `৳${amount.toLocaleString("en-IN")}`;
}

export function formatForeign(amount: number, currency: string): string {
  const symbols: Record<string, string> = { USD: "$", EUR: "€", JPY: "¥" };
  const symbol = symbols[currency] ?? `${currency} `;
  return `${symbol}${amount.toLocaleString("en-US")}`;
}
