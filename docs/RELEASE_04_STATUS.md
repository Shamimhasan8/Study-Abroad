# RELEASE 04 STATUS — Uraan competitor-audit execution

Owner: Adil · Build window: 5 November 2026 (Asia/Dhaka) ·
Baseline revision: `22dd602` (the audited state) → this release: see `git log`.

Contract source: `upload/Uraan_Competitor_Audit_and_Execution_Prompt_04.md`
(Part II implementation contract, Gates 1–5).

Statuses used below (nothing else): **implemented**, **verified locally**,
**verified deployed**, **blocked/not tested**. This environment cannot
deploy to Vercel, so nothing in this release is "verified deployed"; every
claim below states exactly what was run and where.

---

## Gate 1 — Repair contracts and prepare durable services

### 1a. Replan response mismatch (the audited defect) — FIXED, verified locally

- Server returned `data.preview`; `journey-view` read `preview.plan`; the
  confirmation gate never rendered. Both boundaries now parse ONE
  discriminated contract.
- `src/lib/planning/replan.ts` — shared Zod contract
  (`plan` | `confirmation{previewToken, proposalHash, preview, preserved}`),
  canonical preview serialization, preservation merge, `PREVIEW_TTL_MS`.
- `prisma/schema.prisma` — new `PlanPreview` model: the EXACT reviewed
  proposal is persisted server-side. Confirm echoes `previewToken` +
  applies the persisted tasks (never a regenerated proposal),
  re-merging completed/edited work from the CURRENT active plan.
  One-time token, 24 h TTL, sha256 hash check.
  Errors: `409 stale_preview`, `400 preview_token_required`,
  `409 preview_hash_mismatch`.
- Applied via `bun run db:push` (SQLite, non-destructive; schema remains
  Postgres-portable).
- Tests: `tests/replan-contract.test.ts` (10 regressions: legacy-shape
  rejection, preservation merge semantics, hash stability/sensitivity).
  Full suite: **47/47 pass** (`bun run test`).
- Live API verification (curl, this environment):
  preview → `kind:"confirmation"` with preserved counts (1 done · 1
  edited merged into the preview); bad token → 409; missing token → 400;
  real token → applied with notes `"My own approach: weekends only"` and
  the done task intact; token reuse → 409.
- Browser verification (signed-in QA account, screenshots in
  `docs/screenshots/gate4/`): the gate RENDERS (the headline bug),
  **cancel mutates nothing** (progress unchanged, gate dismissed),
  **confirm applies the reviewed version** (edited notes + completed task
  preserved server-side, verified via `/api/state`).

### 1b. Scenario preview/apply — implemented, verified locally (browser)

`POST /api/plan/generate` accepts `scenario` overrides (weeklyHours,
targetIntakeYear/Term, annualContributionBdt, upfrontFundsBdt) — merged
over the effective profile for the request ONLY. Scenario responses are
**preview-only**: the server never applies them (cancel changes nothing,
by construction). Apply = save profile, then generate (confirmation gate
included when edits exist). `scenario: true` marks preview plans in the
response. Browser-verified as a guest: diff card → apply →
`weeklyHours: 6` persisted, navigated to workspace.

### 1c. Capability states — implemented, verified locally

`GET /api/capabilities`: browsing / accountSync / privateUploads /
liveMentor, each REALLY probed (db count; storage upload→read→purge
round-trip; a tiny live provider completion — a fallback template never
counts as live AI), cached 10 min. The UI states them in ordinary
language ("Saves on this device" vs "Saving synced"; mentor offline vs
AI-assisted) in the workspace shell; operational detail stays out of
product copy. Local probe results: all four available (storage =
local-fs; mentor = live).

### 1d. Deployed AI fallback root cause — diagnosed; fix implemented; deployment owner-side

Root cause found: `z-ai-web-dev-sdk` reads a `.z-ai-config` **file**
(cwd/home//etc) — impossible on serverless hosts, so `ZAI.create()`
threw on Vercel and every feature degraded to `aiGenerated:false`.
Fix in `src/lib/ai/provider.ts`: hosts without a file config set
`ZAI_BASE_URL` + `ZAI_API_KEY` env vars (documented in `.env.example`);
the provider constructs the client directly (typed structural client).
**Owner action for Vercel:** set those two env vars in the project's
environment settings. This environment's provider is verified live
(mentor replies, capability probe).

### 1e. Durable database / object storage / deployment — blocked (environment), prepared

- This build environment supports SQLite only; the Vercel deployment
  needs the owner's Postgres conversion + migration (docs/DEPLOYMENT.md
  documents the procedure; the schema is Postgres-portable). Not
  performed here — no deployment access, and destructive resets are
  prohibited on real data.
- Supabase private storage remains configured via env (adapters exist,
  ownership-checked routes exist); the local adapter round-trip is what
  this environment could verify.
- Scheduler/secret behavior on the current host: unchanged from the
  audited revision (GET-with-cron-secret fix already in baseline);
  re-verification on the deployed host is an owner action.

---

## Gate 2 — One visibly transformed complete flow — verified locally (browser)

- **WorkspaceShell** (`src/components/uraan/shell/workspace-shell.tsx`):
  desktop side nav (224px) + central canvas + contextual mentor rail
  (304px, ≥xl only so the canvas keeps a useful reading width); mobile
  bottom navigation + More sheet + mentor bottom sheet that never covers
  primary controls; capability line + reduce-motion toggle; organizer
  sticker slot (shared `CompetitionBadge`, honest text fallback until the
  official asset lands at `public/badges/ai-ignite-2026.svg`).
- **WorkspaceView** (`workspace/workspace-view.tsx`): today's primary
  task (open/complete), two supporting actions, visual phase map with an
  equivalent accessible list and per-phase drill-down, upcoming dates,
  blocker summary (overdue / infeasible / real gaps), goal card with the
  shared replan gate, notifications.
- **TaskView** (`workspace/task-view.tsx`): why-this-matters, working
  notes with debounced autosave (localStorage mirror, restore-on-mount,
  failure keeps the draft + retry), category completion criteria,
  evidence + related-tool links, persist-first completion with an
  empty-note nudge, next-step hand-off. Deep-linkable
  (`?view=task&task=…`).
- **Mentor** (`api/ai/mentor/route.ts`, `mentor/mentor-rail.tsx`,
  `mentor/mascot.tsx`): grounded facts only (target, evaluation counts +
  top gaps, plan progress — guests send their validated local context;
  accounts ground on server truth), strict JSON output contract, action
  allowlist (6 types, ≤2, validated twice), deterministic basis line,
  labelled template fallbacks, owned persisted thread
  (GET latest 50 / DELETE clears), original mascot with 6 states,
  motion-safe. **Live AI verified in this environment** — real grounded
  replies with basis "Requirements checked: 0 met · 2 gaps · 1 needs
  confirmation — from official sources (1)".

All four verified in the browser at desktop + 360–390px, EN + বাংলা
(Bengali numerals included), with screenshots under
`docs/screenshots/gate4/`.

---

## Gate 3 — Discovery and planning surfaces — verified locally (browser)

- **Explore**: sorting (recommended / deadline-soonest / title /
  funding-coverage), fact-rich cards (tuition, apply fee, funding level —
  unknowns rendered honestly, never zero), destination guide chips,
  existing filters/chips/count/compare tray preserved.
- **Detail**: source drawer (Sheet) with ordinary-language verification
  state, deterministic fit summary (no AI), requirement matrix grouped by
  category with met / not-met / needs-info / needs-confirmation /
  unchecked state chips. Browser-verified (screenshot `detail-matrix.png`,
  `source-drawer.png`).
- **Funding view** (`?view=funding`): user planning exchange rates
  (persisted), costs grouped by when-needed (before enrolment / every
  year), unknown costs visible ("UNKNOWN, not free"), zero-documented
  upfront rendered as "not the same as free", policy vs competitive
  funding separated (competitive never reduces totals), funding timeline
  SVG + accessible list, contribution context. Verified in browser.
- **Applications / Calendar**: existing honest tracking + ICS/print
  exports preserved; workspace links verified.
- Requirement-comparison matrix + scenario preview = delivered above
  (matrix on detail; scenario drawer in workspace).

---

## Gate 4 — Verify the journey — verified locally (browser); deployed verification blocked

`bun run dev` (Next 16, port 3000) + agent-browser (Chromium) end-to-end:

- Search → filter (master → 6 results) → deep-link refresh survives →
  detail → requirement check → source drawer → set target → workspace →
  generate plan → open task → notes autosave (`userEdited: true`
  persisted) → mark done → **reload keeps completion** → what-if preview
  (current vs proposed diff) → apply → profile updated.
- Signed-in replan gate: renders (headline bug), cancel preserves,
  confirm applies with preservation (server-verified).
- Mentor: guest-grounded live reply + allowlisted actions; mobile bottom
  sheet.
- Bangla pass, 360px mobile (bottom nav + footer clearance spacer),
  sticky footer (short page: flush to viewport bottom; long page: pushed
  down naturally), keyboard skip-link + tab order, back/forward state
  restoration, sign-out owner isolation (ownerKey/profile/plan cleared).
- Console + page errors: none across the whole journey.
- NOT done here (no deployment access): disposable-account run on the
  real Vercel URL, cross-device sign-in, private-document upload against
  the production storage adapter. These remain the owner's verification
  after env vars + Postgres are configured.

Commands run: `bun run typecheck` (clean), `bun run lint` (0 errors /
0 warnings), `bun run test` (47/47), `bun run db:push` (non-destructive),
`bun prisma/seed.ts` (11 opportunities / 27 sources / 3 guides).

---

## Gate 5 — Release/submission readiness

- This status file is the truthful record; no win/traction claims.
- Organizer sticker: the asset slot (`public/badges/ai-ignite-2026.svg`)
  is probed at render time; until the owner drops the official asset,
  both shells show the honest text link (top bar, incl. a compact
  mobile-visible variant in the workspace top bar). Blocked on owner
  asset retrieval (documented in `public/badges/README.md`).
- Coverage copy remains derived from live stats (never hardcoded).

---

## Changed files this release (all commits)

```
fix(replan)    6a32d25  replan contract module + route + tests + journey-view port
feat(capabil.) 4b1816d  /api/capabilities, provider env-config fix, .env.example
feat(workspace)d9e4d33  shells, workspace/task/mentor/funding/scenario, explore+detail upgrades, routing
fix(mentor/…)  b904961  guest-grounded mentor, honest upfront line, gate evidence
```

New files: `src/lib/planning/replan.ts`, `src/app/api/capabilities/route.ts`,
`src/app/api/ai/mentor/route.ts`, `src/components/uraan/shell/*` (2),
`src/components/uraan/workspace/{workspace-view,task-view,scenario-drawer}.tsx`,
`src/components/uraan/mentor/{mentor-rail,mascot}.tsx`,
`src/components/uraan/funding/funding-view.tsx`,
`tests/replan-contract.test.ts`, `docs/screenshots/gate4/*` (12 PNG),
`docs/RELEASE_04_STATUS.md`.
Modified: plan generate route, validation, store, types, page, header,
home/calendar views, i18n EN+BN, prisma schema (+`PlanPreview`,
+`MentorMessage`), funding-view honesty line. Removed:
`journey-view.tsx` (folded into WorkspaceView superset).

## Blockers / owner actions (exact)

1. **Vercel AI env vars** — set `ZAI_BASE_URL` + `ZAI_API_KEY` (project
   env settings). This is the deployed `aiGenerated:false` fix.
2. **Postgres conversion** — follow docs/DEPLOYMENT.md (provider switch,
   committed migration, rehearsed apply, idempotent seed). Not possible
   from this environment.
3. **Supabase documents** — set `DOCUMENTS_STORAGE=supabase` +
   `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` for durable private uploads.
4. **Organizer sticker** — download the official asset from the Devpost
   page into `public/badges/ai-ignite-2026.svg`; it renders
   automatically near the top on both shells (incl. mobile).
5. **Deployed Gate 4 pass** — after 1–3: disposable account
   profile → target → plan → task → reload → sign-out/in → second
   browser; one private-document upload; one live mentor reply on the
   production URL; verify the served build is this revision.

## Next exact task (if execution resumes here)

All five gates are completed to the limit of this environment's access.
Resume point = owner action 1 (Vercel env vars), then re-run the
deployed-journey checklist above; nothing in the codebase is mid-change.
