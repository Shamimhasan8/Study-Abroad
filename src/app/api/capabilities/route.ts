import { existsSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import { documentsBackend, saveDocument, readDocument, purgeDocument, newStorageKey } from "@/lib/documents/storage";
import { complete } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

/**
 * Application capabilities used by the UI (implementation contract B.5).
 *
 * The UI must tell students, in ordinary language, what actually works:
 * browsing, account sync, private uploads, live mentor. Operational
 * diagnostics (driver names, URLs, secrets) stay out; each capability is
 * probed for real — a configured-but-unverified feature is reported
 * unavailable rather than promised.
 *
 * Probe results are cached in-process (10 min) so this endpoint stays cheap;
 * no-store keeps product copy from going stale.
 */

interface ProbeResult<T> {
  result: T;
  at: number;
}
const CACHE_MS = 10 * 60 * 1000;

let dbProbe: ProbeResult<{ reachable: boolean; mode: "database" | "seed-fallback" }> | null = null;
let storageProbe: ProbeResult<{ available: boolean; backend: string }> | null = null;
let mentorProbe: ProbeResult<{ available: boolean; error?: string }> | null = null;
let stickerProbe: ProbeResult<{ available: boolean; file: string | null }> | null = null;

async function probeDatabase() {
  if (dbProbe && Date.now() - dbProbe.at < CACHE_MS) return dbProbe.result;
  try {
    await db.opportunity.count();
    dbProbe = { result: { reachable: true, mode: "database" }, at: Date.now() };
  } catch {
    // Public browsing still serves from the committed verified seeds.
    dbProbe = { result: { reachable: false, mode: "seed-fallback" }, at: Date.now() };
  }
  return dbProbe.result;
}

/** Real upload→read→purge round-trip with a tiny text document. */
async function probeStorage() {
  if (storageProbe && Date.now() - storageProbe.at < CACHE_MS) return storageProbe.result;
  const backend = documentsBackend();
  if (backend === "unconfigured") {
    storageProbe = { result: { available: false, backend }, at: Date.now() };
    return storageProbe.result;
  }
  try {
    const key = newStorageKey();
    const payload = Buffer.from("uraan-capability-probe");
    await saveDocument("capability-probe", key, payload, "text/plain");
    const read = await readDocument("capability-probe", key);
    if (!read.bytes.equals(payload)) throw new Error("roundtrip_mismatch");
    await purgeDocument("capability-probe", key);
    storageProbe = { result: { available: true, backend }, at: Date.now() };
  } catch {
    storageProbe = { result: { available: false, backend }, at: Date.now() };
  }
  return storageProbe.result;
}

/**
 * Live-AI verification: a real (tiny) provider completion. A fallback
 * template response NEVER counts as live AI — only a provider round-trip
 * does.
 */
async function probeMentor() {
  if (mentorProbe && Date.now() - mentorProbe.at < CACHE_MS) return mentorProbe.result;
  const probe = await complete({
    system: "Reply with the single word: ok",
    user: "capability probe",
    purpose: "capability_probe",
  });
  mentorProbe = {
    result: { available: probe.ok, error: probe.ok ? undefined : probe.error.slice(0, 60) },
    at: Date.now(),
  };
  return mentorProbe.result;
}

/**
 * Official organizer sticker slot (public/badges/). Probed with fs so the
 * header never issues a doomed asset request: a missing sticker must not
 * 404 on every page load. PNG is honoured alongside SVG.
 */
function probeSticker() {
  if (stickerProbe && Date.now() - stickerProbe.at < CACHE_MS) return stickerProbe.result;
  const dir = join(process.cwd(), "public", "badges");
  const file = ["ai-ignite-2026.svg", "ai-ignite-2026.png"].find((name) =>
    existsSync(join(dir, name)),
  );
  stickerProbe = { result: { available: file !== undefined, file: file ?? null }, at: Date.now() };
  return stickerProbe.result;
}

export async function GET() {
  const [database, storage, mentor, sticker] = await Promise.all([
    probeDatabase(),
    probeStorage(),
    probeMentor(),
    Promise.resolve(probeSticker()),
  ]);
  return Response.json(
    {
      ok: true,
      data: {
        browsing: { available: true, mode: database.mode },
        accountSync: { available: database.reachable },
        privateUploads: { available: storage.available, storage: storage.backend },
        liveMentor: { available: mentor.available },
        competitionSticker: { available: sticker.available, file: sticker.file },
        probedAt: new Date().toISOString(),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
