/**
 * Uraan private document storage — adapter facade.
 *
 * - Files are addressed by owner-scoped random keys; downloads go through
 *   an authenticated, owner-checked API route with Content-Disposition.
 * - MIME allowlist + size ceiling; SHA-256 recorded for integrity.
 * - Deletion revokes access immediately (adapter purge) and leaves a
 *   tombstone row for audit (name/sizes/timestamps only).
 *
 * Adapter selection: DOCUMENTS_STORAGE=local (default in development) or
 * `supabase` for production object storage. Local mode is REFUSED in
 * production unless explicitly forced — ephemeral filesystems must never
 * silently pretend to persist student documents.
 */
import { createHash, randomBytes } from "node:crypto";
import * as local from "./adapters/local";
import * as supabase from "./adapters/supabase";

export const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
]);

export const ALLOWED_EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "text/plain": ".txt",
};

export function maxUploadBytes(): number {
  return Number(process.env.MAX_UPLOAD_MB ?? 5) * 1024 * 1024;
}

export function newStorageKey(): string {
  return randomBytes(24).toString("hex");
}

/** Which adapter is active (for admin/ops surfaces; no secrets). */
export function documentsBackend(): string {
  const mode = (process.env.DOCUMENTS_STORAGE ?? "").toLowerCase();
  const isProd = process.env.NODE_ENV === "production";
  if (mode === "supabase") return supabase.ADAPTER_NAME;
  if (mode === "local") return local.ADAPTER_NAME;
  return isProd ? "unconfigured" : local.ADAPTER_NAME;
}

type Adapter = {
  save: (userId: string, key: string, bytes: Buffer, contentType: string) => Promise<void>;
  read: (userId: string, key: string) => Promise<{ bytes: Buffer; contentType?: string }>;
  purge: (userId: string, key: string) => Promise<void>;
};

function adapter(): Adapter {
  const mode = (process.env.DOCUMENTS_STORAGE ?? "").toLowerCase();
  const isProd = process.env.NODE_ENV === "production";
  if (mode === "supabase") return supabase;
  if (mode === "local") {
    if (isProd) {
      // Explicit local in production = deliberate owner decision (single-box
      // deployment); allowed but loud.
      console.warn("[documents] local filesystem storage in production — ephemeral on serverless hosts");
    }
    return local;
  }
  if (isProd) {
    throw new Error(
      "documents_adapter_unconfigured: set DOCUMENTS_STORAGE=supabase with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for production persistence",
    );
  }
  return local; // development default
}

export async function saveDocument(
  userId: string,
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  await adapter().save(userId, key, bytes, contentType);
}

export async function readDocument(userId: string, key: string): Promise<{ bytes: Buffer; contentType?: string }> {
  return adapter().read(userId, key);
}

export async function purgeDocument(userId: string, key: string): Promise<void> {
  await adapter().purge(userId, key);
}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Content signature validation — the file's actual bytes must match its
 * declared MIME type; a filename is never trusted as evidence.
 */
export function signatureMatches(bytes: Buffer, mime: string): boolean {
  if (bytes.length < 12) return false;
  switch (mime) {
    case "application/pdf":
      return bytes.subarray(0, 5).toString("latin1") === "%PDF-";
    case "image/png":
      return bytes[0] === 0x89 && bytes.subarray(1, 4).toString("latin1") === "PNG";
    case "image/jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/webp":
      return bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP";
    case "text/plain": {
      // Reject obvious binary payloads posing as text (NUL bytes).
      const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
      return !sample.includes(0);
    }
    default:
      return false;
  }
}

export function safeOriginalName(name: string): string {
  // Strip path separators and control chars; keep it visibly honest.
  return name.replace(/[/\\]*/g, "").replace(/[\u0000-\u001f]/g, "").slice(0, 120) || "document";
}

/** Re-exported for ops/admin display. */
export { configState as supabaseConfigState } from "./adapters/supabase";
