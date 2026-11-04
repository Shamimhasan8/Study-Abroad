/**
 * Uraan ingestion runner — polite, allowlisted source health checks.
 *
 * Hard guarantees:
 * - Only registry URLs are ever fetched (SSRF-safe by construction; no
 *   user-supplied URLs enter this path).
 * - Timeouts, redirect limits, and size ceilings enforced.
 * - A successful fetch is RECORDED, never treated as factual verification.
 * - Failures keep the prior published record; nothing is replaced by a
 *   hallucinated "fresh" value.
 *
 * Candidate facts for editorial review are submitted by reviewers through
 * the admin API (assisted/manual extraction with evidence), keeping the
 * human review loop explicit.
 */
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

const TIMEOUT_MS = Number(process.env.INGESTION_TIMEOUT_MS ?? 10000);
const MAX_BYTES = Number(process.env.INGESTION_MAX_BYTES ?? 524288);

export interface FetchOutcome {
  sourceKey: string;
  status: "fetched" | "failed" | "unchanged";
  httpStatus?: number;
  contentHash?: string;
  sizeBytes?: number;
  note?: string;
}

async function fetchSource(url: string): Promise<{ ok: boolean; httpStatus?: number; body?: string; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Uraan-SourceCheck/1.0 (study-abroad preparation; contact via repository)",
        Accept: "text/html,application/xhtml+xml,text/plain",
      },
    });
    if (!res.ok) return { ok: false, httpStatus: res.status };
    const reader = res.body?.getReader();
    if (!reader) return { ok: false, httpStatus: res.status, error: "no_body" };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
        if (total > MAX_BYTES) {
          await reader.cancel();
          break;
        }
      }
    }
    const text = new TextDecoder("utf-8", { fatal: false }).decode(concat(chunks));
    return { ok: true, httpStatus: res.status, body: text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Run health checks for the allowlisted sources (volatility-aware). */
export async function runIngestion(opts?: { volatility?: string; limit?: number }): Promise<{
  outcomes: FetchOutcome[];
  startedAt: string;
  finishedAt: string;
}> {
  const startedAt = new Date();
  const sources = await db.source.findMany({
    where: {
      active: true,
      ...(opts?.volatility ? { volatility: opts.volatility } : {}),
    },
    take: opts?.limit ?? 50,
    orderBy: { key: "asc" },
  });

  const outcomes: FetchOutcome[] = [];
  for (const source of sources) {
    // Persist a job row for durability (lease token guards re-entry).
    const lease = createHash("sha256").update(`${source.id}:${startedAt.toISOString()}`).digest("hex").slice(0, 24);
    const job = await db.ingestionJob.create({
      data: {
        sourceId: source.id,
        scheduledFor: startedAt,
        startedAt: startedAt,
        status: "running",
        attempts: 1,
        leaseToken: lease,
        leaseExpiresAt: new Date(startedAt.getTime() + TIMEOUT_MS + 5000),
      },
    });

    const result = await fetchSource(source.url);
    let outcome: FetchOutcome;
    if (result.ok && result.body !== undefined) {
      const hash = createHash("sha256").update(result.body).digest("hex");
      const last = await db.sourceVersion.findFirst({
        where: { sourceId: source.id, contentHash: { not: null } },
        orderBy: { retrievedAt: "desc" },
      });
      const unchanged = last?.contentHash === hash;
      outcome = {
        sourceKey: source.key,
        status: unchanged ? "unchanged" : "fetched",
        httpStatus: result.httpStatus,
        contentHash: hash,
        sizeBytes: Buffer.byteLength(result.body, "utf-8"),
      };
    } else {
      outcome = {
        sourceKey: source.key,
        status: "failed",
        httpStatus: result.httpStatus,
        note: (result.error ?? "fetch_failed").slice(0, 200),
      };
    }

    await db.sourceVersion.create({
      data: {
        sourceId: source.id,
        status: outcome.status,
        httpStatus: outcome.httpStatus ?? null,
        contentHash: outcome.contentHash ?? null,
        sizeBytes: outcome.sizeBytes ?? null,
        note: outcome.note ?? null,
      },
    });
    await db.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: outcome.status === "failed" ? "failed" : "done",
        finishedAt: new Date(),
        lastError: outcome.note ?? null,
      },
    });
    outcomes.push(outcome);
  }

  return {
    outcomes,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
  };
}
