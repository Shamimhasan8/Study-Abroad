/**
 * Uraan planning engine — dependency-aware task scheduler. v2
 *
 * Audited repairs (docs/REPAIR_AUDIT.md):
 * - The back-planning anchor is the relevant FUTURE official deadline for
 *   the selected route/cycle — never the first deadline in the array (a
 *   closed early round cannot anchor a current plan). Deadline types
 *   (admission/scholarship/nomination/reference/test/document) stay
 *   distinct; a start-of-programme date is not a deadline.
 * - Term→month mapping is an explicitly labelled planning window, never
 *   presented as an official date (not every spring is April, but an
 *   approximate window needs a placeholder month that is marked assumed).
 * - Overdue preparation is rescheduled across the remaining horizon —
 *   never dumped into "next week".
 * - Capacity is checked weekly before the anchor; infeasible loads are
 *   flagged with a later-intake suggestion instead of silent compression.
 * - Official dates stay official; everything else is a clearly-labelled
 *   suggested date.
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

export const PLAN_ENGINE_VERSION = "planning-2.0.0";

const ENGLISH_TESTS = ["ielts", "toefl", "duolingo", "cambridge", "pte"];

function hasEnglishTest(profile: ProfileData): boolean {
  return profile.tests.some((t) =>
    ENGLISH_TESTS.some((name) => t.testType.toLowerCase().includes(name)),
  );
}

/** Priority order for anchoring: the main application deadline first. */
const DEADLINE_TYPE_PRIORITY = ["admission", "scholarship", "nomination", "document", "test", "reference"] as const;

interface DeadlineCandidate {
  date: Date;
  type: string;
  id: string;
}

/**
 * Anchor: earliest FUTURE official closing date, preferring application
 * (admission/scholarship) deadlines. Closed rounds are skipped entirely.
 */
export function anchorDeadline(opportunity: Opportunity, today: Date): DeadlineCandidate | null {
  const candidates: DeadlineCandidate[] = [];
  for (const d of opportunity.deadlines) {
    if (!d.official || !d.closeDate) continue;
    const parsed = parseISODate(d.closeDate);
    if (!parsed) continue;
    if (parsed.getTime() <= today.getTime()) continue; // closed round — never anchors
    candidates.push({ date: parsed, type: d.type, id: d.id });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const rankA = DEADLINE_TYPE_PRIORITY.indexOf(a.type as (typeof DEADLINE_TYPE_PRIORITY)[number]);
    const rankB = DEADLINE_TYPE_PRIORITY.indexOf(b.type as (typeof DEADLINE_TYPE_PRIORITY)[number]);
    if (rankA !== rankB && rankA !== -1 && rankB !== -1) return rankA - rankB;
    return a.date.getTime() - b.date.getTime();
  });
  return candidates[0];
}

function intakeDateOf(profile: ProfileData, fallbackMonths = 18): { date: Date; assumed: boolean } {
  const today = new Date();
  if (profile.targetIntakeYear) {
    // Rough planning window only: labelled assumed because programme start
    // months vary by institution; official dates come from the source page.
    // Spring = April (month index 3), matching the published onboarding
    // label "Spring (April)" — previously this used May, disagreeing with
    // the UI by a month. Fall stays September.
    const month = profile.targetIntakeTerm === "spring" ? 3 : 9;
    const date = new Date(profile.targetIntakeYear, month, 1);
    if (monthsBetween(today, date) >= 0) return { date, assumed: true };
    // intake already passed without a year bump → fall through to fallback
  }
  const fallback = new Date(today.getFullYear(), today.getMonth() + fallbackMonths, 1);
  return { date: fallback, assumed: true };
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
  /** True when no open official round exists for the selected route. */
  noOpenRound: boolean;
}

export function generatePlan(
  profile: ProfileData,
  opportunity: Opportunity,
  evaluation: EvaluationSummary | null,
): GeneratedPlan {
  const today = parseISODate(todayISO()) ?? new Date();
  const { date: intake, assumed } = intakeDateOf(profile);
  const anchorCandidate = anchorDeadline(opportunity, today);
  const anchor = anchorCandidate ? anchorCandidate.date : intake;
  const noOpenRound = !anchorCandidate;
  const horizonMonths = Math.max(6, Math.min(24, monthsBetween(today, intake) || 18));

  const tasks: PlanTask[] = [];
  const overdue: PlanTask[] = [];
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

    const task: PlanTask = {
      id: template.stableKey,
      stableKey: template.stableKey,
      title: template.title,
      titleBn: template.titleBn,
      purpose: template.purpose,
      purposeBn: template.purposeBn,
      category: template.category,
      effortHours: template.effortHours,
      dueDate: isoOf(due),
      dateBasis: "estimated",
      status: "todo",
      userEdited: false,
      order: order++,
    };
    if (due < today) overdue.push(task);
    else tasks.push(task);
  }

  // ---------- Reschedule overdue prep across remaining time ----------
  if (overdue.length > 0) {
    const weeksToAnchor = Math.max(2, Math.round((anchor.getTime() - today.getTime()) / (7 * 864e5)));
    // Spread across up to a third of the remaining horizon (min 2, max 8 weeks)
    // — overdue work is never dumped into a single "next week".
    const spreadWeeks = Math.min(8, Math.max(2, Math.floor(weeksToAnchor / 3)));
    overdue.forEach((task, i) => {
      const slotWeek = Math.max(1, Math.round(((i + 1) * spreadWeeks) / overdue.length));
      const rescheduled = addDays(today, slotWeek * 7);
      const capped = rescheduled > anchor ? anchor : rescheduled;
      task.dueDate = isoOf(capped);
      tasks.push(task);
    });
  }

  // ---------- Gap-driven tasks from the evaluation ----------
  if (evaluation) {
    for (const result of evaluation.results) {
      if (result.result !== "not_met" && result.result !== "needs_information") continue;
      const due = addDays(today, 30);
      tasks.push({
        id: `gap-${result.ruleId}`,
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
      id: `confirm-${opportunity.slug}`,
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

  // ---------- Official deadline task (the future one that anchors) ----------
  if (anchorCandidate) {
    tasks.push({
      id: `official-deadline-${anchorCandidate.id}`,
      stableKey: `official-deadline-${anchorCandidate.id}`,
      title: `Official ${anchorCandidate.type} deadline: ${isoOf(anchorCandidate.date)}`,
      titleBn: `অফিসিয়াল ${anchorCandidate.type} ডেডলাইন: ${isoOf(anchorCandidate.date)}`,
      purpose: "This date comes from an official source. Verify it once more on the official page, then treat it as fixed.",
      purposeBn: "এই তারিখটি অফিসিয়াল সূত্র থেকে। অফিসিয়াল পাতায় আরেকবার যাচাই করে এটিকে অপরিবর্তনীয় ধরুন।",
      category: "logistics",
      effortHours: 1,
      dueDate: isoOf(anchorCandidate.date),
      dateBasis: "official",
      status: "todo",
      userEdited: false,
      order: order++,
    });
  }

  // ---------- Capacity feasibility ----------
  const weeks = Math.max(4, Math.round(monthsBetween(today, anchor) * 4.33));
  const totalEffort = tasks.reduce((sum, t) => sum + t.effortHours, 0);
  let infeasible = false;
  let feasibilityNote: string | undefined;
  if (profile.weeklyHours && totalEffort > profile.weeklyHours * weeks) {
    infeasible = true;
    feasibilityNote =
      `Total preparation effort (~${Math.round(totalEffort)} h) exceeds your capacity (~${profile.weeklyHours} h/week × ${weeks} weeks ≈ ${profile.weeklyHours * weeks} h) before the anchoring deadline. Consider a later intake or fewer parallel targets — Uraan does not compress the schedule silently.`;
  }

  if (noOpenRound) {
    feasibilityNote = [
      "No official round is currently open for this route — the plan uses an approximate preparation window anchored on your target intake.",
      "Dates are planning aids only; the next official cycle's dates must come from the official page (never guessed here).",
      feasibilityNote ?? "",
    ]
      .filter(Boolean)
      .join(" ");
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
    assumedIntake: assumed || noOpenRound,
    noOpenRound,
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
