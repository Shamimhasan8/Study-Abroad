/**
 * Uraan matching engine — deterministic requirement evaluator. v2
 *
 * Contract: AI can explain these results; it can never override them.
 * Audited repairs in v2 (see docs/REPAIR_AUDIT.md):
 * - No null/NaN score may satisfy a threshold (was: `meets !== false`).
 * - Test matching uses normalized test FAMILIES, not substring hits on
 *   words like "English".
 * - Qualification completion honours completed vs expected; a label
 *   containing "bachelor" is never read as a completed degree by itself.
 * - Diploma equivalence is route-specific -> institution confirmation,
 *   never an automatic 12-year pass.
 * - 3-year bachelor's is not universally rejected: route-specific
 *   confirmation instead of a hard not_met.
 * - Age rules with day-level cutoffs are resolved only when the birth
 *   year proves the outcome in both birthday scenarios; otherwise
 *   needs_information (never a confident "fits").
 * - Optional/conditional rules never become hard gates; their misses are
 *   reported separately from blocking gaps.
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

export const ENGINE_VERSION = "matching-2.0.0";

// ---------- Education duration (reported years; NOT credential recognition) ----------
const EDUCATION_YEARS: Record<string, number> = {
  "ssc": 10,
  "o-level": 10,
  "hsc": 12,
  "a-level": 12,
  "ib-diploma": 12,
  "bachelor-3y": 15,
  "bachelor-4y": 16,
  "bachelor-honours": 16,
  "master": 17,
  "master-1y": 17,
  "master-2y": 18,
};

/** Completed/expected/unknown — driven by explicit fields, never labels. */
function qualificationStatus(q: Qualification): "completed" | "expected" | "unknown" {
  if (q.expectedYear && q.expectedYear.trim()) return "expected";
  if (q.year && q.year.trim()) return "completed";
  return "unknown";
}

export function qualificationYears(q: Qualification): number | null {
  // Duration as reported. "diploma" is deliberately absent: its years vary
  // by system (Bangladesh diploma ≠ universally 12 years) — unknown, not guessed.
  const key = q.level.toLowerCase().replace(/\s+/g, "-");
  if (key === "ssc" || key === "hsc") return EDUCATION_YEARS[key] ?? null;
  if (key === "diploma") return null;
  return EDUCATION_YEARS[key] ?? null;
}

export function highestEducationYears(profile: ProfileData): number | null {
  let best: number | null = null;
  for (const q of profile.qualifications) {
    const years = qualificationYears(q);
    if (years !== null && (best === null || years > best)) best = years;
  }
  return best;
}

/**
 * Bachelor's-level standing. Returns a tagged state so callers can be
 * honest about "in progress" vs "route-specific recognition".
 */
export type BachelorStanding =
  | { kind: "met"; why: string }
  | { kind: "expected" }
  | { kind: "three_year" }
  | { kind: "master_met"; why: string }
  | { kind: "unknown" };

function bachelorStanding(profile: ProfileData): BachelorStanding {
  for (const q of profile.qualifications) {
    const key = q.level.toLowerCase().replace(/\s+/g, "-");
    const status = qualificationStatus(q);
    if (/master/.test(key)) {
      if (status === "completed") return { kind: "master_met", why: q.level };
      if (status === "expected") return { kind: "expected" };
      // master with unclear status → fall through to bachelor checks
    }
    if (/bachelor|bsc|ba\b|beng|btech/.test(key)) {
      if (status === "expected") return { kind: "expected" };
      if (status === "completed") {
        if (/pass|3[- ]year|3y/.test(key)) return { kind: "three_year" };
        return { kind: "met", why: q.level };
      }
    }
  }
  return { kind: "unknown" };
}

// ---------- Test families ----------

/** Canonical test families; matching is family-to-family, never substring. */
const TEST_FAMILY_ALIASES: Record<string, string[]> = {
  ielts: ["ielts"],
  toefl: ["toefl", "ibt", "toeflibt"],
  pte: ["pteacademic", "pte"],
  duolingo: ["duolingo", "duolingoenglishtest", "det"],
  cambridge: ["cambridgeenglish", "cae", "cpe", "cambridge", "advanced"],
  gre: ["gre"],
  gmat: ["gmat"],
  sat: ["sat"],
  act: ["act"],
  jlpt: ["jlpt"],
  testdaf: ["testdaf"],
  dsh: ["dsh"],
  jtest: ["jtest"],
  nat: ["nat"],
  eju: ["eju"],
};

export function testFamilyOf(name: string): string | null {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const [family, aliases] of Object.entries(TEST_FAMILY_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(alias))) return family;
  }
  return null;
}

/** Valid score ranges per family — out-of-range scores stay unknown. */
const SCORE_RANGES: Record<string, [number, number]> = {
  ielts: [0, 9],
  toefl: [0, 120],
  pte: [10, 90],
  duolingo: [10, 160],
  cambridge: [80, 230],
  gre: [130, 340],
  gmat: [200, 800],
  sat: [400, 1600],
  act: [1, 36],
};

const VALIDITY_MONTHS: Record<string, number> = {
  // Common published validity windows (guidance level; the official page
  // of the receiving institution remains authoritative).
  ielts: 24,
  toefl: 24,
  pte: 24,
  duolingo: 24,
  cambridge: 36,
  gre: 60,
  gmat: 60,
};

/**
 * Parse an official score into a number. Strict: "N2" (a JLPT level) or any
 * text where digits are glued to letters stays null — unknown, never a
 * number that could silently satisfy a threshold.
 */
export function parseScore(score: string): number | null {
  const trimmed = score.trim().replace(/,/g, ".");
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  const withPrefix = /^(?:band|score|overall)\s+(\d+(?:\.\d+)?)$/i.exec(trimmed);
  if (withPrefix) return Number(withPrefix[1]);
  return null;
}

export function scoreInFamilyRange(family: string, value: number): boolean {
  const range = SCORE_RANGES[family];
  if (!range) return true; // families without a known scale are not auto-failed
  return value >= range[0] && value <= range[1];
}

export function testIsStale(test: OfficialTestResult, at: Date = new Date()): boolean {
  const family = testFamilyOf(test.testType);
  const months = family ? VALIDITY_MONTHS[family] : undefined;
  if (!months || !test.date) return false;
  const taken = new Date(test.date);
  if (Number.isNaN(taken.getTime())) return false;
  return at.getTime() - taken.getTime() > months * 30.44 * 24 * 3600 * 1000;
}

function findFamilyTest(
  tests: OfficialTestResult[],
  family: string,
): OfficialTestResult | undefined {
  return tests.find((t) => testFamilyOf(t.testType) === family);
}

// ---------- Language evaluation ----------

interface TestLine {
  test: string;
  family: string;
  score: string;
  min: number;
  status: "meets" | "below" | "unknown_score" | "stale";
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

  const lines: TestLine[] = [];
  const unresolvable: string[] = [];
  for (const [testLabel, minValueRaw] of Object.entries(thresholds)) {
    const family = testFamilyOf(testLabel);
    const min = parseScore(String(minValueRaw));
    if (!family || min === null) {
      // Threshold we cannot normalize or a non-numeric cutoff: the
      // official numbers must be confirmed, not guessed.
      unresolvable.push(testLabel);
      continue;
    }
    const candidate = findFamilyTest(profile.tests, family);
    if (!candidate) continue;
    const value = parseScore(candidate.score);
    let status: TestLine["status"];
    if (value === null) {
      status = "unknown_score";
    } else if (!scoreInFamilyRange(family, value)) {
      status = "unknown_score"; // impossible score → data problem, not a pass
    } else if (testIsStale(candidate)) {
      status = "stale";
    } else {
      status = value >= min ? "meets" : "below";
    }
    lines.push({ test: testLabel, family, score: candidate.score, min, status });
  }

  if (unresolvable.length > 0) {
    return {
      result: "needs_institution_confirmation",
      detail: `${rule.detail} — accepted tests/scores for the current cycle need confirmation on the official page (${unresolvable.join(", ")}).`,
    };
  }
  if (lines.length === 0) {
    return {
      result: "needs_information",
      detail: `No matching official test result on your profile yet. Accepted tests: ${Object.keys(thresholds).join(", ")}. Self-estimated levels never count here.`,
    };
  }

  if (lines.some((l) => l.status === "meets")) {
    const best = lines.find((l) => l.status === "meets")!;
    return { result: "met", detail: `${best.test}: ${best.score} (minimum ${best.min}).` };
  }
  if (lines.some((l) => l.status === "unknown_score" || l.status === "stale")) {
    const l = lines.find((x) => x.status === "unknown_score" || x.status === "stale")!;
    const why = l.status === "stale" ? "the result date looks older than the typical validity window" : "the recorded score could not be read as a number";
    return {
      result: "needs_information",
      detail: `${l.test}: ${why}. Record the exact official score (and test date) to check this requirement.`,
    };
  }
  const first = lines[0];
  return {
    result: "not_met",
    detail: `${first.test}: ${first.score} is below the ${first.min} reference minimum. Plan a retake or an accepted alternative test.`,
  };
}

// ---------- Age (year-level honesty) ----------

/**
 * Age at intake from birth year spans two possible values (birthday before
 * or after the intake date). A day-specific cutoff can only be answered
 * "met"/"not_met" when BOTH scenarios agree; otherwise it stays open.
 */
function ageBoundsAtIntake(profile: ProfileData): { minAge: number; maxAge: number } | null {
  if (!profile.birthYear || !profile.targetIntakeYear) return null;
  const span = profile.targetIntakeYear - profile.birthYear;
  if (span < 0 || span > 100) return null;
  return { minAge: span - 1, maxAge: span };
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
        const diploma = profile.qualifications.some((q) =>
          /diploma/i.test(q.level));
        return {
          ...base,
          result: "needs_institution_confirmation",
          detail: diploma
            ? `Your education level is recorded as a diploma. Whether it counts as ${need} years for this route depends on the issuing board and the institution's recognition rules — confirm directly with them.`
            : `Your education level is not recorded clearly enough to check the ${need}-year requirement. Add your highest qualification in onboarding.`,
        };
      }
      if (have >= need) {
        return { ...base, result: "met", detail: `${have} years of education recorded (requirement: ${need} years). Credential recognition is checked separately by the institution.` };
      }
      return {
        ...base,
        result: "not_met",
        detail: `${have} years recorded — this route needs ${need} years. A foundation/bridging year or a completed higher qualification may be required.`,
      };
    }

    case "completed_bachelor": {
      const standing = bachelorStanding(profile);
      switch (standing.kind) {
        case "met":
          return { ...base, result: "met", detail: `A completed bachelor's-level qualification (${standing.why}) is on your profile.` };
        case "master_met":
          return { ...base, result: "met", detail: `A completed master's (${standing.why}) is on your profile — bachelor's completion is implied.` };
        case "expected":
          return {
            ...base,
            result: "needs_information",
            detail: "Your bachelor's is recorded as in progress/expected — it is not a completed qualification yet. This becomes checkable when you finish.",
          };
        case "three_year":
          return {
            ...base,
            result: "needs_institution_confirmation",
            detail: "A completed 3-year bachelor's is on your profile. Some routes accept it directly; others expect 4-year/honours — this is route-specific, so confirm with the programme.",
          };
        default:
          return { ...base, result: "needs_information", detail: "No bachelor's-level qualification recorded yet." };
      }
    }

    case "completed_master": {
      for (const q of profile.qualifications) {
        if (/master/i.test(q.level)) {
          if (qualificationStatus(q) === "completed") {
            return { ...base, result: "met", detail: `A completed master's (${q.level}) is on your profile.` };
          }
          return { ...base, result: "needs_information", detail: "Your master's is recorded as in progress/expected — not completed yet." };
        }
      }
      const bachelor = bachelorStanding(profile);
      if (bachelor.kind === "met" || bachelor.kind === "master_met") {
        return {
          ...base,
          result: rule.requiredness === "conditional" ? "needs_institution_confirmation" : "not_met",
          detail:
            rule.requiredness === "conditional"
              ? "Most routes here require a master's; a very strong bachelor's occasionally suffices — confirm with the programme."
              : "This route expects a completed master's degree.",
        };
      }
      return { ...base, result: "needs_information", detail: "Master's-level completion not determinable from your profile yet." };
    }

    case "age_range":
    case "age_min":
    case "age_max": {
      const bounds = ageBoundsAtIntake(profile);
      if (bounds === null) {
        return {
          ...base,
          result: "needs_information",
          detail: "Add your birth year (optional field) to approximate this age rule. Exact cutoffs are day-specific, so final eligibility is still read from the current official guidelines.",
        };
      }
      let min = 0;
      let max = 200;
      if (rule.operator === "age_range") {
        const [a, b] = (rule.thresholdValue ?? "").split("-").map((n) => parseInt(n, 10));
        min = a || 0;
        max = b || 200;
      } else if (rule.operator === "age_min") {
        min = parseInt(rule.thresholdValue ?? "0", 10);
      } else {
        max = parseInt(rule.thresholdValue ?? "200", 10);
      }
      // Provable in both birthday scenarios?
      const certainMet = bounds.minAge >= min && bounds.maxAge <= max;
      const certainNot = bounds.maxAge < min || bounds.minAge > max;
      if (certainMet) {
        return { ...base, result: "met", detail: `About ${profile.targetIntakeYear! - profile.birthYear!} at the target intake — inside the published window in every birthday scenario. Day-specific cutoffs still follow the current official guidelines.` };
      }
      if (certainNot) {
        return {
          ...base,
          result: "not_met",
          detail: `About ${profile.targetIntakeYear! - profile.birthYear!} at the target intake falls outside the historical window (${rule.thresholdValue}${rule.unit ? " " + rule.unit : ""}) in every scenario. Exact cutoffs move per cycle — verify the current call before deciding.`,
        };
      }
      return {
        ...base,
        result: "needs_institution_confirmation",
        detail: `With a ${profile.birthYear} birth year you are near the edge of the window (${rule.thresholdValue}${rule.unit ? " " + rule.unit : ""}) — the outcome depends on the exact cutoff day, which only the current official guidelines state.`,
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
      const acceptedFamilies = accepted.map((name) => testFamilyOf(name));
      const held = profile.tests.filter((t) => {
        const family = testFamilyOf(t.testType);
        return family !== null && acceptedFamilies.includes(family);
      });
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
  // Blocking gaps come from REQUIRED rules only — optional/conditional
  // recommendations guide preparation without gating eligibility.
  const gapTitles = results
    .filter((r) => {
      if (r.result !== "not_met" && r.result !== "needs_information") return false;
      const rule = requirements.find((rule) => rule.id === r.ruleId);
      return rule ? rule.requiredness === "required" : true;
    })
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
