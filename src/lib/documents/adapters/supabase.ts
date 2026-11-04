/**
 * Private object storage adapter for production (Supabase Storage REST).
 *
 * - Private bucket; every object key is owner-scoped: {userId}/{48-hex}.
 * - All reads/writes go through the server with the service key — clients
 *   never see storage credentials or public URLs. Downloads flow through
 *   the app's authenticated, owner-checked API route.
 * - No SDK dependency: plain fetch against the Storage REST endpoints.
 *
 * Required env:
 *   SUPABASE_URL                 https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    service_role secret (server only)
 *   DOCUMENTS_BUCKET             private bucket name (default: uraan-documents)
 */
export const ADAPTER_NAME = "supabase-storage";

function baseUrl(): string {
  const url = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
  if (!url) throw new Error("documents_adapter_unconfigured: SUPABASE_URL missing");
  return url;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!key) throw new Error("documents_adapter_unconfigured: SUPABASE_SERVICE_ROLE_KEY missing");
  return { Authorization: `Bearer ${key}`, ...extra };
}

function objectUrl(userId: string, key: string): string {
  const bucket = process.env.DOCUMENTS_BUCKET ?? "uraan-documents";
  const safeKey = key.replace(/[^a-f0-9]/gi, "");
  if (safeKey.length !== 48) throw new Error("invalid_key");
  return `${baseUrl()}/storage/v1/object/${bucket}/${encodeURIComponent(userId)}/${safeKey}`;
}

export async function save(userId: string, key: string, bytes: Buffer, contentType: string): Promise<void> {
  const res = await fetch(objectUrl(userId, key), {
    method: "POST",
    headers: authHeaders({
      "Content-Type": contentType || "application/octet-stream",
      "x-upsert": "true",
    }),
    body: new Uint8Array(bytes),
  });
  if (!res.ok) {
    throw new Error(`documents_adapter_write_failed: HTTP ${res.status}`);
  }
}

export async function read(userId: string, key: string): Promise<{ bytes: Buffer; contentType?: string }> {
  const res = await fetch(objectUrl(userId, key), {
    method: "GET",
    headers: authHeaders({ "Content-Type": "application/octet-stream" }),
  });
  if (!res.ok) {
    throw new Error(`documents_adapter_read_failed: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { bytes: buf, contentType: res.headers.get("content-type") ?? undefined };
}

export async function purge(userId: string, key: string): Promise<void> {
  const res = await fetch(objectUrl(userId, key), {
    method: "DELETE",
    headers: authHeaders(),
  });
  // 404 on delete = already gone; that is a successful purge.
  if (!res.ok && res.status !== 404) {
    throw new Error(`documents_adapter_delete_failed: HTTP ${res.status}`);
  }
}

/** Storage configuration state for ops surfaces (never leaks secrets). */
export function configState(): { configured: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return { configured: missing.length === 0, missing };
}
