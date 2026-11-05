/**
 * Shared boundary validation — every API route parses input through these
 * schemas before touching the database.
 */
import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email();

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: emailSchema,
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

const qualificationSchema = z.object({
  level: z.string().min(1).max(120),
  institution: z.string().max(160).default(""),
  scale: z.string().max(120).default(""),
  grades: z.string().max(240).default(""),
  year: z.string().max(20).optional(),
  expectedYear: z.string().max(20).optional(),
  gapMonths: z.number().int().min(0).max(360).optional(),
  subjects: z.string().max(400).optional(),
});

const languageAbilitySchema = z.object({
  language: z.string().min(1).max(60),
  selfLevel: z.enum(["beginner", "intermediate", "advanced", "fluent"]),
});

const testResultSchema = z.object({
  testType: z.string().min(1).max(80),
  score: z.string().min(1).max(60),
  date: z.string().max(20).optional(),
});

export const profileSchema = z.object({
  degreeLevel: z.enum(["bachelor", "master", "phd", "undecided"]),
  fieldInterests: z.array(z.string().max(80)).max(20).default([]),
  targetIntakeYear: z.number().int().min(2025).max(2035).optional(),
  targetIntakeTerm: z.enum(["fall", "spring"]).optional(),
  intakeFlexible: z.boolean().default(true),
  citizenships: z.array(z.string().max(60)).max(5).default([]),
  residence: z.string().max(60).optional(),
  qualificationCountry: z.string().max(60).optional(),
  uiLanguage: z.enum(["en", "bn"]).default("en"),
  birthYear: z.number().int().min(1940).max(2015).optional(),
  qualifications: z.array(qualificationSchema).max(6).default([]),
  languages: z.array(languageAbilitySchema).max(8).default([]),
  tests: z.array(testResultSchema).max(10).default([]),
  annualContributionBdt: z.number().int().min(0).max(100_000_000).optional(),
  upfrontFundsBdt: z.number().int().min(0).max(100_000_000).optional(),
  financeUncertain: z.boolean().default(false),
  countryPrefs: z.array(z.string().max(60)).max(10).default([]),
  instructionLang: z.enum(["english", "german", "japanese", "any"]).default("any"),
  willingToLearnLang: z.boolean().default(false),
  weeklyHours: z.number().int().min(1).max(80).optional(),
  workExperienceYears: z.number().int().min(0).max(50).optional(),
  responsibilities: z.string().max(400).optional(),
  onboardingCompleted: z.boolean().default(false),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const mergeGuestSchema = z.object({
  /** Client-generated idempotency key — one per guest data snapshot. */
  importId: z.string().min(8).max(64),
  /** Retry with this flag only after the user saw and accepted a 409 conflict preview. */
  confirmReplace: z.boolean().default(false),
  profile: profileSchema.nullable().optional(),
  plan: z
    .object({
      goalSlug: z.string().max(120).optional(),
      goalTitle: z.string().max(240).optional(),
      horizonMonths: z.number().int().min(1).max(60),
      infeasible: z.boolean().default(false),
      feasibilityNote: z.string().max(600).optional(),
      tasks: z
        .array(
          z.object({
            stableKey: z.string().min(1).max(120),
            title: z.string().min(1).max(240),
            titleBn: z.string().max(240).optional(),
            purpose: z.string().max(1200).default(""),
            purposeBn: z.string().max(1200).optional(),
            category: z.string().max(40),
            effortHours: z.number().min(0).max(500).default(1),
            dueDate: z.string().max(20).optional(),
            dateBasis: z.enum(["official", "estimated"]).default("estimated"),
            status: z.enum(["todo", "in_progress", "done", "skipped"]).default("todo"),
            notes: z.string().max(1000).optional(),
            userEdited: z.boolean().default(false),
            order: z.number().int().min(0).default(0),
          }),
        )
        .max(120),
    })
    .nullable()
    .optional(),
  shortlist: z.array(z.string().max(120)).max(30).default([]),
  goalSlug: z.string().max(120).nullish(),
  applications: z
    .array(
      z.object({
        opportunitySlug: z.string().min(1).max(120),
        opportunityTitle: z.string().min(1).max(240),
        status: z.enum(["draft", "preparing", "ready", "submitted", "awaiting", "closed"]).default("draft"),
        intendedIntake: z.string().max(40).optional(),
        notes: z.string().max(2000).optional(),
      }),
    )
    .max(30)
    .default([]),
});

export const applicationSchema = z.object({
  opportunitySlug: z.string().min(1).max(120),
  opportunityTitle: z.string().min(1).max(240),
  status: z.enum(["draft", "preparing", "ready", "submitted", "awaiting", "closed"]).default("draft"),
  intendedIntake: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
});

export const applicationPatchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["draft", "preparing", "ready", "submitted", "awaiting", "closed"]).optional(),
  notes: z.string().max(2000).optional(),
  intendedIntake: z.string().max(40).optional(),
});

export const taskPatchSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(["todo", "in_progress", "done", "skipped"]).optional(),
  notes: z.string().max(1000).optional(),
  userEdited: z.boolean().optional(),
});

export const draftSchema = z.object({
  id: z.string().min(1).optional(),
  kind: z.enum(["essay", "sop", "research"]),
  title: z.string().min(1).max(200),
  institutionPrompt: z.string().max(1000).optional(),
  wordLimit: z.number().int().min(50).max(5000).optional(),
  aiPolicy: z.enum(["unknown", "allowed", "prohibited"]).default("unknown"),
  content: z.string().max(40000).default(""),
});

export const experienceSchema = z.object({
  id: z.string().min(1).optional(),
  kind: z.enum(["project", "work", "community", "family", "creative"]),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  reflection: z.string().max(4000).optional(),
  startDate: z.string().max(20).optional(),
  endDate: z.string().max(20).optional(),
  links: z.array(z.string().url().max(300)).max(5).default([]),
});

export const recommenderSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).max(120),
  role: z.string().max(120).optional(),
  relationship: z.string().max(240).optional(),
  status: z.enum(["planned", "drafted", "sent_user", "confirmed", "declined"]).default("planned"),
  requestDraft: z.string().max(4000).optional(),
});

export const researchNoteSchema = z.object({
  interestStatement: z.string().max(4000).optional(),
  readingLog: z
    .array(z.object({ id: z.string().min(1).max(60), title: z.string().min(1).max(300), takeaway: z.string().max(1000).optional(), addedAt: z.string().max(30) }))
    .max(200)
    .default([]),
  projectSummary: z.string().max(4000).optional(),
  facultyFitNotes: z.string().max(8000).optional(),
  outreachDraft: z.string().max(4000).optional(),
});

export const languageLogSchema = z.object({
  skill: z.enum(["reading", "writing", "listening", "speaking", "grammar", "vocab"]),
  minutes: z.number().int().min(1).max(600),
  note: z.string().max(500).optional(),
  date: z.string().max(20),
});

export const evaluateSchema = z.object({
  slug: z.string().min(1).max(120),
  profile: profileSchema.optional(), // guests send their profile
});

export const planGenerateSchema = z.object({
  slug: z.string().min(1).max(120),
  profile: profileSchema.optional(),
  confirmReplace: z.boolean().default(false),
  /** Required with confirmReplace: the persisted preview token from the
   * confirmation response (single replan contract — see planning/replan.ts). */
  previewToken: z.string().min(8).max(64).optional(),
});

export const aiExplainSchema = z.object({
  slug: z.string().min(1).max(120),
  lang: z.enum(["en", "bn"]).default("en"),
  profile: profileSchema.optional(),
});

export const aiPracticeSchema = z.object({
  text: z.string().min(20).max(8000),
  lang: z.enum(["en", "bn"]).default("en"),
});

export const aiDraftFeedbackSchema = z.object({
  draftId: z.string().min(1).max(60),
  lang: z.enum(["en", "bn"]).default("en"),
});

export const documentPurposeSchema = z.enum([
  "transcript",
  "certificate",
  "test_score",
  "essay_draft",
  "research",
  "financial",
  "other",
]);

export function badRequest(message: string) {
  return Response.json({ ok: false, error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
}

export function unauthorized() {
  return Response.json({ ok: false, error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

export function notFound() {
  return Response.json({ ok: false, error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
}

/** Short opaque request ID for support/reference — never a secret. */
export function newRequestId(): string {
  return globalThis.crypto?.randomUUID?.().slice(0, 8) ?? String(Date.now()).slice(-8) + Math.floor(Math.random() * 1e4);
}

/**
 * 503 envelope for dependency failures (database/storage unreachable).
 * The client can show a retryable service state instead of a blank 500.
 */
export function serviceUnavailable() {
  return Response.json(
    { ok: false, error: "service_unavailable", requestId: newRequestId(), retryable: true },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export function serverError() {
  return Response.json(
    { ok: false, error: "server_error", requestId: newRequestId(), retryable: true },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Wrap a data route: any thrown error becomes a sanitized 503 envelope with
 * a request ID. No stack traces or driver messages ever reach the client.
 */
export async function dataRoute(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch {
    return serviceUnavailable();
  }
}

/** Public, deliberately cacheable JSON (bounded staleness only). */
export function publicJson(data: unknown, maxAgeSeconds = 60) {
  return Response.json({ ok: true, data }, {
    headers: { "Cache-Control": `public, max-age=${maxAgeSeconds}` },
  });
}
