# Asset provenance — Uraan

Every visual asset shipped in this repository, with its source, licence
basis, and optimization notes. Updated whenever an asset changes.

## `public/images/hero-campus-*.{webp,jpg}`

| Field | Value |
| --- | --- |
| What | Homepage hero visual — two students with backpacks walking a sunlit path toward a university campus |
| Kind | **Original AI-generated illustration** (generated for Uraan; rendered in a photographic style) |
| Source | Generated with the project's image-generation capability on **2026-11-05**, prompt: warm editorial campus scene in the Uraan palette (ivory/deep-green/sandstone), students mid-journey toward a university building, natural afternoon light |
| Creator | Uraan project (AI generation, art direction by the project) |
| Licence | Original work created for and owned by this project; no third-party rights |
| Why not a photograph | No photograph with a verifiable creator + licence could be obtained in this environment (web search returns re-hosted files whose original licence/creator cannot be verified). Per the implementation prompt, the fallback is original generated artwork **described honestly as an illustration** |
| Honesty rules | The alt text and the on-image caption both label it an illustration; generated people are **never** presented as real Uraan users, testimonials, or institutional endorsement |
| Files | `hero-campus-640` (mobile), `hero-campus-1024`, `hero-campus-1344` (desktop) · each in WebP (modern browsers) + progressive JPEG (fallback) |
| Optimization | LANCZOS-resized from the 1344×768 master; WebP q78, JPEG q80; served through a `<picture>` with `srcset`/`sizes` and explicit `width`/`height` (no layout shift); hero variant uses `fetchpriority="high"` (LCP asset), no lazy-loading on the LCP image |
| Serving | Plain `<picture>`/`<img>` with pre-optimized files — deliberately NOT `next/image`, because the standalone production build ships no sharp optimizer (see `next.config.ts`) |

## `public/logo.svg`, `src/app/fonts/*`

Existing self-hosted assets (project mark and self-hosted variable fonts:
Fraunces, Geist, Geist Mono, Noto Sans Bengali) — unchanged; see
`src/app/layout.tsx` for font wiring.

## `public/badges/`

**Empty — official organizer sticker still pending.** The competition badge
component renders an honest text link until the organizer-provided artwork
file is placed there (see `src/components/uraan/shell/competition-badge.tsx`).
Owner action required: obtain the official sticker from the event's
authorized resources and drop it into `public/badges/`; no replica or
substitute may be committed.
