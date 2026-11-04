/**
 * Matching engine regression tests — the semantics the audit demanded.
 */
import { describe, expect, it } from "vitest";
import {
  evaluateOpportunity,
  evaluateRule,
  parseScore,
  scoreInFamilyRange,
  testFamilyOf,
  testIsStale,
} from "@/lib/matching/engine";
import type { ProfileData, RequirementRule } from "@/lib/types";

const baseProfile: ProfileData = {
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

const rule = (partial: Partial<RequirementRule>): RequirementRule => ({
  id: "test-rule",
  category: "admission",
  title: "Test rule",
  operator: "min_education_years",
  requiredness: "required",
  detail: "detail",
  ...partial,
});

describe("language test evaluation", () => {
  it("a null/NaN score can never satisfy a threshold (audited P1 bug)", () => {
    const result = evaluateRule(
      rule({
        category: "language",
        operator: "language_test_any",
        thresholdValue: JSON.stringify({ "IELTS Academic": "6.5" }),
      }),
      { ...baseProfile, tests: [{ testType: "IELTS Academic", score: "not-a-number" }] },
    );
    expect(result.result).toBe("needs_information");
  });

  it("an out-of-range score stays unknown, not a pass", () => {
    // IELTS 26 is impossible -> treated as a data problem
    const result = evaluateRule(
      rule({
        category: "language",
        operator: "language_test_any",
        thresholdValue: JSON.stringify({ "IELTS Academic": "6.5" }),
      }),
      { ...baseProfile, tests: [{ testType: "IELTS Academic", score: "26" }] },
    );
    expect(result.result).toBe("needs_information");
  });

  it("matches by test family, not substring 'English'", () => {
    const result = evaluateRule(
      rule({
        category: "language",
        operator: "language_test_any",
        thresholdValue: JSON.stringify({ "TOEFL iBT": "90" }),
      }),
      { ...baseProfile, tests: [{ testType: "TOEFL iBT", score: "95", date: "2026-01-10" }] },
    );
    expect(result.result).toBe("met");
    // A random 'English placement test' must not satisfy a TOEFL threshold
    const other = evaluateRule(
      rule({
        category: "language",
        operator: "language_test_any",
        thresholdValue: JSON.stringify({ "TOEFL iBT": "90" }),
      }),
      { ...baseProfile, tests: [{ testType: "English placement test", score: "95" }] },
    );
    expect(other.result).toBe("needs_information");
  });

  it("stale test results stay unknown", () => {
    expect(
      testIsStale({ testType: "IELTS Academic", score: "7", date: "2023-01-01" }, new Date("2026-11-04")),
    ).toBe(true);
    const result = evaluateRule(
      rule({
        category: "language",
        operator: "language_test_any",
        thresholdValue: JSON.stringify({ "IELTS Academic": "6.5" }),
      }),
      { ...baseProfile, tests: [{ testType: "IELTS Academic", score: "7", date: "2023-01-01" }] },
    );
    expect(result.result).toBe("needs_information");
  });

  it("test families normalize aliases", () => {
    expect(testFamilyOf("IELTS Academic")).toBe("ielts");
    expect(testFamilyOf("TOEFL iBT")).toBe("toefl");
    expect(testFamilyOf("Duolingo English Test")).toBe("duolingo");
    expect(testFamilyOf("Cambridge C1 Advanced")).toBe("cambridge");
    expect(testFamilyOf("GRE revised")).toBe("gre");
    expect(testFamilyOf("Some unrelated exam")).toBeNull();
  });

  it("score parsing and family ranges", () => {
    expect(parseScore("6.5")).toBe(6.5);
    expect(parseScore("band 6.5")).toBe(6.5); // extracts the numeric token
    expect(parseScore("N2")).toBeNull();
    expect(scoreInFamilyRange("ielts", 8)).toBe(true);
    expect(scoreInFamilyRange("ielts", 26)).toBe(false);
    expect(scoreInFamilyRange("toefl", 110)).toBe(true);
    expect(scoreInFamilyRange("toefl", 260)).toBe(false);
  });
});

describe("qualification semantics", () => {
  it("an unfinished degree is never completed just because its label says bachelor", () => {
    const result = evaluateRule(
      rule({ operator: "completed_bachelor" }),
      { ...baseProfile, qualifications: [{ level: "Bachelor of Science", institution: "", scale: "", grades: "", expectedYear: "2027" }] },
    );
    expect(result.result).toBe("needs_information");
  });

  it("a completed 4-year bachelor counts; a 3-year is route-specific", () => {
    const completed = evaluateRule(
      rule({ operator: "completed_bachelor" }),
      { ...baseProfile, qualifications: [{ level: "BSc honours", institution: "", scale: "", grades: "", year: "2025" }] },
    );
    expect(completed.result).toBe("met");

    const threeYear = evaluateRule(
      rule({ operator: "completed_bachelor" }),
      { ...baseProfile, qualifications: [{ level: "Bachelor 3-year pass", institution: "", scale: "", grades: "", year: "2025" }] },
    );
    expect(threeYear.result).toBe("needs_institution_confirmation");
  });

  it("diploma duration is unknown, not a universal 12-year pass", () => {
    const result = evaluateRule(
      rule({ operator: "min_education_years", thresholdValue: "12" }),
      { ...baseProfile, qualifications: [{ level: "Diploma in Engineering", institution: "", scale: "", grades: "", year: "2025" }] },
    );
    expect(result.result).toBe("needs_institution_confirmation");
  });

  it("in-progress master's is not a completed master's", () => {
    const result = evaluateRule(
      rule({ operator: "completed_master" }),
      { ...baseProfile, qualifications: [{ level: "MSc", institution: "", scale: "", grades: "", expectedYear: "2027" }] },
    );
    expect(result.result).toBe("needs_information");
  });
});

describe("age rules with day-level cutoffs", () => {
  const ageRule = (thresholdValue: string) =>
    rule({ operator: "age_range", thresholdValue, unit: "years" });

  it("birth year that proves the window in both birthday scenarios -> met", () => {
    // intake 2030 - birth 2004 => age 25 or 26 -> certainly inside 17-34
    const result = evaluateRule(
      ageRule("17-34"),
      { ...baseProfile, birthYear: 2004, targetIntakeYear: 2030 },
    );
    expect(result.result).toBe("met");
  });

  it("clearly outside in both scenarios -> not_met", () => {
    const result = evaluateRule(
      ageRule("17-24"),
      { ...baseProfile, birthYear: 1990, targetIntakeYear: 2030 },
    );
    expect(result.result).toBe("not_met");
  });

  it("a boundary-year birth stays open for confirmation, never a confident pass", () => {
    // intake 2030 - birth 2006 => age 23 or 24; window 17-23 straddles both
    const result = evaluateRule(
      ageRule("17-23"),
      { ...baseProfile, birthYear: 2006, targetIntakeYear: 2030 },
    );
    expect(result.result).toBe("needs_institution_confirmation");
  });

  it("no birth year -> needs information", () => {
    const result = evaluateRule(ageRule("17-24"), baseProfile);
    expect(result.result).toBe("needs_information");
  });
});

describe("optional rules never gate", () => {
  it("an optional miss is not a blocking gap", () => {
    const requirements = [
      rule({ id: "req-1", operator: "professional_experience_years", thresholdValue: "2", requiredness: "required" }),
      rule({ id: "opt-1", operator: "professional_experience_years", thresholdValue: "5", requiredness: "optional" }),
    ];
    // 1 year recorded: required threshold missed (gap) + optional target missed (guidance only)
    const summary = evaluateOpportunity(requirements, { ...baseProfile, workExperienceYears: 1 }, "test-slug");
    expect(summary.gapTitles).toHaveLength(1);
    expect(summary.counts.notMet).toBe(2);
  });
});

describe("unknown operator never silently passes", () => {
  it("returns needs_institution_confirmation", () => {
    const result = evaluateRule(rule({ operator: "quantum_entanglement" }), baseProfile);
    expect(result.result).toBe("needs_institution_confirmation");
  });
});
