# RELEASE 06 STATUS — Uraan homepage-completion release

Owner: Adil · Build window: 5 November 2026 (Asia/Dhaka) ·
Baseline revision: `7894cb3` (hero + demo + opportunities + funding +
mentor homepage sections) → this release: `c1ef1b6` + this document.

Contract source: `upload/Uraan_Master_Implementation_Prompt_06_Target_40_of_50.md`.

Statuses used below (nothing else): **implemented**, **verified locally**,
**verified deployed**, **blocked/not tested**. This environment cannot
deploy to Vercel, so nothing here is "verified deployed"; every claim
states exactly what was run and where.

---

## Checkpoint 1 — the visibly redesigned homepage: COMPLETE, verified locally

The homepage narrative required by prompt §6 is now fully composed. The
four baseline sections landed in `84e1c5d`–`7894cb3` (hero, degree
selector, requirement→task→evidence demo, opportunities preview, funding
explainer, mentor preview). This release adds the remaining pieces:

### 1. FAQ + final CTA closing section (`1968d89`) — implemented, verified locally

- Five honest questions (free release, real coverage limits, no
  guarantees, guest persistence vs account sync, source discipline) in a
  keyboard-operable Radix accordion — `home-faq-cta.tsx`
- Deep-green closing band: primary CTA becomes "Continue my plan" for
  returning users; secondary opens the verified opportunities browser;
  "Take the tour again" replays the tour explicitly
- EN + BN strings; accordion expansion browser-verified

### 2. Optional first-visit guided tour (`2ce2c34`) — implemented, verified locally

Prompt §7: Skip / Back / Next / Finish, Escape to skip, anchored to four
REAL homepage controls (degree radiogroup, `#home-search`,
`#hero-primary-cta`, `#demo-title`), live anchor resolution (missing
targets skipped safely), temporary coral highlight ring that never traps
focus, localStorage completion flag so it never restarts uninvited,
explicit replay via `restartTour()`, reduced-motion fade path.

Browser-verified end-to-end (Playwright-driven agent browser):
welcome card appears on first visit → all four steps advance with
correct titles and "Step N of 4" counter → Finish dismisses → reload
does NOT resurface it → "Take the tour again" restarts it → Skip
dismisses it. Desktop and 360px mobile.

### 3. Official organizer sticker (`c1ef1b6`) — implemented, verified locally

Prompt §14. The organizer's actual artwork (event thumbnail published on
the official Devpost page, retrieved 2026-11-05) now renders in the
header of BOTH shells at readable sizes — previously the slot was an
honest text-pill placeholder and the badge was hidden below `sm`
(failing the mobile readability requirement). The full unmodified
300×300 original ships alongside the displayed identity-band crop
(head-icon + AIgnite wordmark); crop rationale and licence basis in
`docs/ASSET_PROVENANCE.md`. The fs probe + honest text fallback are
preserved for an absent asset.

Visual verification (model-inspected screenshots):
- Discovery header 1440px: 40px, ring-framed, wordmark legible — PASS
- Discovery header 360px: 32px, no horizontal overflow — PASS
- Workspace shell: 28px, ring-free, brand remains dominant — PASS

## Homepage acceptance evidence

Screenshots in `docs/screenshots/release06/`:

| File | What it shows |
| --- | --- |
| `home-final-desktop.png` | Full homepage at 1440px — all ten sections render (header w/ sticker, hero, degree cards, demo, opportunities, funding, mentor, FAQ, CTA band, footer) |
| `home-final-mobile.png` | Full homepage at 360px — no overflow, sections stack cleanly |
| `home-final-tour.png` / `home-final-mobile-tour.png` | First-visit tour card on desktop / mobile |
| `sticker-desktop-header.png` / `sticker-mobile-360-header.png` / `sticker-workspace-shell.png` | Official sticker placement in all three required locations |

Note on full-page screenshots: below-the-fold sections animate in via
framer-motion `whileInView`; full-page captures were taken after
scrolling through the page so every section is visible. This is a
capture artifact, not a defect — keyboard/screen-reader users reach all
content regardless (verified in the accessibility tree).

## Quality gates at `c1ef1b6`

- `bun run typecheck` (tsc --noEmit): **pass**
- `bun run lint` (eslint): **pass**
- `bun run test` (vitest): **47/47 pass**
- Dev server (`bun run dev`, port 3000, this environment): homepage,
  `/api/capabilities` (sticker `available: true`, database reachable,
  catalogue seeded — 11 opportunities), sticker asset HTTP 200

## Honest limitations of this release

1. **Nothing is verified deployed.** The public Vercel URL still serves
   the previous revision until the owner pushes and Vercel builds. All
   verification above is local to this environment.
2. **Checkpoint 2 (complete guided student journey) is not re-verified
   this release.** The underlying flow (onboarding → target → gap → plan
   → task → persistence → mentor) exists from prior releases; the
   acceptance list in prompt §15 (refresh/back-forward, guest merge,
   cross-account access, uploads, replan tokens) was not re-run today.
3. **Checkpoint 3 (production services) remains blocked on owner
   credentials:** managed-Postgres migration, Supabase private document
   storage, and deployed live-AI verification each require secrets this
   environment does not hold. Code paths are implemented and
   locally verified (see `docs/DEPLOYMENT.md` for the exact steps).
4. The sticker is the organizer's event thumbnail (the identifying
   artwork published on the official Devpost page). If the organizers
   distribute a distinct "sticker" asset, drop-in replacement is a
   two-file overwrite (`public/badges/README.md` documents this).
5. No motion video capture was produced this session; the tour and
   section entrances were verified through interaction testing and
   stills, not a recorded sample.

## Next executable actions (in priority order)

1. **Push + deploy:** push this branch; let Vercel build; then re-run
   the sticker/tour/FAQ checks against the public URL (owner action —
   this environment cannot deploy).
2. **Checkpoint 2 re-verification:** run the §15 browser checklist
   end-to-end on the deployed URL (disposable QA account).
3. **Checkpoint 3 gates:** provision managed Postgres + Supabase
   storage + AI env vars per `docs/DEPLOYMENT.md`, then verify account
   sync, uploads, and a real live-mentor answer on the deployed host.
4. **Motion evidence:** record a short capture of the tour + section
   entrances for the submission deck.
