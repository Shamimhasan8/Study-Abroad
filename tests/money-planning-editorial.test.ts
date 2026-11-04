/**
 * Money / funding engine regression tests — the honesty rules.
 */
import { describe, expect, it } from "vitest";
import { sumAnnualCosts, sumFunding, sumUpfront, toAnnual, toBdt } from "@/lib/money";
import { buildFundingWorksheet, worksheetCurrencies } from "@/lib/funding/engine";
import { parseFieldPath, coerceFactValue } from "@/lib/editorial/fields";
import { anchorDeadline } from "@/lib/planning/engine";
import type { CostItem, FundingItem, Opportunity, ProfileData } from "@/lib/types";

const cost = (partial: Partial<CostItem>): CostItem => ({
  id: "c1",
  kind: "housing",
  label: "Housing",
  currency: "USD",
  period: "annual",
  estimate: false,
  ...partial,
});

const fund = (partial: Partial<FundingItem>): FundingItem => ({
  id: "f1",
  kind: "stipend",
  label: "Stipend",
  currency: "EUR",
  period: "monthly",
  status: "competitive",
  ...partial,
});

describe("annualization", () => {
  it("total_award without a duration stays unknown (never annualized as-is)", () => {
    expect(toAnnual(24000, "total_award")).toBeNull();
    expect(toAnnual(24000, "total_award", 24)).toBe(12000);
  });
  it("monthly and semester convert explicitly", () => {
    expect(toAnnual(100, "monthly")).toBe(1200);
    expect(toAnnual(5000, "semester")).toBe(10000);
  });
});

describe("per-currency conversion", () => {
  it("each line converts by its own currency's rate", () => {
    expect(toBdt(100, "USD", { USD: 118 })).toBe(11800);
    expect(toBdt(100, "EUR", { USD: 118 })).toBeNull(); // EUR has no rate here
  });

  it("a missing rate makes the line unknown, never a wrong conversion", () => {
    const result = sumAnnualCosts(
      [cost({ amount: 1000, currency: "USD", period: "annual" }), cost({ id: "c2", amount: 800, currency: "EUR", period: "annual" })],
      { USD: 118 },
    );
    expect(result.total).toBeNull();
    expect(result.knownSubtotal).toBe(118000);
    expect(result.unknownCategories.some((c) => c.includes("EUR"))).toBe(true);
  });

  it("an empty cost array does NOT establish zero living costs", () => {
    const result = sumAnnualCosts([], { USD: 118 });
    expect(result.total).toBeNull();
    expect(result.noDocumentedCosts).toBe(true);
    expect(result.unknownCategories.length).toBeGreaterThan(0);
  });
});

describe("award states", () => {
  it("competitive awards are never counted as guaranteed/policy coverage", () => {
    const result = sumFunding(
      [
        fund({ amount: 850, period: "monthly", status: "competitive" }),
        fund({ id: "f2", kind: "tuition_waiver", label: "Tuition waiver", amount: 12000, period: "annual", status: "competitive" }),
      ],
      { EUR: 128 },
    );
    expect(result.policyAnnualBdt).toBe(0);
    expect(result.competitiveAnnualBdt).toBe(850 * 12 * 128 + 12000 * 128);
  });

  it("a policy line whose value is unknown keeps the policy total unknown (0 must not fake 'no gap')", () => {
    const result = sumFunding(
      [fund({ kind: "need_based_aid", amount: undefined, status: "policy" })],
      { USD: 118 },
    );
    expect(result.policyAnnualBdt).toBeNull();
    expect(result.hasUnknownAmounts).toBe(true);
  });
});

describe("upfront needs", () => {
  it("one-time/deposit/test/visa items sum; missing ones block the exact figure", () => {
    const result = sumUpfront(
      [
        cost({ id: "d1", kind: "deposit", label: "Deposit", amount: 200, currency: "USD", period: "one_time" }),
        cost({ id: "d2", kind: "test", label: "IELTS fee", amount: 220, currency: "USD", period: "one_time" }),
        cost({ id: "d3", kind: "deposit", label: "Unknown deposit", amount: undefined, currency: "USD", period: "one_time" }),
      ],
      { USD: 118 },
    );
    expect(result.upfrontBdt).toBeNull(); // one unknown blocks the exact total
    expect(result.knownSubtotal).toBe((200 + 220) * 118);
  });
});

describe("worksheet", () => {
  const profile: ProfileData = {
    degreeLevel: "master",
    fieldInterests: [],
    intakeFlexible: true,
    citizenships: ["Bangladesh"],
    uiLanguage: "en",
    qualifications: [],
    languages: [],
    tests: [],
    financeUncertain: false,
    countryPrefs: [],
    instructionLang: "any",
    willingToLearnLang: false,
    onboardingCompleted: true,
  };
  const opp = {
    id: "x",
    slug: "test-opp",
    kind: "programme",
    level: "master",
    title: "Test",
    country: "us",
    countryLabel: "United States",
    subjectAreas: [],
    routeNote: "",
    description: "",
    fundingType: "scholarship",
    applyUrl: "https://example.com",
    cycleStatus: "open",
    deadlineNote: "",
    deadlines: [],
    requirements: [],
    costs: [cost({ amount: 50000, currency: "USD" })],
    funding: [],
    exclusions: [],
    sources: [],
    reviewState: "baseline_review",
    retrievedAt: "2026-11-04",
  } as unknown as Opportunity;

  it("lists foreign currencies for the rate inputs", () => {
    expect(worksheetCurrencies(opp)).toEqual(["USD"]);
  });

  it("uncovered stays unknown until a rate is entered", () => {
    const w = buildFundingWorksheet(opp, profile);
    expect(w.uncoveredAnnualBdt).toBeUndefined();
    expect(w.missingRateCurrencies).toEqual(["USD"]);
    const withRate = buildFundingWorksheet(opp, profile, { USD: 118 });
    expect(withRate.uncoveredAnnualBdt).toBe(50000 * 118);
  });
});

describe("editorial field registry", () => {
  it("accepts allowlisted scalar and json paths", () => {
    expect(parseFieldPath("cycleStatus").kind).toBe("scalar");
    const json = parseFieldPath("deadlines.embassy-close.closeDate");
    expect(json.kind).toBe("json");
  });
  it("rejects arbitrary/injection paths at parse time", () => {
    expect(parseFieldPath("evil.eval()").kind).toBe("invalid");
    expect(parseFieldPath("constructor.prototype.x").kind).toBe("invalid");
    expect(parseFieldPath("").kind).toBe("invalid");
    expect(parseFieldPath("a.b.c.d").kind).toBe("invalid");
  });
  it("coerceFactValue validates types", () => {
    const field = parseFieldPath("cycleStatus");
    expect(field.kind === "scalar" ? coerceFactValue("closed", field.validator).ok : false).toBe(true);
    expect(field.kind === "scalar" ? coerceFactValue("not-a-status", field.validator).ok : false).toBe(false);
  });
});

describe("planning anchor", () => {
  const today = new Date("2026-11-04");
  const deadline = (closeDate: string) => ({
    id: `d-${closeDate}`,
    type: "admission" as const,
    closeDate,
    precision: "date" as const,
    official: true,
  });

  it("a closed round never anchors; the future one does", () => {
    const opp = {
      deadlines: [
        deadline("2026-04-30"), // closed early round
        deadline("2027-09-30"), // regular future round
      ],
    } as unknown as Opportunity;
    const anchor = anchorDeadline(opp, today);
    expect(anchor?.date.toISOString().slice(0, 10)).toBe("2027-09-30");
  });

  it("all-closed routes have no anchor", () => {
    const opp = { deadlines: [deadline("2026-04-30")] } as unknown as Opportunity;
    expect(anchorDeadline(opp, today)).toBeNull();
  });

  it("admission outranks a nearer document deadline", () => {
    const opp = {
      deadlines: [
        { id: "doc", type: "document", closeDate: "2027-03-01", precision: "date", official: true },
        { id: "adm", type: "admission", closeDate: "2027-09-30", precision: "date", official: true },
      ],
    } as unknown as Opportunity;
    expect(anchorDeadline(opp, today)?.id).toBe("adm");
  });
});
