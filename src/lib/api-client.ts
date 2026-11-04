"use client";

/**
 * Uraan typed API client — every browser call goes through here.
 *
 * - response.ok + envelope.ok both checked; timeouts via AbortController.
 * - Errors are TYPED (status, code, retryable) so callers can roll back
 *   optimistic UI and offer a real retry instead of swallowing failures.
 * - No secrets or personal data ever ride in URLs (relative paths only).
 */

export interface ApiEnvelope {
  ok: boolean;
  data?: unknown;
  error?: string;
  requestId?: string;
  retryable?: boolean;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; retryable: boolean };

const DEFAULT_TIMEOUT_MS = 20000;

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit,
  opts?: { timeoutMs?: number },
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(path, { ...init, signal: controller.signal });
    const json: ApiEnvelope | null = await res.json().catch(() => null);
    if (res.ok && json?.ok === true) {
      return { ok: true, data: json.data as T };
    }
    return {
      ok: false,
      status: res.status,
      error: json?.error ?? `http_${res.status}`,
      retryable: json?.retryable ?? (res.status >= 500 || res.status === 429),
    };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    return { ok: false, status: 0, error: aborted ? "timeout" : "network", retryable: true };
  } finally {
    clearTimeout(timer);
  }
}

export async function apiPost<T = unknown>(
  path: string,
  body: unknown,
  opts?: { timeoutMs?: number },
): Promise<ApiResult<T>> {
  return apiFetch<T>(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    opts,
  );
}

export async function apiPatch<T = unknown>(
  path: string,
  body: unknown,
  opts?: { timeoutMs?: number },
): Promise<ApiResult<T>> {
  return apiFetch<T>(
    path,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    opts,
  );
}
