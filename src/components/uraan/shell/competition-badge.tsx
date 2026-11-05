"use client";

/**
 * Competition badge — OFFICIAL ORGANIZER STICKER SLOT.
 *
 * The header probes `public/badges/ai-ignite-2026.svg`: when the organizer
 * asset exists there, the official sticker renders (height-constrained,
 * alt-labelled); until then this is an honest, clearly-identified text
 * link — NOT a replica of the sticker and NOT a compliance claim.
 */
import { useState } from "react";
import { ExternalLink } from "lucide-react";

export function CompetitionBadge({ compact = false }: { compact?: boolean }) {
  const [stickerOk, setStickerOk] = useState(false);
  return (
    <>
      <img
        src="/badges/ai-ignite-2026.svg"
        alt=""
        aria-hidden="true"
        className="absolute h-0 w-0 overflow-hidden"
        onLoad={() => setStickerOk(true)}
        onError={() => setStickerOk(false)}
      />
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
        {stickerOk ? (
          <img
            src="/badges/ai-ignite-2026.svg"
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
    </>
  );
}
