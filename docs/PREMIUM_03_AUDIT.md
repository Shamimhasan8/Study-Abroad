# PREMIUM_03_AUDIT.md — baseline audit for the Premium Animated Mentor brief

**Repository:** https://github.com/Shamimhasan8/Study-Abroad
**Audit revision:** `9f45bd6` (main defect-fix range) — extended to `78a838f` by the post-audit browser-discovered fix (defect #15 below). All fixes in this document are committed and pushed.
**Audit date:** 5 November 2026, Asia/Dhaka
**Auditor environment:** local dev sandbox (`bun run dev`, port 3000, SQLite at `db/custom.db`, seeded: 11 opportunities / 27 sources / 3 guides). Production deployment (`study-abroad-one-zeta.vercel.app`) was NOT reachable for inspection from this environment — every production claim below is marked accordingly.

Legend: **[L]** = live-observed locally · **[C]** = code inference (verified against source, not runtime-reproduced) · **[X]** = could not run in this environment.

## 1. Baseline state (brief's "last inspected" items, re-checked)

| Item from the brief | Status at audit | Evidence |
| --- | --- | --- |
| Public catalogue returns 11 opportunities | Confirmed **[L]** | `/api/catalogue` and Explore card count = 11 |
| `/api/health` 200 with `degraded` + `seed-fallback` on Vercel | Expected by design **[C]**; local returns `healthy/database` **[L]** | `src/app/api/health/route.ts`; seed fallback added in `ba25568` |
| Seed fallback restores public reads only; no durable accounts/editorial/documents without a database | Confirmed **[C]** | `src/lib/catalogue/fallback.ts` (reads only; writes fail with typed 503) |
| Prisma provider still `sqlite` | Confirmed **[C]** | `prisma/schema.prisma` — production Postgres migration remains an owner action (DEPLOYMENT.md Step 1) |
| MIT record shows only the earlier (expired) round | Confirmed **[L]** → **FIXED** | Reproduced: `deadlines.find(d => d.closeDate)` returned `mit-ea` (2026-11-01, expired) on list/compare/detail; fixed in `5cc644f` |
| Header competition badge is a text placeholder | Confirmed **[C]** → **FIXED (slot)** | Explicit asset slot `public/badges/ai-ignite-2026.svg` + README documenting the blocker and owner action (`9f45bd6`) |
| A successful production AI response not independently verified | Still open **[X]** | No production credential in this environment; provider path is server-side and quota-wired (`src/lib/ai/provider.ts`) |
| Stack already includes framer-motion + Recharts | Confirmed **[C]** | `package.json` — no duplicate animation/chart systems installed by this audit |

## 2. Defects found and fixed in this audit

Severity order: data loss → functional → display/consistency. Every fix is one focused commit; all typecheck/lint/37 tests pass at `9f45bd6`.

| # | Defect (file:line at audit time) | Severity / affected flow | Root cause | Fix (commit) | Verification |
| --- | --- | --- | --- | --- | --- |
| 1 | `header.tsx:100-109` sign-out never reset `ownerKey` | **Data loss** — guest work done after sign-out was wiped when a *different* account signed in next (account→account discard branch) | `signOut` called `resetDomain()` but not `syncOwner(null)` | `69d4419` | Code-path audit vs `settings-view.tsx` (which was already correct); typecheck/lint |
| 2 | `page.tsx:202-211` + `auth-dialog.tsx` merge decision was component state | **Data loss** — reload during the non-dismissable merge prompt clobbered the unmerged guest snapshot via `/api/state` hydration, permanently | No persisted pending-merge flag | `c884055` | Flow walkthrough (code level): startup now skips hydration + re-opens dialog; all three outcomes clear the flag |
| 3 | `applications-view.tsx` optimistic add | **Data loss/integrity** — permanent duplicate card after POST (pending id ≠ server id); silent rollback-free failure; status PATCH on pending rows never persisted | `upsertApplication` matches by id; fire-and-forget PATCH/DELETE | `5d76a97` | Code audit + API contract check (`already_tracked` → rollback+toast) |
| 4 | `writing-tab.tsx` / `research-tab.tsx` autosave | **Data loss** — tab switch/unmount dropped the last 1.2–1.5 s of typing; language switch re-ran load effects and reset editor/form to server content | cleanup only cleared the timer; load-effect deps included `t` | `4100aff`, `9037f8d` | Code audit; `toast` proven stable (module-level function) |
| 5 | `onboarding-view.tsx:470+/647+` index-keyed uncontrolled rows | **Data corruption** — deleting a middle qualification/test row made remaining rows display the deleted row's values and blur-merge stale data into shifted records | `key={idx}` + `defaultValue` inputs | `6626312` | Controlled-input rewrite; display derives from state |
| 6 | `journey-view.tsx:84-107` generate() | **Functional** — 422 `needs_profile` / 5xx / network failure stopped the spinner with zero feedback | success-only branch | `1a2159b` | Code audit; new bilingual keys |
| 7 | `dates.ts:13-15` `todayISO()` used UTC | **Functional** — for UTC+6 users overdue detection / round anchoring / capacity weeks were off by one day between 00:00–06:00 local; two "today" helpers disagreed | `toISOString().slice(0,10)` | `7d43632` | Local-date derivation verified |
| 8 | `dates.ts` `buildICS` DTEND == DTSTART | **Functional** — zero-length all-day events; strict calendar clients drop them (exported deadlines could vanish) | RFC 5545 non-inclusive end | `7d43632` | ICS output verified: `DTSTART:20261105` → `DTEND:20261106` |
| 9 | `explore/compare/detail/journey` deadline selection | **Display correctness** — expired Early Action shown as the current deadline while Regular Action was live | `deadlines.find(d => d.closeDate)` picks the first array entry | `5cc644f` | Empirical check on MIT seed data: next round = `mit-ra` 2027-01-04, EA flagged expired, all-closed fallback flagged |
| 10 | `page.tsx:137-149` store→URL effect | **UX** — one `pushState` per keystroke in Explore search; Back replayed the search character by character | effect fired on every `exploreFilters` change | `5be48a5` | Query-only changes now `replaceState`; nav/filter picks still push |
| 11 | detail shortlist/goal buttons; writing drafts list label | **A11y** — toggle state invisible to screen readers; drafts list labeled "Version history" | missing `aria-pressed`; wrong key | `5be48a5` | Attributes added |
| 12 | `calendar-view.tsx` vs `api/calendar/ics` submitted-date basis | **Consistency** — same milestone on different days in-app vs exported (`updatedAt` vs `createdAt`) | no shared basis | `5be48a5` | Both use newest `submitted` event, `updatedAt` fallback; ICS mirrors the in-app filter |
| 13 | `planning/engine.ts:78` spring intake month = May | **Consistency** — assumed planning window disagreed with the published "Spring (April)" label by a month | month index 4 vs 3 | `5be48a5` | Aligned to April |
| 14 | `api/admin/ingestion` POST-only while Vercel Cron sends GET | **Operational** — the documented cron schedule would 405 on every run; ingestion never fires | route exported only POST | `a3f7246` | **[L]** GET/POST without credential and GET with wrong secret all return 401 locally |
| 15 | `store.ts` `applyFromUrl` merged URL snapshots over current state | **Functional** — found during browser verification AFTER the main audit: Back/Forward could change views but never *remove* a filter/tab/compare selection; the store→URL sync re-pushed the merged state and cancelled the navigation | merge instead of replace semantics | `78a838f` | **[L]** Browser E2E: filter to Master's (6 cards) → Back restores 11 cards → Forward re-applies 6 cards |

## 2a. Fix commit index (audit → repair range)

`69d4419` → `78a838f`: 15 defect-fix commits + audit doc + sticker slot + lint chore, all pushed to `origin/main`. Verification at each step: `bun run typecheck` (0 errors), `bun run lint` (0 errors/warnings), `bun run test` (37/37).

## 3. Checked and clean (no action needed)

- **i18n parity:** `en.ts` / `bn.ts` key sets are in exact parity (scripted diff at audit time; new keys added in parity). All `t()` call sites resolve in both languages.
- **Engines:** matching, money, and planning engines — no arithmetic/logic defects found (null-safe thresholds, integer BDT math with unknown-propagation, no division-by-zero, anchor = earliest future official deadline with type priority).
- **API authorization:** every private route checks `getCurrentUser()` and scopes by `userId`; admin routes gated server-side; register can never mint an admin; guest merge has importId idempotency + 409 conflict preview; document upload validates MIME/size and purges orphans.
- **api-client:** no auto-retry of POSTs (no double-submit risk); timeouts via AbortController.
- **URL routing:** all query params whitelisted/regex-validated; invalid values degrade to defaults.

## 4. Open items (owner actions / blocked in this environment)

| Item | Blocker | Exact action needed |
| --- | --- | --- |
| Production verification of the whole audit | No Vercel access from sandbox **[X]** | Owner: confirm the deployment from `9f45bd6` passes and `/api/health` reports `seed-fallback` degraded mode |
| Durable accounts/editorial/documents in production | Prisma provider is `sqlite` (intentional for dev) | Owner: follow DEPLOYMENT.md Step 1 (Supabase Postgres conversion + committed migration + idempotent seed) |
| Production AI response verification | No production credential **[X]** | Owner: set the AI env vars on Vercel and run one `/api/ai/explain` request; check the `AiRun` row |
| Official competition sticker | Asset not retrievable in the build environment | Owner: drop the official asset at `public/badges/ai-ignite-2026.svg` (slot documented in `public/badges/README.md`) |
| Scheduler verification end-to-end | Needs a deployed `INGESTION_CRON_SECRET` + vercel.json | Owner: add the cron config, then verify a `done` IngestionJob row and review-queue entries after the first run |
| Competition deadline discrepancy (22:00 vs 23:59 platform vs prose) | Rules may change | Owner: recheck https://yunet-aignite26.devpost.com/rules before submission materials |

## 5. Verification commands and outcomes (audit revision)

```
bun run typecheck   → 0 errors
bun run lint        → 0 errors, 0 warnings
bun run test        → 37/37 passed (3 files)
curl GET/POST /api/admin/ingestion (no/wrong credential) → 401 ×3  [L]
nextDeadlineDisplay(MIT deadlines) → mit-ra 2027-01-04, expired:false [L]
buildICS single-day event → DTEND = DTSTART + 1 day                  [L]
```

Browser E2E of the fixed flows was performed after this audit's fixes (see PREMIUM_03_ACCEPTANCE notes in the release report section of this repository's docs as they are produced).

## 6. What this audit did NOT do (honest scope)

- No redesign, motion system, mentor, scenario tool, or new IA from the Premium 03 brief — those are Phase B+ work, deliberately not started here. This audit covers Phase A (baseline + defect repair) only.
- No production/field Core Web Vitals measurements; no production user-data verification.
- Local sandbox results are never presented as production evidence.
