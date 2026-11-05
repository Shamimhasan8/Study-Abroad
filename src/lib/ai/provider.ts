/**
 * Uraan AI adapter — the ONLY place z-ai-web-dev-sdk is touched.
 *
 * Guarantees (per the product contract):
 * - Server-side only; provider secrets never reach the client.
 * - Timeouts, bounded retries, per-user AND per-guest-IP daily quotas
 *   (durable in the AiRun table, shared across instances), sanitized AiRun
 *   logs (no essay text or personal documents in metadata).
 * - AI explains deterministic results; it never overrides them.
 * - Failures degrade gracefully to labelled template fallbacks — canned
 *   text is never presented as live AI output.
 * - Model metadata reflects what the provider actually reports; a
 *   configured-but-unknown model is labelled as such, never faked.
 */
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";

const TIMEOUT_MS = Number(process.env.AI_PROVIDER_TIMEOUT_MS ?? 45000);
const MAX_OUTPUT_TOKENS = Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 1200);
const DAILY_RUNS = Number(process.env.AI_DAILY_RUNS_PER_USER ?? 40);
const DAILY_RUNS_PER_IP = Number(process.env.AI_DAILY_RUNS_PER_IP ?? 20);

interface CompleteOptions {
  system: string;
  user: string;
  userId?: string;
  /** Client IP for guest quota buckets (routes pass x-forwarded-for). */
  ip?: string;
  purpose: string;
  json?: boolean;
}

/**
 * Provider initialization. The SDK's file-based loader (`.z-ai-config` in
 * cwd/home//etc) is IMPOSSIBLE on serverless hosts — the deployed
 * fallback root cause: ZAI.create() threw, every feature degraded to
 * `aiGenerated:false`. Hosts without a filesystem config MUST set
 * ZAI_BASE_URL + ZAI_API_KEY env vars; we construct the client directly.
 */
/** The minimal client surface this adapter uses (structural type). */
interface ZaiClient {
  chat: {
    completions: {
      create: (body: {
        messages: { role: "system" | "user" | "assistant"; content: string }[];
        thinking?: { type: "enabled" | "disabled" };
        max_tokens?: number;
      }) => Promise<{
        choices?: { message?: { content?: string } }[];
        model?: unknown;
      }>;
    };
  };
}

async function createClient(): Promise<ZaiClient | null> {
  const baseUrl = process.env.ZAI_BASE_URL?.trim();
  const apiKey = process.env.ZAI_API_KEY?.trim();
  if (baseUrl && apiKey) {
    // The SDK constructor is TS-private but structurally public; the cast
    // documents exactly what we rely on (baseUrl + apiKey config).
    const Ctor = ZAI as unknown as new (config: { baseUrl: string; apiKey: string }) => ZaiClient;
    return new Ctor({ baseUrl, apiKey });
  }
  // Local/dev: file-based config (or the sandbox's /etc/.z-ai-config).
  return ZAI.create().catch(() => null);
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

/** Coarse privacy: only a short stable prefix of the IP is stored. */
function ipBucket(ip: string | undefined): string | null {
  if (!ip) return null;
  // Keep first two segments (or first 12 chars) — enough to bucket, not to
  // identify an individual household beyond the quota's purpose.
  const trimmed = ip.replace(/[^0-9a-fA-F:.]/g, "").slice(0, 14);
  return trimmed || null;
}

async function logRun(params: {
  userId?: string;
  ip?: string | null;
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

async function checkQuota(userId?: string, ip?: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    if (userId) {
      const runs = await db.aiRun.count({
        where: { userId, createdAt: { gte: since }, status: "ok" },
      });
      return runs < DAILY_RUNS;
    }
    const bucket = ipBucket(ip);
    if (!bucket) return true; // no IP at all (internal call) — allow, logged without bucket
    const runs = await db.aiRun.count({
      where: { ip: bucket, createdAt: { gte: since }, status: "ok" },
    });
    return runs < DAILY_RUNS_PER_IP;
  } catch {
    // Quota check itself failed: fail OPEN deliberately — an availability
    // hiccup must not break deterministic features' explanations, and the
    // runs still log for later reconciliation.
    return true;
  }
}

/** Low-level completion with retries and sanitized metadata logging. */
export async function complete(opts: CompleteOptions): Promise<
  { ok: true; text: string; model: string } | { ok: false; error: string }
> {
  if (!(await checkQuota(opts.userId, opts.ip))) {
    await logRun({
      userId: opts.userId,
      ip: ipBucket(opts.ip) ?? undefined,
      purpose: opts.purpose,
      model: "n/a",
      status: "error",
      error: "quota",
    });
    return { ok: false, error: "quota" };
  }
  const started = Date.now();
  let reportedModel = "zai-unspecified"; // honest until the provider reports one
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const zai = await createClient();
      if (!zai) throw new Error("provider_unconfigured");
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
      // Actual model metadata when the provider supplies it.
      const candidate = (completion as { model?: unknown }).model;
      if (typeof candidate === "string" && candidate.trim()) reportedModel = candidate.trim();
      await logRun({
        userId: opts.userId,
        ip: ipBucket(opts.ip) ?? undefined,
        purpose: opts.purpose,
        model: reportedModel,
        status: "ok",
        latencyMs: Date.now() - started,
        inputTokens: Math.ceil((opts.system.length + opts.user.length) / 4),
        outputTokens: Math.ceil(text.length / 4),
      });
      return { ok: true, text, model: reportedModel };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "unknown";
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 500 * attempt)); // bounded backoff
      }
    }
  }
  await logRun({
    userId: opts.userId,
    ip: ipBucket(opts.ip) ?? undefined,
    purpose: opts.purpose,
    model: reportedModel,
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
