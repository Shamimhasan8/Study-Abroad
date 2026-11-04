/**
 * Editorial field registry — the ONLY field paths an approved evidence
 * record may publish into. Each path is typed and validated; arbitrary
 * field-path code execution is impossible by construction.
 */
import { z } from "zod";

export interface FieldSpec {
  /** Where the value lives on the Opportunity row. */
  target: "scalar" | "json deadlines" | "json costs" | "json funding" | "json requirements";
  column?: string; // scalar column name
  /** Value validator. */
  value: z.ZodTypeAny;
  /** Human label for audit/diff text. */
  label: string;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date (YYYY-MM-DD) or empty");

export const FIELD_REGISTRY: Record<string, FieldSpec> = {
  "cycleStatus": {
    target: "scalar",
    column: "cycleStatus",
    value: z.enum(["open", "opens_later", "in_progress", "closed", "rolling", "archived", "unknown"]),
    label: "Application cycle status",
  },
  "cycleYear": {
    target: "scalar",
    column: "cycleYear",
    value: z.number().int().min(2024).max(2032).nullable(),
    label: "Application cycle year",
  },
  "applyUrl": {
    target: "scalar",
    column: "applyUrl",
    value: z.string().url().max(500),
    label: "Official application link",
  },
  "reviewState": {
    target: "scalar",
    column: "reviewState",
    value: z.enum(["baseline_review", "verified_current", "stale", "pending_recheck"]),
    label: "Record review state",
  },
  // JSON-item fields: fieldPath format "deadlines.<itemId>.closeDate"
  "deadlines.closeDate": { target: "json deadlines", value: isoDate, label: "Deadline close date" },
  "deadlines.note": { target: "json deadlines", value: z.string().max(400), label: "Deadline note" },
  "costs.amount": { target: "json costs", value: z.number().min(0).max(100_000_000).nullable(), label: "Cost amount" },
  "funding.amount": { target: "json funding", value: z.number().min(0).max(100_000_000).nullable(), label: "Funding amount" },
  "requirements.thresholdValue": { target: "json requirements", value: z.string().max(400), label: "Requirement threshold" },
};

export type ParsedFieldPath =
  | { kind: "scalar"; column: string; label: string; validator: z.ZodTypeAny }
  | { kind: "json"; jsonColumn: "deadlinesJson" | "costsJson" | "fundingJson" | "requirementsJson"; itemId: string; key: string; label: string; validator: z.ZodTypeAny }
  | { kind: "invalid"; reason: string };

/**
 * Parse and allowlist a submitted fieldPath.
 * Accepted shapes: "scalarKey" or "<jsonField>.<itemId>.<key>".
 */
export function parseFieldPath(fieldPath: string): ParsedFieldPath {
  const trimmed = fieldPath.trim();
  if (trimmed.includes("..") || trimmed.startsWith(".") || trimmed.endsWith(".")) {
    return { kind: "invalid", reason: "malformed path" };
  }
  const parts = trimmed.split(".");
  if (parts.length === 1) {
    const spec = FIELD_REGISTRY[parts[0]];
    if (!spec || spec.target !== "scalar") return { kind: "invalid", reason: "field not publishable" };
    return { kind: "scalar", column: spec.column!, label: spec.label, validator: spec.value };
  }
  if (parts.length === 3) {
    const [jsonField, itemId, key] = parts;
    const registryKey = `${jsonField}.${key}`;
    const spec = FIELD_REGISTRY[registryKey];
    if (!spec || !spec.target.startsWith("json")) return { kind: "invalid", reason: "field not publishable" };
    if (!/^[a-z0-9-]{1,60}$/i.test(itemId)) return { kind: "invalid", reason: "invalid item id" };
    const jsonColumn = `${jsonField}Json` as "deadlinesJson" | "costsJson" | "fundingJson" | "requirementsJson";
    return { kind: "json", jsonColumn, itemId, key, label: spec.label, validator: spec.value };
  }
  return { kind: "invalid", reason: "unexpected path depth" };
}

/** Coerce the raw evidence string into the validated typed value. */
export function coerceFactValue(raw: string, validator: z.ZodTypeAny): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, error: "empty_value_not_publishable" };
  let candidate: unknown = trimmed;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (Number.isFinite(num)) candidate = num;
  }
  const parsed = validator.safeParse(candidate);
  if (parsed.success) return { ok: true, value: parsed.data };
  // retry as raw string for string validators
  if (typeof candidate !== "string") {
    const retry = validator.safeParse(trimmed);
    if (retry.success) return { ok: true, value: retry.data };
  }
  return { ok: false, error: "value_failed_validation" };
}
