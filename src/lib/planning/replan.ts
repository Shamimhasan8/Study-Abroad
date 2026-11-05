/**
 * Replan contract — ONE shared, discriminated response schema for plan
 * generation, parsed at the API boundary and reused verbatim by the client
 * (docs/PREMIUM_03_AUDIT defect: the server returned `data.preview` while
 * the component read `preview.plan`, so the confirmation gate never
 * rendered).
 *
 * Semantics (implementation contract B.1):
 * - `kind: "plan"`        — a plan was generated/applied; `plan` is live.
 * - `kind:"confirmation"` — a replan proposal REQUIRES explicit review.
 *   `previewToken` names a server-persisted proposal; `proposalHash` is a
 *   sha256 over the persisted preview JSON. Confirm MUST send both back;
 *   the server applies EXACTLY the persisted tasks (never a regenerated
 *   proposal), re-merging only completed/edited work from the CURRENT
 *   active plan so late progress is never lost. Cancel mutates nothing.
 * - `stale_preview` (HTTP 409) — the token is missing, expired, or the
 *   echoed hash disagrees; the client must fetch a fresh preview.
 */
import { z } from "zod";
import type { PlanData, PlanTask, TaskStatus } from "@/lib/types";

// ---------- Shared IO schemas (server response ⇄ client parse) ----------

export const taskCategoryIoSchema = z.enum([
  "language", "tests", "academic", "experience", "writing",
  "recommenders", "funding", "documents", "research", "logistics",
]);

export const planTaskIoSchema = z.object({
  id: z.string().min(1),
  stableKey: z.string().min(1),
  title: z.string().min(1),
  titleBn: z.string().optional(),
  purpose: z.string(),
  purposeBn: z.string().optional(),
  category: taskCategoryIoSchema,
  effortHours: z.number().min(0),
  dueDate: z.string().optional(),
  dateBasis: z.enum(["official", "estimated"]),
  status: z.enum(["todo", "in_progress", "done", "skipped"]),
  completedAt: z.string().optional(),
  notes: z.string().optional(),
  userEdited: z.boolean(),
  order: z.number().int().min(0),
});

export const planDataIoSchema = z.object({
  id: z.string().min(1),
  goalSlug: z.string().optional(),
  goalTitle: z.string().optional(),
  horizonMonths: z.number().int().min(1),
  generatedAt: z.string().min(1),
  engineVersion: z.string().min(1),
  infeasible: z.boolean(),
  feasibilityNote: z.string().optional(),
  tasks: z.array(planTaskIoSchema).max(200),
});

/** The persisted preview document: everything needed to re-serve or apply. */
export const planPreviewDocSchema = z.object({
  preview: planDataIoSchema,
  assumedIntake: z.boolean(),
});
export type PlanPreviewDoc = z.infer<typeof planPreviewDocSchema>;

export const preservedCountsSchema = z.object({
  completed: z.number().int().min(0),
  edited: z.number().int().min(0),
});

/** Success envelope for POST /api/plan/generate — the single contract. */
export const planGenerateOkSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("plan"),
    plan: planDataIoSchema,
    assumedIntake: z.boolean(),
    /** True when this plan is a SCENARIO PREVIEW: generated from
     * not-yet-saved constraints and NOT applied server-side. Cancel keeps
     * everything untouched; apply = save profile, then generate. */
    scenario: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("confirmation"),
    previewToken: z.string().min(8).max(64),
    proposalHash: z.string().min(8).max(64),
    preview: planDataIoSchema,
    assumedIntake: z.boolean(),
    preserved: preservedCountsSchema,
  }),
]);
export type PlanGenerateOk = z.infer<typeof planGenerateOkSchema>;
export type PlanConfirmation = Extract<PlanGenerateOk, { kind: "confirmation" }>;

/** Parse an unknown JSON envelope body into the contract (or null). */
export function parsePlanGenerateOk(body: unknown): PlanGenerateOk | null {
  const parsed = planGenerateOkSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

// ---------- Preservation merge (pure, unit-tested) ----------

export interface PreservedTask {
  status: TaskStatus;
  notes: string | null;
  userEdited: boolean;
  completedAt: Date | null;
}

/**
 * Merge preserved completed/edited work into a proposal's tasks by stable
 * key. Task DEFINITIONS (title, dates, effort, order…) come from the
 * proposal; STATUS/notes/userEdited come from the student's real work.
 * Tasks absent from the proposal (dropped by regeneration) lose nothing —
 * they simply are not in the new plan; tasks absent from preservation keep
 * the proposal's fresh state.
 */
export function mergePreservedTasks(
  proposed: PlanTask[],
  preserved: ReadonlyMap<string, PreservedTask>,
): PlanTask[] {
  return proposed.map((task) => {
    const prev = preserved.get(task.stableKey);
    if (!prev) return task;
    return {
      ...task,
      status: prev.status,
      notes: prev.notes ?? undefined,
      userEdited: prev.userEdited,
      completedAt: prev.completedAt
        ? prev.completedAt.toISOString()
        : undefined,
    };
  });
}

/** Count preserved work for the confirmation card copy. */
export function preservedCounts(preserved: ReadonlyMap<string, PreservedTask>): {
  completed: number;
  edited: number;
} {
  let completed = 0;
  let edited = 0;
  for (const p of preserved.values()) {
    if (p.status === "done") completed += 1;
    if (p.userEdited) edited += 1;
  }
  return { completed, edited };
}

// ---------- Canonical serialization (hash input) ----------

/**
 * Canonical, order-stable serialization of a preview document. Only
 * reviewable content is hashed — never `id`, `generatedAt`, or preview-only
 * placeholder ids, so an identical proposal is stable across regenerations
 * on the same day while ANY material change (title, dueDate, status,
 * notes, order…) changes the hash.
 */
export function canonicalPreviewJson(doc: PlanPreviewDoc): string {
  const canonical = {
    assumedIntake: doc.assumedIntake,
    plan: {
      goalSlug: doc.preview.goalSlug ?? null,
      goalTitle: doc.preview.goalTitle ?? null,
      horizonMonths: doc.preview.horizonMonths,
      engineVersion: doc.preview.engineVersion,
      infeasible: doc.preview.infeasible,
      feasibilityNote: doc.preview.feasibilityNote ?? null,
      tasks: [...doc.preview.tasks]
        .map((t) => ({
          stableKey: t.stableKey,
          title: t.title,
          titleBn: t.titleBn ?? null,
          purpose: t.purpose,
          category: t.category,
          effortHours: t.effortHours,
          dueDate: t.dueDate ?? null,
          dateBasis: t.dateBasis,
          status: t.status,
          notes: t.notes ?? null,
          userEdited: t.userEdited,
          order: t.order,
        }))
        .sort((a, b) =>
          a.stableKey === b.stableKey
            ? a.order - b.order
            : a.stableKey < b.stableKey
              ? -1
              : 1,
        ),
    },
  };
  return JSON.stringify(canonical);
}

/** Preview lifetime: a confirmation older than this must be re-reviewed. */
export const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

/** Error codes the client must distinguish (beyond HTTP status). */
export const REPLAN_ERRORS = {
  stalePreview: "stale_preview",
  tokenRequired: "preview_token_required",
  hashMismatch: "preview_hash_mismatch",
} as const;
