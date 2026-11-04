/**
 * Uraan AI adapter — the ONLY place z-ai-web-dev-sdk is touched.
 *
 * Guarantees (per the product contract):
 * - Server-side only; provider secrets never reach the client.
 * - Timeouts, bounded retries, per-user daily quotas, sanitized AiRun logs
 *   (no essay text or personal documents in metadata).
 * - AI explains deterministic results; it never overrides them.
 * - Failures degrade gracefully to labelled template fallbacks — canned
 *   text is never presented as live AI output.
 */
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import type { ProfileData } from "@/lib/types";

const TIMEOUT_MS = Number(process.env.AI_PROVIDER_TIMEOUT_MS ?? 45000);
const MAX_OUTPUT_TOKENS = Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 1200);
const DAILY_RUNS = Number(process.env.AI_DAILY_RUNS_PER_USER ?? 40);

interface CompleteOptions {
  system: string;
  user: string;
  userId?: string;
  purpose: string;
  json?: boolean;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("ai_timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function logRun(params: {
  userId?: string;
  purpose: string;
  model: string;
  status: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}) {
  try {
    await db.aiRun.create({ data: params });
  } catch {
    /* logging must never break the request */
  }
}

async function checkQuota(userId?: string): Promise<boolean> {
  if (!userId) return true; // anonymous guests get the same per-IP budget upstream
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const runs = await db.aiRun.count({
    where: { userId, createdAt: { gte: since }, status: "ok" },
  });
  return runs < DAILY_RUNS;
}

/** Low-level completion with retries and sanitized metadata logging. */
export async function complete(opts: CompleteOptions): Promise<
  { ok: true; text: string } | { ok: false; error: string }
> {
  if (!(await checkQuota(opts.userId))) {
    return { ok: false, error: "quota" };
  }
  const started = Date.now();
  const model = "zai-default";
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const zai = await ZAI.create();
      const completion = await withTimeout(
        zai.chat.completions.create({
          messages: [
            { role: "assistant", content: opts.system },
            { role: "user", content: opts.user },
          ],
          thinking: { type: "disabled" },
          max_tokens: MAX_OUTPUT_TOKENS,
        }),
        TIMEOUT_MS,
      );
      const text = completion.choices?.[0]?.message?.content ?? "";
      if (!text.trim()) throw new Error("empty_response");
      await logRun({
        userId: opts.userId,
        purpose: opts.purpose,
        model,
        status: "ok",
        latencyMs: Date.now() - started,
        inputTokens: Math.ceil((opts.system.length + opts.user.length) / 4),
        outputTokens: Math.ceil(text.length / 4),
      });
      return { ok: true, text };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "unknown";
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 500 * attempt)); // bounded backoff
      }
    }
  }
  await logRun({
    userId: opts.userId,
    purpose: opts.purpose,
    model,
    status: lastError === "ai_timeout" ? "timeout" : "error",
    latencyMs: Date.now() - started,
    error: lastError.slice(0, 200),
  });
  return { ok: false, error: lastError };
}

/** Extract the first JSON object from a model reply (tolerates prose). */
export function extractJson<T>(text: string, validate: (value: unknown) => T): T | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return validate(JSON.parse(candidate.slice(start, end + 1)));
  } catch {
    return null;
  }
}
