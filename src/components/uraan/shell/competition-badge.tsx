"use client";

/**
 * Competition badge — OFFICIAL ORGANIZER STICKER.
 *
 * The sticker's availability is probed server-side by /api/capabilities
 * (fs check on public/badges/) and arrives via the app store — the header
 * never issues a doomed asset request, so an empty slot cannot 404 on
 * every page load. With the organizer asset present, the header shows the
 * actual artwork's identity crop (head-icon + AIgnite wordmark) at a
 * readable size on desktop AND mobile; the unmodified original sticker is
 * preserved alongside it (ai-ignite-2026-original.png). Until the asset
 * exists there, this is an honest, clearly-identified text link — NOT a
 * replica of the sticker and NOT a compliance claim.
 */
import { ExternalLink } from "lucide-react";
import { useAppStore } from "@/lib/store";

export function CompetitionBadge({ compact = false }: { compact?: boolean }) {
  const sticker = useAppStore((s) => s.capabilities?.competitionSticker ?? null);

  const hasSticker = sticker?.available && sticker.file ? true : false;

  return (
    <a
      href="https://yunet-aignite26.devpost.com/"
      target="_blank"
      rel="noopener noreferrer"
      className={
        hasSticker
          ? // Official artwork present — the identity crop stands alone with a
            // subtle ring; visible at every width (readable on mobile too).
            compact
            ? "ml-2 inline-flex items-center rounded-md focus-visible:outline-2"
            : "ml-1.5 inline-flex items-center rounded-md ring-1 ring-border/70 focus-visible:outline-2"
          : compact
            ? "inline-flex items-center gap-1 rounded-full border border-coral/40 bg-accent px-2 py-0.5 text-[11px] font-medium text-foreground/75 hover:border-coral transition-colors"
            : "hidden sm:inline-flex items-center gap-1 rounded-full border border-coral/40 bg-accent px-2.5 py-0.5 text-xs font-medium text-foreground/75 hover:border-coral transition-colors"
      }
      title="YuNet AI Ignite 2026 — Devpost"
    >
      {hasSticker && sticker?.file ? (
        <img
          src={`/badges/${sticker.file}`}
          alt="YuNet AI Ignite 2026 — official sticker"
          className={compact ? "h-7 w-auto rounded-md" : "h-8 sm:h-10 w-auto rounded-md"}
        />
      ) : (
        <>
          AI Ignite 2026
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </>
      )}
    </a>
  );
}
