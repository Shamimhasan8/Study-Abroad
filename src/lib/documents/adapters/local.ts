/**
 * Local development document adapter — explicit dev-only persistence.
 *
 * Writes under ./db/private-docs (gitignored). NEVER selected implicitly
 * in production: the storage factory refuses local mode when
 * NODE_ENV=production unless DOCUMENTS_STORAGE=local is set explicitly
 * (recorded as a deployment smell in the release checklist).
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const ADAPTER_NAME = "local-fs";

export function documentsRoot(): string {
  return path.resolve(process.env.DOCUMENTS_DIR ?? "./db/private-docs");
}

export function storagePath(userId: string, key: string): string {
  // Defense in depth: refuse anything that escapes the user's directory.
  const safeKey = key.replace(/[^a-f0-9]/gi, "");
  if (safeKey.length !== 48) throw new Error("invalid_key");
  return path.join(documentsRoot(), userId, safeKey);
}

export async function save(userId: string, key: string, bytes: Buffer, _contentType: string): Promise<void> {
  const target = storagePath(userId, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { mode: 0o600 });
}

export async function read(userId: string, key: string): Promise<{ bytes: Buffer; contentType?: string }> {
  return { bytes: await readFile(storagePath(userId, key)) };
}

export async function purge(userId: string, key: string): Promise<void> {
  await rm(storagePath(userId, key), { force: true });
}
