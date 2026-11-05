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

## `public/badges/ai-ignite-2026.png` + `ai-ignite-2026-original.png`

| Field | Value |
| --- | --- |
| What | Competition badge — the official YuNet AI Ignite Buildathon 2026 sticker artwork |
| Kind | **Organizer-provided event artwork** (the event's identifying thumbnail from the official Devpost page) |
| Source | `https://yunet-aignite26.devpost.com/` — organizer-published challenge thumbnail (Devpost CDN: `challenge_thumbnails/005/544/995/datas/large.png`), retrieved **2026-11-05** |
| Creator | YuNet AIgnite Buildathon 2026 organizers (Ostad × YUNet) |
| Licence basis | Organizer-published event artwork, displayed by an entrant as the event requires; no ownership claimed — the artwork belongs to the organizers |
| Files | `ai-ignite-2026-original.png` — the unmodified 300×300 download, preserved for provenance and larger placements · `ai-ignite-2026.png` — the header-displayed **identity crop** (300×114: the head-profile icon + “AIgnite” wordmark band) cropped from the original with PIL; pixels otherwise untouched (no recolour, no retouch, no reconstruction) |
| Why a crop | The full lockup (“Ostad presents” header, wordmark, two-line tagline) is illegible below ~100px; the implementation prompt requires a *readable* sticker placement in both shells. The crop keeps the actual organizer artwork's identity band — the same intentional-crop standard the prompt applies to the hero visual — while the unmodified original ships alongside it |
| Display | Discovery shell header: 32px (mobile) / 40px (≥sm) with a subtle ring; workspace shell header: 28px. Server-side fs probe (`/api/capabilities`) keeps the honest text-pill fallback when the file is absent |
| Honesty rules | The badge links to the official event page; the crop is disclosed here and in `public/badges/README.md`. No compliance claim beyond displaying the organizer's own artwork |

## `public/logo.svg`, `src/app/fonts/*`

Existing self-hosted assets (project mark and self-hosted variable fonts:
Fraunces, Geist, Geist Mono, Noto Sans Bengali) — unchanged; see
`src/app/layout.tsx` for font wiring.

