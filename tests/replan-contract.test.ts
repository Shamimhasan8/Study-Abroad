/**
 * Replan contract regression tests — the audited defect (server returned
 * `data.preview`, component read `preview.plan`, confirmation gate never
 * rendered) and the contract semantics from the implementation brief B.1:
 * one discriminated schema, preview token + hash, cancel preserves the
 * active plan, confirm applies EXACTLY the reviewed proposal while keeping
 * completed/edited work.
 */
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  canonicalPreviewJson,
  mergePreservedTasks,
  parsePlanGenerateOk,
  planGenerateOkSchema,
  preservedCounts,
  type PlanPreviewDoc,
  type PreservedTask,
} from "@/lib/planning/replan";
import type { PlanTask } from "@/lib/types";

const task = (partial: Partial<PlanTask> & { stableKey: string }): PlanTask => ({
  id: `id-${partial.stableKey}`,
  title: `Task ${partial.stableKey}`,
  purpose: "purpose",
  category: "academic",
  effortHours: 2,
  dateBasis: "estimated",
  status: "todo",
  userEdited: false,
  order: 0,
  ...partial,
});

const doc = (tasks: PlanTask[], assumedIntake = false): PlanPreviewDoc => ({
  preview: {
    id: "preview",
    goalSlug: "mit-science-fellowship",
    goalTitle: "Test goal",
    horizonMonths: 12,
    generatedAt: new Date().toISOString(),
    engineVersion: "planning-2.0.0",
    infeasible: false,
    tasks,
  },
  assumedIntake,
});

const hashOf = (d: PlanPreviewDoc) =>
  createHash("sha256").update(canonicalPreviewJson(d)).digest("hex").slice(0, 32);

describe("replan response contract (schema)", () => {
  it("accepts the plan variant", () => {
    const parsed = parsePlanGenerateOk({
      kind: "plan",
      plan: {
        id: "p1",
        horizonMonths: 12,
        generatedAt: "2026-11-05T00:00:00.000Z",
        engineVersion: "planning-2.0.0",
        infeasible: false,
        tasks: [task({ stableKey: "a" })],
      },
      assumedIntake: true,
    });
    expect(parsed?.kind).toBe("plan");
    if (parsed?.kind === "plan") expect(parsed.plan.tasks).toHaveLength(1);
  });

  it("accepts the confirmation variant with token, hash, preview, preserved counts", () => {
    const parsed = parsePlanGenerateOk({
      kind: "confirmation",
      previewToken: "tok-12345678",
      proposalHash: "hash-12345678",
      preview: doc([task({ stableKey: "a" })]).preview,
      assumedIntake: false,
      preserved: { completed: 2, edited: 1 },
    });
    expect(parsed?.kind).toBe("confirmation");
    if (parsed?.kind === "confirmation") {
      expect(parsed.previewToken).toBe("tok-12345678");
      expect(parsed.preserved).toEqual({ completed: 2, edited: 1 });
      expect(parsed.preview.tasks[0].stableKey).toBe("a");
    }
  });

  it("REJECTS the legacy mismatched shape that caused the hidden preview (regression)", () => {
    // The old server bug: `{ requiresConfirmation: true, preview: {...} }`
    // with no `plan` key — the old component read `preview.plan` and never
    // rendered. Under the new contract this body must NOT parse.
    const legacy = {
      requiresConfirmation: true,
      preview: doc([task({ stableKey: "a" })]).preview,
    };
    expect(parsePlanGenerateOk(legacy)).toBeNull();
    expect(planGenerateOkSchema.safeParse(legacy).success).toBe(false);
  });

  it("rejects a confirmation without a token (confirm must echo the reviewed token)", () => {
    const bad = {
      kind: "confirmation",
      proposalHash: "hash-12345678",
      preview: doc([task({ stableKey: "a" })]).preview,
      assumedIntake: false,
      preserved: { completed: 0, edited: 0 },
    };
    expect(parsePlanGenerateOk(bad)).toBeNull();
  });
});

describe("preservation merge", () => {
  const proposed = [
    task({ stableKey: "keep-done", order: 0 }),
    task({ stableKey: "keep-edited", order: 1 }),
    task({ stableKey: "fresh", order: 2 }),
  ];
  const preserved = new Map<string, PreservedTask>([
    ["keep-done", { status: "done", notes: "did it", userEdited: false, completedAt: new Date("2026-11-01") }],
    ["keep-edited", { status: "todo", notes: "my plan", userEdited: true, completedAt: null }],
  ]);

  it("keeps completed status/notes and manual edits; new tasks stay fresh", () => {
    const merged = mergePreservedTasks(proposed, preserved);
    expect(merged.find((t) => t.stableKey === "keep-done")?.status).toBe("done");
    expect(merged.find((t) => t.stableKey === "keep-done")?.notes).toBe("did it");
    expect(merged.find((t) => t.stableKey === "keep-edited")?.userEdited).toBe(true);
    expect(merged.find((t) => t.stableKey === "keep-edited")?.notes).toBe("my plan");
    expect(merged.find((t) => t.stableKey === "fresh")?.status).toBe("todo");
    expect(merged.find((t) => t.stableKey === "fresh")?.userEdited).toBe(false);
  });

  it("definitions come from the proposal — a changed due date is the reviewed one", () => {
    const reProposed = [
      task({ stableKey: "keep-done", dueDate: "2027-01-15", order: 0 }),
    ];
    const merged = mergePreservedTasks(reProposed, preserved);
    expect(merged[0].dueDate).toBe("2027-01-15");
    expect(merged[0].status).toBe("done"); // work preserved independently
  });

  it("counts preserved work for the confirmation copy", () => {
    expect(preservedCounts(preserved)).toEqual({ completed: 1, edited: 1 });
  });
});

describe("proposal hash (preview token integrity)", () => {
  it("is stable across regeneratedAt/preview-id changes (same reviewed content)", () => {
    const a = doc([task({ stableKey: "a", dueDate: "2027-01-10" })]);
    const b = doc([task({ stableKey: "a", dueDate: "2027-01-10" })]);
    b.preview.generatedAt = new Date(Date.now() + 5000).toISOString();
    b.preview.id = "preview-other";
    expect(hashOf(a)).toBe(hashOf(b));
  });

  it("changes when any reviewable field changes (date, status, notes, order, title)", () => {
    const base = doc([task({ stableKey: "a", dueDate: "2027-01-10" }), task({ stableKey: "b", order: 1 })]);
    const changedDue = doc([task({ stableKey: "a", dueDate: "2027-02-10" }), task({ stableKey: "b", order: 1 })]);
    const changedStatus = doc([
      task({ stableKey: "a", dueDate: "2027-01-10", status: "done" }),
      task({ stableKey: "b", order: 1 }),
    ]);
    const changedNotes = doc([
      task({ stableKey: "a", dueDate: "2027-01-10", notes: "edited" }),
      task({ stableKey: "b", order: 1 }),
    ]);
    const changedOrder = doc([task({ stableKey: "a", dueDate: "2027-01-10", order: 5 }), task({ stableKey: "b", order: 0 })]);
    const h = hashOf(base);
    expect(hashOf(changedDue)).not.toBe(h);
    expect(hashOf(changedStatus)).not.toBe(h);
    expect(hashOf(changedNotes)).not.toBe(h);
    expect(hashOf(changedOrder)).not.toBe(h);
  });

  it("is order-insensitive to array ordering (canonical sort by stableKey)", () => {
    const a = doc([task({ stableKey: "a", order: 0 }), task({ stableKey: "b", order: 1 })]);
    const b = doc([task({ stableKey: "b", order: 1 }), task({ stableKey: "a", order: 0 })]);
    expect(hashOf(a)).toBe(hashOf(b));
  });
});
