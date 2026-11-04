/**
 * Uraan planning engine — dependency-aware task scheduler.
 *
 * Back-plans curated templates from the target intake, adds gap-driven
 * tasks from the evaluation, respects weekly capacity, and refuses to
 * silently compress infeasible schedules. Official dates stay official;
 * everything else is a clearly-labelled suggested date.
 */
import type {
  EvaluationSummary,
  Opportunity,
  PlanData,
  PlanTask,
  ProfileData,
  TaskCategory,
} from "@/lib/types";
import { addDays, isoOf, monthsBetween, parseISODate, todayISO } from "@/lib/dates";
import { TASK_TEMPLATES } from "./templates";

export const PLAN_ENGINE_VERSION = "planning-1.0.0";

const ENGLISH_TESTS = ["ielts", "toefl", "duolingo", "cambridge", "pte"];

function hasEnglishTest(profile: ProfileData): boolean {
  return profile.tests.some((t) =>
    ENGLISH_TESTS.some((name) => t.testType.toLowerCase().includes(name)),
  );
}

function intakeDateOf(profile: ProfileData, fallbackMonths = 18): { date: Date; assumed: boolean } {
  const today = new Date();
  if (profile.targetIntakeYear) {
    const month = profile.targetIntakeTerm === "spring" ? 3 : 8; // April / September
    const date = new Date(profile.targetIntakeYear, month, 1);
    if (monthsBetween(today, date) >= 0) return { date, assumed: false };
    // intake already passed without a year bump → fall through to fallback
  }
  const fallback = new Date(today.getFullYear(), today.getMonth() + fallbackMonths, 1);
  return { date: fallback, assumed: true };
}

/** Anchor date for back-planning: earliest official deadline, else intake. */
function anchorDate(opportunity: Opportunity, intake: Date): Date {
  for (const d of opportunity.deadlines) {
    if (d.official && d.closeDate) {
      const parsed = parseISODate(d.closeDate);
      if (parsed) return parsed;
    }
  }
  return intake;
}

function categoryFromRuleCategory(ruleCategory: string): TaskCategory {
  switch (ruleCategory) {
    case "language": return "language";
    case "documentation": return "documents";
    case "funding": return "funding";
    case "competitiveness": return "experience";
    default: return "logistics";
  }
}

export interface GeneratedPlan {
  plan: Omit<PlanData, "id">;
  assumedIntake: boolean;
}

export function generatePlan(
  profile: ProfileData,
  opportunity: Opportunity,
  evaluation: EvaluationSummary | null,
): GeneratedPlan {
  const today = parseISODate(todayISO()) ?? new Date();
  const { date: intake, assumed } = intakeDateOf(profile);
  const anchor = anchorDate(opportunity, intake);
  const horizonMonths = Math.max(6, Math.min(24, monthsBetween(today, intake) || 18));

  const tasks: PlanTask[] = [];
  let order = 0;

  // ---------- Template tasks ----------
  const level = profile.degreeLevel;
  for (const template of TASK_TEMPLATES) {
    if (!template.levels.includes(level)) continue;
    if (template.countries && !template.countries.includes(opportunity.country)) continue;
    if (template.when === "no_official_english_test" && hasEnglishTest(profile)) continue;
    if (template.when === "self_funded" && opportunity.funding.length > 0) continue;

    const due = new Date(anchor);
    due.setMonth(due.getMonth() - template.monthsBefore);
    // A back-planned date in the past clamps to "start soon" rather than
    // silently compressing the whole plan.
    const minStart = addDays(today, 7);
    const finalDue = due < minStart ? minStart : due;

    tasks.push({
      id: "",
      stableKey: template.stableKey,
      title: template.title,
      titleBn: template.titleBn,
      purpose: template.purpose,
      purposeBn: template.purposeBn,
      category: template.category,
      effortHours: template.effortHours,
      dueDate: isoOf(finalDue),
      dateBasis: "estimated",
      status: "todo",
      userEdited: false,
      order: order++,
    });
  }

  // ---------- Gap-driven tasks from the evaluation ----------
  if (evaluation) {
    for (const result of evaluation.results) {
      if (result.result !== "not_met" && result.result !== "needs_information") continue;
      const due = addDays(today, 30);
      tasks.push({
        id: "",
        stableKey: `gap-${result.ruleId}`,
        title: `Resolve: ${result.title}`,
        titleBn: result.titleBn ? `মেটান: ${result.titleBn}` : undefined,
        purpose: result.detail,
        purposeBn: undefined,
        category: categoryFromRuleCategory(result.category),
        effortHours: 2,
        dueDate: isoOf(due),
        dateBasis: "estimated",
        status: "todo",
        userEdited: false,
        order: order++,
      });
    }
  }

  // ---------- Institution-confirmation task (honest unknowns) ----------
  if (evaluation && evaluation.counts.needsConfirm > 0) {
    tasks.push({
      id: "",
      stableKey: `confirm-${opportunity.slug}`,
      title: `Confirm ${evaluation.counts.needsConfirm} requirement(s) with the institution`,
      titleBn: `${evaluation.counts.needsConfirm}টি শর্ত প্রতিষ্ঠানের সাথে নিশ্চিত করুন`,
      purpose: "These requirements are outside automated checking. Email or check the official pages and record the answers — unconfirmed stays unconfirmed.",
      purposeBn: "এই শর্তগুলো স্বয়ংক্রিয় যাচাইয়ের বাইরে। অফিসিয়াল পাতা/ইমেইলে যাচাই করে উত্তর লিখুন — অনিশ্চিত অনিশ্চিতই থাকে।",
      category: "logistics",
      effortHours: 3,
      dueDate: isoOf(addDays(today, 21)),
      dateBasis: "estimated",
      status: "todo",
      userEdited: false,
      order: order++,
    });
  }

  // Official deadline task (when a real official date exists)
  const officialDeadline = opportunity.deadlines.find((d) => d.official && d.closeDate);
  if (officialDeadline?.closeDate) {
    tasks.push({
      id: "",
      stableKey: `official-deadline-${opportunity.slug}`,
      title: `Official deadline: ${officialDeadline.closeDate}`,
      titleBn: `অফিসিয়াল ডেডলাইন: ${officialDeadline.closeDate}`,
      purpose: "This date comes from an official source. Verify it once more on the official page, then treat it as fixed.",
      purposeBn: "এই তারিখটি অফিসিয়াল সূত্র থেকে। অফিসিয়াল পাতায় আরেকবার যাচাই করে এটিকে অপরিবর্তনীয় ধরুন।",
      category: "logistics",
      effortHours: 1,
      dueDate: officialDeadline.closeDate,
      dateBasis: "official",
      status: "todo",
      userEdited: false,
      order: order++,
    });
  }

  // ---------- Capacity feasibility (honest, never silent compression) ----------
  const weeks = Math.max(4, Math.round(monthsBetween(today, intake) * 4.33));
  const totalEffort = tasks.reduce((sum, t) => sum + t.effortHours, 0);
  let infeasible = false;
  let feasibilityNote: string | undefined;
  if (profile.weeklyHours && totalEffort > profile.weeklyHours * weeks) {
    infeasible = true;
    feasibilityNote =
      `Total preparation effort (~${Math.round(totalEffort)} h) exceeds your capacity (~${profile.weeklyHours} h/week × ${weeks} weeks ≈ ${profile.weeklyHours * weeks} h). Consider a later intake or fewer parallel targets — Uraan does not compress the schedule silently.`;
  }

  tasks.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  tasks.forEach((t, idx) => {
    t.order = idx;
  });

  return {
    plan: {
      goalSlug: opportunity.slug,
      goalTitle: opportunity.title,
      horizonMonths,
      generatedAt: new Date().toISOString(),
      engineVersion: PLAN_ENGINE_VERSION,
      infeasible,
      feasibilityNote,
      tasks,
    },
    assumedIntake: assumed,
  };
}

/** Phase label for a task relative to today (dashboard "current phase"). */
export function phaseOfTask(dueDate: string | undefined, today = new Date()): number {
  if (!dueDate) return 4;
  const parsed = parseISODate(dueDate);
  if (!parsed) return 4;
  const months = monthsBetween(today, parsed);
  if (months > 12) return 0;
  if (months > 6) return 1;
  if (months > 3) return 2;
  if (months > 0) return 3;
  return 4;
}

export const PHASE_LABELS: Record<"en" | "bn", string[]> = {
  en: ["Foundation", "Building", "Sharpening", "Final stretch", "Now / overdue"],
  bn: ["ভিত্তি", "গঠন", "ধারালো করা", "শেষ প্রসার", "এখনই / বকেয়া"],
};
