# REPAIR_AUDIT.md — Uraan Prompt 02

Audit date: 4 November 2026 (Asia/Dhaka) · Audited commit: `16ee52f`
Live deployment checked: https://study-abroad-one-zeta.vercel.app/

Every finding below was re-checked against the current code before repair.
Evidence categories: **[live]** reproduced on the deployed URL,
**[code]** verified by reading the current source, **[external]** official
page re-fetched during this audit, **[documented]** evidence supplied by the
owner's audit prompt (network path to that host failed here).

## P0 — Production broken

### P0-1 Deployed `/api/health` 503, `/api/catalogue` 500 · [live]
- Reproduced: `GET /api/health` → `503 {"ok":false,"data":{"status":"degraded","database":"unreachable"}}`;
  `GET /api/catalogue` → `500` with an **empty body**.
- Root cause (two independent faults):
  1. **Persistence**: `prisma/schema.prisma` uses `provider = "sqlite"` with a
     local file `DATABASE_URL`; a bundled SQLite file is not durable across
     Vercel function instances, so the deployed database is unreachable.
  2. **Error envelope**: `src/app/api/catalogue/route.ts` has no try/catch —
     a Prisma throw surfaces as a blank 500 instead of a typed 503 envelope.
- Fix: shared service-error envelope with a request ID for every public
  route (§Fix 1); production deployment path documented for managed Postgres
  (§Fix 2 — environment has no Supabase/Neon/Vercel credentials; the exact
  blocker is named in RELEASE_CHECKLIST.md).
- Expected: catalogue failure returns `503 {"error":"service_unavailable",
  "requestId":…}`; the UI shows a retryable service state, never a fake zero.

### P0-2 Hardcoded coverage counts · [code]
- `src/lib/i18n/en.ts` + `bn.ts`: `home.coverageNote`, `sources.coverageBody`,
  `footer.coverage` hardcode "11 opportunities" (and "১১টি"). During the
  outage the home page still advertised 11 while Explore showed none.
- Fix: counts derive from live catalogue data (`/api/health` stats +
  `/api/catalogue`), with loading/error/zero states distinguished. [Fix 3]

### P0-3 Filesystem persistence for private documents · [code]
- `src/lib/documents/storage.ts` writes under `./db/private-docs` — ephemeral
  on serverless; uploads cannot survive redeploys.
- Fix: storage adapter interface — local adapter kept **explicitly for
  development**, S3-compatible adapter (endpoint/key/secret env) for
  production. [Fix 4]

### P0-4 Registration can mint an admin · [code]
- `src/app/api/auth/register/route.ts` line 32:
  `role = adminEmails.includes(email) || anyAdmin === 0 ? "admin" : "student"`.
  With an empty allowlist and no admin, **the first stranger to register
  becomes admin**; with a non-empty allowlist, anyone claiming an allowlisted
  address via the unverified public form also becomes admin.
- Fix: registration always creates `student`; admins are provisioned only by
  a server-side owner-run bootstrap command (`bun run admin:grant`) or by
  `ADMIN_EMAILS` **at sign-in of the real owner** (still re-verified). [Fix 5]

### P0-5 Guest data destroyed on failed merge · [code]
- `src/components/uraan/auth-dialog.tsx` `mergeGuest()`: `await fetch(...)`
  with no `res.ok` / schema check, then `resetDomain()` — a 400/500/timeout
  erases the guest's only copy.
- Fix: clear local state only after a validated durable receipt; failures
  keep data and offer retry/export. [Fix 6]

## P1 — Correctness and trust

### P1-1 Guest merge not idempotent · [code]
- `src/app/api/sync/merge-guest/route.ts`: every call archives prior goals
  and creates a new goal+plan; a network retry duplicates imports and
  overwrites the account's plan without preview.
- Fix: client-generated `importId` + DB unique constraint + transaction;
  retries return the original receipt; existing-plan conflicts return `409`
  with a preview instead of silent overwrite. [Fix 6]

### P1-2 Session bootstrap skips `/api/state`; store unscoped · [code]
- `src/app/page.tsx` hydrates the session user only; a returning signed-in
  user sees guest/local state. `src/lib/store.ts` persists one
  `uraan.state` key regardless of account — logout does not clear it.
- Fix: full state hydration on session restore; cache scoped
  `guest`/`userId`; cleared on logout/switch. [Fix 7]

### P1-3 "Published" evidence never changes the catalogue · [code]
- `src/app/api/admin/review/route.ts` PATCH updates FactEvidence/audit and
  notifies users, but the published Opportunity row is never written — the
  notice claims a change that didn't happen.
- Fix: transactional publish against a validated field allowlist with
  version check, prior-value history, cache invalidation, deduplicated
  notices, rollback on failure. [Fix 8]

### P1-4 Type gate disabled, no tests · [code]
- `next.config.ts`: `typescript.ignoreBuildErrors = true`; no test script.
- Fix: flag removed, `tsc --noEmit` clean, Vitest suite added for engines
  and critical logic. [Fix 9]

### P1-5 Matching engine passes unknowns · [code]
- `src/lib/matching/engine.ts` line 131 `meets: meets !== false` — a
  null/NaN score counts as *met*; loose `.includes()` test-family matching;
  `hasCompletedBachelor` infers completion from labels containing
  "bachelor" (no completed/expected distinction); birth-year-only age
  checks reported as "fits the published window".
- Fix: strict null/NaN → `needs_information`; normalized test families;
  qualification `status` (completed/expected) honored; age rules with
  day-level cutoffs resolve to `needs_institution_confirmation` unless
  fully determinable. [Fix 10]

### P1-6 Money/funding math · [code]
- `src/lib/money.ts`: `total_award` annualized as-is; a single `rate`
  number is applied to **every** foreign-currency line (an EUR line
  converted with the USD rate — silent wrong math, worse than null);
  `sumAnnualCosts([])` returns `total: 0` (empty = free); hardcoded
  `DEFAULT_PLANNING_RATES` presented as defaults.
- Fix: per-line currency with per-currency editable planning rates;
  duration-aware award annualization; empty cost arrays → unknown living
  costs; no hardcoded silent rates. [Fix 11]

### P1-7 Planning engine anchors wrong · [code]
- `src/lib/planning/engine.ts`: `anchorDate` takes the **first** official
  deadline even if past/closed; spring=April/fall=September month guessing;
  overdue template tasks clamped to `today+7` (dumping stale prep into next
  week); capacity checked only over the whole horizon, not before each
  deadline.
- Fix: select the relevant **future** deadline by type for the selected
  cycle; approximate windows only when the seed marks them approximate;
  overdue work rescheduled across remaining capacity; per-deadline load
  check; replan preserves completed/user-edited tasks. [Fix 12]

### P1-8 Level filter hides combined records · [code]
- `src/lib/catalogue/queries.ts`: `where.level = filters.level` exact match
  — `master_phd` opportunities invisible under Master's and PhD filters.
- Fix: inclusion semantics in API + UI. [Fix 13]

### P1-9 AI provider gaps · [code]
- `model: "zai-default"` placeholder metadata; guest quota bypass
  (`if (!userId) return true`); JSON replies parsed loosely without zod at
  the feature layer; template fallback's word-count "level estimate".
- Fix: provider reports actual model id when available; guest quota
  enforced per-IP in DB; every AI feature validates output with zod;
  template fallback relabelled as structural feedback, never a band. [Fix 14]

### P1-10 Obsolete / conflicting catalogue facts · [external][documented]
- **UTokyo PEAK** seed: `cycleYear: 2027, cycleStatus: "in_progress",
  close 2027-01-31` — official notice (May 12 2025) says the final PEAK
  recruitment was for **fall 2026** enrollment; the programme is closed
  for future intakes. [documented — peak.c.u-tokyo.ac.jp timed out from
  this sandbox; owner should re-open the notice PDF to re-confirm]
- **MIT** seed: "approximate January 1" — the canonical deadlines page
  **fetched live during this audit** states Regular Action due
  **January 4** (EA November 1). [external, verified 2026-11-04]
- Fix: PEAK archived (`cycleStatus: closed`, historical note, no future
  dates); MIT corrected to sourced Jan 4 with evidence; all other records
  re-labelled with explicit review states. [Fix 15]

## P2 — Experience

### P2-1 View-switch navigation, URL stays `/` · [code]
- All screens switch via Zustand; no deep links, no back/forward, no
  per-view titles.
- Fix: durable query-param routes on `/` (`/?view=explore&…`) with
  pushState/popstate, titles, and deep-linkable non-sensitive params.
  The hosting sandbox for this build exposes a single app route, so real
  App Router paths are documented in DEPLOYMENT.md for the owner's
  deployment instead of being created here. [Fix 16]

### P2-2 Sparse home, generic cards · [code]
- Fix: premium redesign per the design brief (typography, composed hero
  illustration, editorial layout) applied to every core screen. [Fix 17]

## Non-issues (checked, no defect found)

- `/api/health` already returns a typed 503 envelope (but see P0-1(1) for
  the underlying database fault and P0-1(2) for catalogue).
- Session cookies are httpOnly + server-side auth checks exist on private
  routes; ownership checks present on documents/state/plan routes.
- Guest shortlist/task writes already go through API when signed in.

## Repair order (matches commits)

Fix 1 API envelopes → Fix 2 prod DB guide → Fix 3 derived counts →
Fix 4 storage adapter → Fix 5 admin provisioning → Fix 6 merge safety →
Fix 7 hydration/scoping → Fix 8 editorial publish → Fix 9 gates/tests →
Fix 10 matching → Fix 11 money → Fix 12 planning → Fix 13 filters →
Fix 14 AI → Fix 15 seeds → Fix 16 URLs → Fix 17 redesign → verify/release.
