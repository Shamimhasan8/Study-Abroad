/**
 * Uraan AI features — evidence-bound, deterministic-core-respecting.
 * Each feature degrades to a clearly-labelled template when the provider
 * is unavailable; canned text is never shown as live AI.
 */
import { z } from "zod";
import { extractJson } from "./provider";
import type {
  EvaluationSummary,
  LanguageAbility,
  OfficialTestResult,
  Opportunity,
  PracticeFeedback,
  ProfileData,
  Qualification,
} from "@/lib/types";
import { complete } from "./provider";

// ---------- Plan / gap explanation ----------

export async function explainEvaluation(params: {
  profile: ProfileData;
  evaluation: EvaluationSummary;
  opportunity: Opportunity;
  lang: "en" | "bn";
  userId?: string;
  ip?: string;
}): Promise<{ ok: true; explanation: string } | { ok: false; error: string }> {
  const { profile, evaluation, opportunity, lang, userId, ip } = params;

  // Non-identifying snapshot only: no name, email, or documents.
  const ruleLines = evaluation.results
    .filter((r) => r.result !== "not_applicable")
    .map((r) => `- [${r.result}] ${r.title}: ${r.detail.slice(0, 220)}`)
    .join("\n");

  const system =
    lang === "bn"
      ? "আপনি উড়ান নামের একটি পড়াশোনা-প্রস্তুতি প্ল্যাটফর্মের ব্যাখ্যাকারী। আপনি নির্ধারিত (deterministic) ফলাফল 'ব্যাখ্যা' করেন — কখনো বদলান না। কঠিন নিয়ম: ভর্তি বা বৃত্তির নিশ্চয়তা, সম্ভাব্যতার শতাংশ বা ওয়াদা দেবেন না। অজানা জিনিস অজানা থাকবে। সরল, উষ্ণ, সৎ বাংলায় ৪–৬ ছোট অনুচ্ছেদে লিখুন।"
      : "You are the explainer for Uraan, a study-abroad preparation platform. You EXPLAIN deterministic results — never override them. Hard rules: never promise or imply admission, scholarships, or probabilities; unknowns stay unknown. Write 4–6 short, warm, honest paragraphs in plain English for a beginner.";

  const user = [
    `Student goal: ${opportunity.title} (${opportunity.countryLabel}).`,
    `Degree level: ${profile.degreeLevel}. Target intake: ${profile.targetIntakeYear ?? "not set"} ${profile.targetIntakeTerm ?? ""}.`,
    `Citizenship: ${profile.citizenships.join(", ") || "not set"}. Qualification country: ${profile.qualificationCountry ?? "not set"}.`,
    profile.tests.length
      ? `Official tests: ${profile.tests.map((t: OfficialTestResult) => `${t.testType} ${t.score}`).join("; ")}`
      : "Official tests: none yet.",
    `Qualifications: ${profile.qualifications.map((q: Qualification) => `${q.level} (${q.grades || "grades not stated"})`).join("; ") || "none recorded"}.`,
    `Languages (self-estimated, never official): ${profile.languages.map((l: LanguageAbility) => `${l.language}:${l.selfLevel}`).join(", ") || "none"}.`,
    "",
    "Deterministic evaluation results (explain these, do not change them):",
    ruleLines,
    "",
    lang === "bn"
      ? "ব্যাখ্যা করুন: (১) এখন পর্যন্ত কোথায় দাঁড়িয়ে আছেন, (২) কোন ফাঁকগুলো আগে ভরাট করা দরকার ও কেন, (৩) কোন বিষয় প্রতিষ্ঠানের সাথে নিশ্চিত করতে হবে, (৪) একটি বাস্তবসম্মত পরের পদক্ষেপ। শেষে এক লাইনে মনে করিয়ে দিন যে চূড়ান্ত সিদ্ধান্ত প্রতিষ্ঠানের।"
      : "Explain: (1) where the student stands overall, (2) which gaps matter first and why, (3) what must be confirmed with the institution, (4) one realistic next step. End with a single reminder that final decisions belong to institutions.",
  ].join("\n");

  const result = await complete({ system, user, userId, ip, purpose: "explain_plan" });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, explanation: result.text.trim() };
}

/** Labelled template fallback when the provider is unavailable. */
export function templateExplanation(
  evaluation: EvaluationSummary,
  lang: "en" | "bn",
): string {
  const gaps = evaluation.gapTitles;
  if (lang === "bn") {
    return [
      "এটি একটি টেমপ্লেট ব্যাখ্যা — লাইভ AI ব্যাখ্যা এখন পাওয়া যাচ্ছে না। আপনার মূল্যায়ন ফলাফল নিচেই ঠিক আছে।",
      `এখন পর্যন্ত ${evaluation.counts.met}টি শর্ত মেটেছে, ${evaluation.counts.notMet}টি মেটেনি, ${evaluation.counts.needsInfo}টিতে আপনার তথ্য দরকার, ${evaluation.counts.needsConfirm}টি প্রতিষ্ঠানের সাথে নিশ্চিত করতে হবে।`,
      gaps.length ? `প্রথম ফাঁকগুলো: ${gaps.slice(0, 3).join("; ")}।` : "নথিভুক্ত শর্তে কোনো ফাঁক পাওয়া যায়নি।",
      "পরের পদক্ষেপ: অনবোর্ডিংয়ে অনুপস্থিত তথ্য যোগ করুন এবং প্রতিষ্ঠান-নিশ্চয়তার কাজগুলো অফিসিয়াল পাতায় যাচাই করুন।",
      "মনে রাখুন: সব শর্ত মেটাও ভর্তি বা বৃত্তি নিশ্চিত করে না — চূড়ান্ত সিদ্ধান্ত প্রতিষ্ঠানের।",
    ].join("\n\n");
  }
  return [
    "This is a template explanation — the live explanation service is currently unavailable. Your evaluation results are unaffected below.",
    `So far: ${evaluation.counts.met} requirements met, ${evaluation.counts.notMet} not met, ${evaluation.counts.needsInfo} need your input, ${evaluation.counts.needsConfirm} need institutional confirmation.`,
    gaps.length ? `First gaps to resolve: ${gaps.slice(0, 3).join("; ")}.` : "No gaps found among documented requirements.",
    "Next step: add the missing profile information in onboarding and verify institution-confirmation items on the official pages.",
    "Remember: meeting every documented check does not guarantee admission or funding — final decisions belong to institutions.",
  ].join("\n\n");
}

// ---------- Draft feedback ----------

export interface DraftFeedbackResult {
  strengths: string[];
  issues: string[];
  suggestions: string[];
  unsupportedClaims: string[];
  aiGenerated: boolean;
}

export async function draftFeedback(params: {
  kind: "essay" | "sop" | "research";
  prompt: string;
  wordLimit?: number;
  draft: string;
  profileFacts: string;
  lang: "en" | "bn";
  userId?: string;
  ip?: string;
}): Promise<{ ok: true; feedback: DraftFeedbackResult } | { ok: false; error: string }> {
  const { kind, prompt, wordLimit, draft, profileFacts, lang, userId, ip } = params;

  const label =
    kind === "essay" ? "an undergraduate personal essay" : kind === "sop" ? "a graduate statement of purpose" : "a PhD research statement";

  const system = [
    `You give targeted writing feedback on ${label} for a study-abroad applicant.`,
    "Hard rules: flag claims not supported by the student's own facts; never invent accomplishments, statistics, or programme details; never write the essay for the student; keep the student as the author.",
    'Reply ONLY with JSON of shape {"strengths": string[3], "issues": string[3-5], "suggestions": string[3-5], "unsupportedClaims": string[]}.',
  ].join(" ");

  const user = [
    `Institution prompt: ${prompt || "(none given)"}`,
    wordLimit ? `Word limit: ${wordLimit}` : "",
    `Student's own facts (ground truth for claim checking): ${profileFacts}`,
    "",
    `Draft (${draft.trim().split(/\s+/).length} words):`,
    draft.slice(0, 8000),
    "",
    lang === "bn" ? "সব ফিডব্যাক পয়েন্ট বাংলায় লিখুন (JSON কাঠামো ইংরেজি কী থাকবে)।" : "Write all feedback points in plain, kind, specific English.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await complete({ system, user, userId, ip, purpose: "draft_feedback", json: true });
  if (!result.ok) return { ok: false, error: result.error };

  // Strong output-schema validation: a malformed model reply fails safely
  // (caller degrades to an honest error state) — it is never half-parsed.
  const parsed = extractJson(result.text, draftFeedbackSchema.parse);
  if (!parsed) return { ok: false, error: "malformed_model_output" };
  return { ok: true, feedback: { ...parsed, aiGenerated: true } };
}

const draftFeedbackSchema = z.object({
  strengths: z.array(z.string().min(1).max(600)).min(0).max(6),
  issues: z.array(z.string().min(1).max(600)).min(0).max(8),
  suggestions: z.array(z.string().min(1).max(600)).min(0).max(8),
  unsupportedClaims: z.array(z.string().min(1).max(600)).min(0).max(10),
});

// ---------- Language practice feedback ----------

export async function practiceFeedback(params: {
  text: string;
  prompt: string;
  lang: "en" | "bn";
  userId?: string;
  ip?: string;
}): Promise<
  { ok: true; feedback: PracticeFeedback } | { ok: false; error: string }
> {
  const { text, prompt, lang, userId, ip } = params;
  const system = [
    "You assess ONE short English practice paragraph for a Bangladeshi student. This is practice feedback — explicitly NOT an official IELTS/TOEFL score and never a promise of results.",
    'Reply ONLY with JSON: {"estimatedLevel": "beginner|intermediate|advanced", "strengths": string[2-3], "improvements": string[2-4], "note": string}',
  ].join(" ");

  const user = `Practice prompt: ${prompt}\n\nStudent paragraph: ${text.slice(0, 4000)}\n\n${
    lang === "bn" ? "মান ইংরেজিতে, ব্যাখ্যা পয়েন্টগুলো বাংলায় লিখুন।" : "Keep feedback short and kind."
  }`;

  const result = await complete({ system, user, userId, ip, purpose: "practice_feedback", json: true });
  if (!result.ok) return { ok: false, error: result.error };

  const parsed = extractJson(result.text, practiceFeedbackSchema.parse);
  if (!parsed) return { ok: false, error: "malformed_model_output" };
  return {
    ok: true,
    feedback: {
      estimatedLevel: parsed.estimatedLevel,
      strengths: parsed.strengths,
      improvements: parsed.improvements,
      note: parsed.note,
      aiGenerated: true,
    },
  };
}

const practiceFeedbackSchema = z.object({
  estimatedLevel: z.enum(["beginner", "intermediate", "advanced"]),
  strengths: z.array(z.string().min(1).max(400)).min(0).max(5),
  improvements: z.array(z.string().min(1).max(400)).min(0).max(6),
  note: z.string().min(1).max(400),
});

export function templatePracticeFeedback(text: string): PracticeFeedback {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  return {
    // Deliberately NO estimated level: word/sentence counts are text
    // statistics, not a proficiency assessment. A level estimate comes
    // only from the live model or an official test — never from here.
    estimatedLevel: "",
    strengths: [
      words >= 100 ? "You wrote a full-length response — good stamina for timed writing." : "You put a complete idea on paper — the right starting point.",
      sentences >= 4 ? "Multiple sentences with varied structure." : "Clear single focus.",
    ],
    improvements: [
      "Check each sentence for one complete idea; split run-ons.",
      "Add one concrete example to make your point vivid.",
      "Re-read for subject–verb agreement before finalizing.",
    ],
    note: "Template structural feedback only — the live practice-assessment service is unavailable. This is not a score, and no proficiency level is estimated from word counts.",
    aiGenerated: false,
  };
}
