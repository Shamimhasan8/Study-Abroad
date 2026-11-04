/**
 * Uraan matching engine — deterministic requirement evaluator.
 *
 * Contract: AI can explain these results; it can never override them.
 * Unknown operator or missing input → needs_information /
 * needs_institution_confirmation — NEVER an automatic pass.
 */
import type {
  EvaluationSummary,
  OfficialTestResult,
  ProfileData,
  Qualification,
  RequirementEvalResult,
  RequirementRule,
  RuleResult,
} from "@/lib/types";

export const ENGINE_VERSION = "matching-1.0.0";

// ---------- Education-year mapping (documented, factual) ----------
// Counts years of formal education by qualification level. This is NOT a
// grade conversion — grades stay exactly as reported everywhere else.
const EDUCATION_YEARS: Record<string, number> = {
  "ssc": 10,
  "o-level": 10,
  "hsc": 12,
  "a-level": 12,
  "diploma": 12,
  "ib-diploma": 12,
  "bachelor-3y": 15,
  "bachelor-4y": 16,
  "bachelor-honours": 16,
  "master": 17,
  "master-1y": 17,
  "master-2y": 18,
};

export function qualificationYears(q: Qualification): number | null {
  if (q.level === "hsc" || q.level === "ssc") return EDUCATION_YEARS[q.level] ?? null;
  const key = q.level.toLowerCase().replace(/\s+/g, "-");
  if (EDUCATION_YEARS[key] !== undefined) return EDUCATION_YEARS[key];
  // Fuzzy contains checks for common labels
  if (/bachelor/.test(key)) return /pass|3[- ]year|3y/.test(key) ? 15 : 16;
  if (/master/.test(key)) return 17;
  if (/hsc|a[- ]level|diploma|ib/.test(key)) return 12;
  if (/ssc|o[- ]level/.test(key)) return 10;
  return null; // unrecognized → needs_information
}

export function highestEducationYears(profile: ProfileData): number | null {
  let best: number | null = null;
  for (const q of profile.qualifications) {
    const years = qualificationYears(q);
    if (years !== null && (best === null || years > best)) best = years;
  }
  return best;
}

function hasCompletedBachelor(profile: ProfileData): boolean | null {
  let saw3y = false;
  for (const q of profile.qualifications) {
    if (/master/i.test(q.level)) return true;
    if (/bachelor/i.test(q.level)) {
      if (/pass|3[- ]year|3y/i.test(q.level)) {
        saw3y = true;
      } else {
        return true; // 4-year honours recognized as bachelor's completion
      }
    }
  }
  return saw3y ? false : null; // 3-year pass → not_met for 16-year routes; null = unknown
}

function hasCompletedMaster(profile: ProfileData): boolean | null {
  for (const q of profile.qualifications) {
    if (/master/i.test(q.level)) return true;
  }
  const bachelor = hasCompletedBachelor(profile);
  if (bachelor === true) return false;
  return null;
}

function findTest(tests: OfficialTestResult[], name: string): OfficialTestResult | undefined {
  return tests.find((t) => t.testType.toLowerCase().includes(name.toLowerCase()));
}

function scoreMeets(userScore: string, threshold: string): boolean | null {
  const user = parseFloat(userScore);
  const min = parseFloat(threshold);
  if (Number.isNaN(user) || Number.isNaN(min)) return null;
  return user >= min;
}

function evaluateLanguageTests(rule: RequirementRule, profile: ProfileData): {
  result: RuleResult;
  detail: string;
} {
  let thresholds: Record<string, string>;
  try {
    thresholds = JSON.parse(rule.thresholdValue ?? "{}");
  } catch {
    thresholds = {};
  }
  if (Object.keys(thresholds).length === 0) {
    return { result: "needs_institution_confirmation", detail: rule.detail };
  }
  // Any non-numeric threshold means the official numbers must be confirmed.
  const numeric: Record<string, number> = {};
  for (const [test, min] of Object.entries(thresholds)) {
    const value = parseFloat(min);
    if (Number.isNaN(value)) {
      return {
        result: "needs_institution_confirmation",
        detail: `${rule.detail} — accepted tests/scores for the current cycle need confirmation on the official page.`,
      };
    }
    numeric[test] = value;
  }
  const matching: { test: string; score: string; min: number; meets: boolean }[] = [];
  for (const [testName, min] of Object.entries(numeric)) {
    const tokens = testName
      .toLowerCase()
      .split(/[\s(/]+/)
      .filter((tok) => tok.length > 2);
    const candidate = profile.tests.find((t) => {
      const lower = t.testType.toLowerCase();
      return tokens.some((tok) => lower.includes(tok));
    });
    if (candidate) {
      const meets = scoreMeets(candidate.score, String(min));
      matching.push({ test: testName, score: candidate.score, min, meets: meets !== false });
    }
  }
  if (matching.length === 0) {
    return {
      result: "needs_information",
      detail: `No matching official test result on your profile yet. Accepted tests: ${Object.keys(numeric).join(", ")}. Self-estimated levels never count here.`,
    };
  }
  const anyMet = matching.some((m) => m.meets);
  const best = matching.find((m) => m.meets) ?? matching[0];
  if (anyMet) {
    return { result: "met", detail: `${best.test}: ${best.score} (minimum ${best.min}).` };
  }
  return {
    result: "not_met",
    detail: `${best.test}: ${best.score} is below the ${best.min} reference minimum. Plan a retake or an accepted alternative test.`,
  };
}

function ageAtIntake(profile: ProfileData): number | null {
  if (!profile.birthYear || !profile.targetIntakeYear) return null;
  return profile.targetIntakeYear - profile.birthYear;
}

// ---------- Rule evaluation ----------

export function evaluateRule(
  rule: RequirementRule,
  profile: ProfileData,
): RequirementEvalResult {
  const base: RequirementEvalResult = {
    ruleId: rule.id,
    title: rule.title,
    titleBn: rule.titleBn,
    category: rule.category,
    result: "needs_information",
    detail: rule.detail,
    suggestedAction: actionFor(rule),
  };

  switch (rule.operator) {
    case "min_education_years": {
      const need = parseInt(rule.thresholdValue ?? "0", 10);
      const have = highestEducationYears(profile);
      if (have === null) {
        return {
          ...base,
          result: "needs_information",
          detail: `Your education level is not recorded clearly enough to check the ${need}-year requirement. Add your highest qualification in onboarding.`,
        };
      }
      if (have >= need) {
        return { ...base, result: "met", detail: `${have} years of education recorded (requirement: ${need} years).` };
      }
      return {
        ...base,
        result: "not_met",
        detail: `${have} years recorded — this route needs ${need} years. A foundation/bridging year or a completed higher qualification may be required.`,
      };
    }

    case "completed_bachelor": {
      const status = hasCompletedBachelor(profile);
      if (status === null) {
        return { ...base, result: "needs_information", detail: "No bachelor's-level qualification recorded yet." };
      }
      if (status) {
        return { ...base, result: "met", detail: "A completed bachelor's-level qualification is on your profile." };
      }
      return {
        ...base,
        result: "not_met",
        detail: "A 3-year pass degree does not reach the typical 4-year/honours expectation of this route. Confirm equivalence with the institution.",
      };
    }

    case "completed_master": {
      const status = hasCompletedMaster(profile);
      if (status === null) {
        return { ...base, result: "needs_information", detail: "Master's-level completion not determinable from your profile yet." };
      }
      if (status) return { ...base, result: "met", detail: "A completed master's degree is on your profile." };
      return {
        ...base,
        result: rule.requiredness === "conditional" ? "needs_institution_confirmation" : "not_met",
        detail:
          rule.requiredness === "conditional"
            ? "Most routes here require a master's; a very strong bachelor's occasionally suffices — confirm with the programme."
            : "This route expects a completed master's degree.",
      };
    }

    case "age_range":
    case "age_min":
    case "age_max": {
      const age = ageAtIntake(profile);
      if (age === null) {
        return {
          ...base,
          result: "needs_information",
          detail: "Add your birth year (optional field) to check this age rule.",
        };
      }
      let ok = true;
      if (rule.operator === "age_range") {
        const [min, max] = (rule.thresholdValue ?? "").split("-").map((n) => parseInt(n, 10));
        ok = age >= (min || 0) && age <= (max || 200);
      } else if (rule.operator === "age_min") {
        ok = age >= parseInt(rule.thresholdValue ?? "0", 10);
      } else {
        ok = age <= parseInt(rule.thresholdValue ?? "200", 10);
      }
      if (ok) return { ...base, result: "met", detail: `Age ${age} at intake fits the published window (with per-cycle cutoffs — still read the current guidelines).` };
      return {
        ...base,
        result: "not_met",
        detail: `Age ${age} at the target intake falls outside the historical window (${rule.thresholdValue}${rule.unit ? " " + rule.unit : ""}). Exact cutoffs move per cycle — verify the current call before deciding.`,
      };
    }

    case "language_test_any": {
      const { result, detail } = evaluateLanguageTests(rule, profile);
      return { ...base, result, detail: detail || rule.detail };
    }

    case "test_required": {
      let accepted: string[] = [];
      try {
        accepted = JSON.parse(rule.thresholdValue ?? "[]");
      } catch {
        accepted = [];
      }
      if (accepted.length === 0) {
        return { ...base, result: "needs_institution_confirmation", detail: rule.detail };
      }
      const held = profile.tests.filter((t) =>
        accepted.some((name) => t.testType.toLowerCase().includes(name.toLowerCase())),
      );
      if (held.length > 0) {
        return { ...base, result: "met", detail: `Recorded: ${held.map((t) => `${t.testType} (${t.score})`).join(", ")}.` };
      }
      return {
        ...base,
        result: "not_met",
        detail: `This route requires one of: ${accepted.join(" / ")}. None is recorded on your profile.`,
        suggestedAction: `Plan, book, and prepare for one accepted test (${accepted.join(" / ")}).`,
      };
    }

    case "citizenship_eligible": {
      let eligible: string[] = [];
      try {
        eligible = JSON.parse(rule.thresholdValue ?? "[]");
      } catch {
        eligible = [];
      }
      if (profile.citizenships.length === 0) {
        return { ...base, result: "needs_information", detail: "Add your citizenship(s) in onboarding to check eligibility." };
      }
      const has = profile.citizenships.some((c) =>
        eligible.some((e) => c.toLowerCase().includes(e.toLowerCase()) || e.toLowerCase().includes(c.toLowerCase())),
      );
      if (has) return { ...base, result: "met", detail: `Citizenship (${profile.citizenships.join(", ")}) is within the eligible pool.` };
      return {
        ...base,
        result: "not_met",
        detail: `This scheme is for citizens of ${eligible.join(", ")} — your recorded citizenship (${profile.citizenships.join(", ")}) is outside the pool.`,
      };
    }

    case "citizenship_excluded": {
      let excluded: string[] = [];
      try {
        excluded = JSON.parse(rule.thresholdValue ?? "[]");
      } catch {
        excluded = [];
      }
      const excludedHit = profile.citizenships.some((c) =>
        excluded.some((e) => c.toLowerCase().includes(e.toLowerCase())),
      );
      if (excludedHit) {
        return { ...base, result: "not_met", detail: `Your citizenship (${profile.citizenships.join(", ")}) is excluded from this route.` };
      }
      return { ...base, result: "met", detail: "Citizenship is not in the excluded pool." };
    }

    case "professional_experience_years": {
      const need = parseFloat(rule.thresholdValue ?? "0");
      const have = profile.workExperienceYears;
      if (have === undefined) {
        return {
          ...base,
          result: "needs_information",
          detail: `This route expects ~${need}+ years of professional experience. Add your work experience years in onboarding (or record experiences in the journal).`,
        };
      }
      if (have >= need) {
        return { ...base, result: "met", detail: `${have} years of professional experience recorded (expectation: ~${need}+).` };
      }
      return {
        ...base,
        result: "not_met",
        detail: `${have} year(s) recorded — this route commonly expects ~${need}+ years of relevant work experience.`,
      };
    }

    case "embassy_route":
    case "institution_confirmation": {
      return {
        ...base,
        result: "needs_institution_confirmation",
        detail: rule.detail,
        suggestedAction: actionFor(rule),
      };
    }

    case "competitive_guidance": {
      // Competitive context is guidance, not an eligibility gate — rendered
      // separately so it never reads as a pass/fail check.
      return { ...base, result: "not_applicable", detail: rule.detail };
    }

    case "documentation": {
      // Documentation becomes preparation tasks, not eligibility results.
      return { ...base, result: "not_applicable", detail: rule.detail, suggestedAction: actionFor(rule) };
    }

    default: {
      // Unknown operator: NEVER silently pass.
      return {
        ...base,
        result: "needs_institution_confirmation",
        detail: `${rule.detail} (This rule type is outside automated checking — confirm with the institution.)`,
      };
    }
  }
}

function actionFor(rule: RequirementRule): string {
  switch (rule.category) {
    case "language":
      return "Open Prepare → Language: choose an accepted test, set a target date, and log study time weekly.";
    case "documentation":
      return "Open Prepare → Documents: collect and upload this document with a clear purpose label.";
    case "funding":
      return "Open the funding worksheet: compare documented costs with your family contribution and upfront funds.";
    case "admission":
      return "Confirm the current-cycle detail on the official page and add an application to track it.";
    case "competitiveness":
      return "Open Prepare → Experience: record genuine depth (projects, work, community) rather than collecting certificates.";
    default:
      return "Review this requirement on the official page and record what you learn.";
  }
}

// ---------- Aggregate ----------

export function evaluateOpportunity(
  requirements: RequirementRule[],
  profile: ProfileData,
  opportunitySlug: string,
): EvaluationSummary {
  const results = requirements.map((rule) => evaluateRule(rule, profile));
  const counts = {
    met: results.filter((r) => r.result === "met").length,
    notMet: results.filter((r) => r.result === "not_met").length,
    needsInfo: results.filter((r) => r.result === "needs_information").length,
    needsConfirm: results.filter((r) => r.result === "needs_institution_confirmation").length,
    notApplicable: results.filter((r) => r.result === "not_applicable").length,
  };
  const gapTitles = results
    .filter((r) => r.result === "not_met" || r.result === "needs_information")
    .map((r) => r.title);
  return {
    opportunitySlug,
    results,
    counts,
    gapTitles,
    conservativeNote: true,
  };
}

/** Conservative top-line for cards: never "all clear" if anything is unknown. */
export function aggregateLabel(summary: EvaluationSummary, lang: "en" | "bn" = "en"): string {
  const { met, notMet, needsInfo, needsConfirm } = summary.counts;
  if (lang === "bn") {
    return `${met} মেটে · ${notMet} মেটেনি · ${needsInfo + needsConfirm} নিশ্চিত করতে হবে`;
  }
  return `${met} met · ${notMet} not met · ${needsInfo + needsConfirm} to resolve`;
}
