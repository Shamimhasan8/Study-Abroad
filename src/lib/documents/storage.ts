/**
 * Uraan private document storage.
 *
 * - Files live outside the web root under db/private-docs/{userId}/{key}.
 * - Storage keys are random and unguessable; downloads go through an
 *   authenticated, owner-checked API route with Content-Disposition.
 * - MIME allowlist + size ceiling; SHA-256 recorded for integrity.
 * - Deletion revokes access immediately and removes the file; a tombstone
 *   row remains for audit (name/sizes/timestamps only).
 */
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

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

export function documentsRoot(): string {
  return path.resolve(process.env.DOCUMENTS_DIR ?? "./db/private-docs");
}

export function maxUploadBytes(): number {
  return Number(process.env.MAX_UPLOAD_MB ?? 5) * 1024 * 1024;
}

export function newStorageKey(): string {
  return randomBytes(24).toString("hex");
}

export function storagePath(userId: string, key: string): string {
  // Defense in depth: refuse anything that escapes the user's directory.
  const safeKey = key.replace(/[^a-f0-9]/gi, "");
  if (safeKey.length !== 48) throw new Error("invalid_key");
  return path.join(documentsRoot(), userId, safeKey);
}

export async function saveDocument(
  userId: string,
  key: string,
  bytes: Buffer,
): Promise<void> {
  const target = storagePath(userId, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { mode: 0o600 });
}

export async function readDocument(userId: string, key: string): Promise<Buffer> {
  return readFile(storagePath(userId, key));
}

export async function purgeDocument(userId: string, key: string): Promise<void> {
  await rm(storagePath(userId, key), { force: true });
}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function safeOriginalName(name: string): string {
  // Strip path separators and control chars; keep it visibly honest.
  return name.replace(/[/\\]*/g, "").replace(/[\u0000-\u001f]/g, "").slice(0, 120) || "document";
}
