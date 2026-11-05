"use client";

/**
 * Competition badge — OFFICIAL ORGANIZER STICKER SLOT.
 *
 * The sticker's availability is probed server-side by /api/capabilities
 * (fs check on public/badges/) and arrives via the app store — the header
 * never issues a doomed asset request, so an empty slot cannot 404 on
 * every page load. Until the organizer asset exists there, this is an
 * honest, clearly-identified text link — NOT a replica of the sticker and
 * NOT a compliance claim.
 */
import { ExternalLink } from "lucide-react";
import { useAppStore } from "@/lib/store";

export function CompetitionBadge({ compact = false }: { compact?: boolean }) {
  const sticker = useAppStore((s) => s.capabilities?.competitionSticker ?? null);

  return (
    <a
      href="https://yunet-aignite26.devpost.com/"
      target="_blank"
      rel="noopener noreferrer"
      className={
        compact
          ? "inline-flex items-center gap-1 rounded-full border border-coral/40 bg-accent px-2 py-0.5 text-[11px] font-medium text-foreground/75 hover:border-coral transition-colors"
          : "hidden sm:inline-flex items-center gap-1 rounded-full border border-coral/40 bg-accent px-2.5 py-0.5 text-xs font-medium text-foreground/75 hover:border-coral transition-colors"
      }
      title="YuNet AI Ignite 2026 — Devpost"
    >
      {sticker?.available && sticker.file ? (
        <img
          src={`/badges/${sticker.file}`}
          alt="YuNet AI Ignite 2026 — official sticker"
          className="h-6 w-auto"
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
