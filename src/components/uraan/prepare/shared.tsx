"use client";

/**
 * Shared helpers for the Prepare workspace tabs — API envelope unwrapping,
 * formatting, and the inline guest notice. Kept dependency-light so every
 * tab can import it without cycles.
 */
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

// ---------- API envelope ----------

export type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

/**
 * Fetch a Uraan API route and unwrap the `{ok:true,data}` envelope.
 * Throws `Error(errorCode)` when the envelope reports failure or the network
 * fails, so callers can catch and toast consistently.
 */
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    throw new Error("network_error");
  }
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!json || !json.ok) throw new Error(json?.error ?? "network_error");
  return json.data;
}

/** POST/PUT JSON helper built on apiFetch. */
export function apiSend<T>(
  url: string,
  method: "POST" | "PUT",
  body: unknown,
): Promise<T> {
  return apiFetch<T>(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------- Formatting ----------

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Locale-aware date; invalid input is returned untouched. */
export function formatDate(iso: string, lang: "en" | "bn"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Locale-aware date+time (used for draft versions). */
export function formatDateTime(iso: string, lang: "en" | "bn"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** `YYYY-MM` month key for grouping log entries. */
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Human month label from a `YYYY-MM` key. */
export function monthLabel(key: string, lang: "en" | "bn"): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", {
    year: "numeric",
    month: "long",
  });
}

/** Client-side id for reading-log entries (server stores it verbatim). */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Minutes label with a bilingual suffix. */
export function minutesLabel(minutes: number, lang: "en" | "bn"): string {
  return lang === "bn" ? `${minutes} মিনিট` : `${minutes} min`;
}

// ---------- Guest notice ----------

/**
 * Inline guest notice shown by server-backed tools: the tool stays visible
 * and usable, but nothing is persisted until the visitor signs in. The
 * button routes to Settings, where authentication is handled.
 */
export function GuestNotice() {
  const { t, lang } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  return (
    <Alert className="border-sunflower/60 bg-accent/80">
      <LogIn className="h-4 w-4 text-leaf" aria-hidden="true" />
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm leading-relaxed text-foreground/80">{t("auth.guestNotice")}</span>
        <Button size="sm" onClick={() => navigate("settings")} className="shrink-0">
          {lang === "bn" ? "সংরক্ষণ করতে সাইন ইন করুন" : "Sign in to save"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/** Small muted hint line used under labels. */
export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>;
}
