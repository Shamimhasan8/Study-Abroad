# RELEASE_REPORT.md — Uraan first build

Build completed: 4–5 November 2026 (Asia/Dhaka). Research baseline: 4 Nov 2026.
This report is deliberately honest: it states what works, what is verified,
and what remains open.

## 1. What a real student can complete now (verified in-browser)

1. **Arrive as a guest** — read the home page, browse the full catalogue,
   read every opportunity's requirements, funding, dates, sources, and
   exclusions. No sign-in required.
2. **Complete 9-step onboarding** (degree, interests, intake, citizenship,
   education, languages/tests, budget, preferences, capacity) with
   autosave; answers survive reload.
3. **Explore and filter** the 11 real opportunities by destination, degree
   level, and cycle status, with word-based search.
4. **Open a detail page and run the deterministic match** — e.g. an HSC
   profile against MEXT Undergraduate correctly shows "12 years met",
   embassy screening "needs confirmation", and honest unknowns stay
   unknown.
5. **Set a target and generate a plan** — 20 back-planned tasks
   (templates + gap-driven tasks), weekly-capacity feasibility check,
   stable task IDs; complete a task and see 1/20 → persists after reload.
6. **Register an account and merge guest data exactly once** — goal, plan,
   completed tasks, and shortlist moved server-side; verified end-to-end
   (the completed task survived the merge).
7. **Use the preparation workspaces** — language study log, practice
   exercise with **live AI feedback (Bangla and English)**, experience
   journal, writing editor with autosave + version history + **live AI
   draft feedback**, recommender tracking with drafted request messages,
   research notes, private documents (upload/download/delete).
8. **Track applications** through self-reported states with an event
   timeline; **export** the plan (markdown) and calendar (all-day ICS).
9. **Switch the entire interface to Bangla** — real translations, proper
   `lang` attribute, readable typography.
10. **Admin (editorial) flow** — review queue, assisted evidence
    submission, approve/publish with audit entries and affected-plan
    notifications, ingestion run with persisted fetch health.

## 2. Verified degree/country routes

| Route | Coverage |
| --- | --- |
| Bachelor's | MEXT Undergraduate (JP, funded) · UTokyo PEAK (JP, self-funded) · MIT aid (US) · Harvard aid (US) |
| Master's | Erasmus Mundus (EU) · DAAD EPOS (DE) · DAAD Helmut-Schmidt (DE) · MEXT Research (JP) · Fulbright BD (US) · KHS (US) |
| PhD | MEXT Research (JP) · Fulbright BD (US) · KHS (US) · DAAD Research Grants (DE) |

All 11 records: official source links, retrieval date 2026-11-04,
`baseline_review` state, explicit cycle status (nothing falsely "open"),
date-only precision preserved. Country guides for US/DE/JP in EN+BN.

## 3. What was actually tested

- **In-browser end-to-end (headless browser, real flows):** home →
  onboarding (all steps) → explore (filter + search) → detail → match →
  plan generation → task completion → reload persistence → registration →
  guest merge → Bangla switch → prepare tabs → **live AI practice feedback
  and draft feedback** → mobile 360px layout + hamburger menu → sticky
  footer verified at viewport bottom and on overflow.
- **API smoke tests:** health (11 opportunities, 27 sources), catalogue,
  evaluate (deterministic engine), session (404→guest fallback),
  draft-feedback (live AI, real content).
- **Static checks:** ESLint clean; `tsc --noEmit` clean for all shipped
  code; dev server log clean after the full walkthrough.
- **Bugs found and fixed during verification** (each is a commit):
  guest task IDs all empty → one click completed everything; saved-plan
  task IDs fabricated → server PATCH would 404; education step rendered
  empty on first visit; multi-word search failed; Bangla goal title
  missing.

## 4. Integrations: live vs blocked

| Integration | Status |
| --- | --- |
| AI explanations / practice / draft feedback (z-ai-web-dev-sdk) | **LIVE** — verified real Bangla + English feedback; timeouts, retries, quotas, sanitized logging, labelled template fallback |
| Database (Prisma + SQLite) | **LIVE** — all writes verified through the merge flow |
| Auth (scrypt + session cookies) | **LIVE** — register/login/logout/merge verified |
| Source ingestion fetch | **LIVE code, network-restricted in sandbox** — the runner executes and persists jobs; outbound fetches to studyinjapan.go.jp etc. may be blocked by the sandbox and are recorded as failures (honest) rather than faked successes |
| Official organizer sticker (Devpost asset) | **BLOCKED** — asset not retrievable from the build environment; an honest text badge links to the event page. Recorded as a submission blocker for the owner |
| Email/push reminders | **NOT BUILT** (in-app only, as declared) |
| Tests (Vitest/Playwright) | **DEFERRED by environment policy** — no test code written; recorded here instead of being silently skipped |

## 5. Feature matrix

**Implemented & verified:** guest browsing · onboarding with persistence ·
EN/BN interface · catalogue (11 records, 27 sources, 3 guides) · filters,
search, shortlist, compare (≤3) · deterministic matching with 5-valued
results and conservative aggregation · funding worksheet (guaranteed vs
competitive, unknowns visible) · plan generation (back-planning, capacity
check, gap tasks, regeneration preview gate, stable IDs) · task completion
· applications + timeline · ICS export (all-day, no invented times) ·
markdown plan export · writing editor (autosave, versions, word limits,
AI-policy gate) · experience journal · recommenders · research notes ·
language log + AI practice · private documents (MIME/size checks, owner
gates, purge) · auth + one-time guest merge · account deletion · editorial
queue, evidence approval, audit trail, affected-plan notifications ·
ingestion runner with persisted jobs.

**Implemented, unverified in this environment:** scheduled (cron-style)
ingestion triggers · Postgres deployment path (SQLite used here) ·
production HTTPS cookie hardening (dev runs HTTP).

**Blocked:** organizer sticker asset (needs owner) · live re-verification
of every cycle date (needs network access to official pages).

**Deferred (next prompt):** speech practice scoring · email/push · mentor
collaboration · Russia-origin routes · more countries/programmes ·
automated fact extraction from fetched pages.

## 6. Known issues

- Catalogue cycle dates are baseline facts; the in-app data-freshness label
  says so on every record. Until an ingestion run + editorial review
  publishes updates, treat every date as "confirm on the official page".
- The writing editor's AI feedback is disabled when the draft's target
  AI-policy is "prohibited" — a deliberate integrity gate, not a bug.
- Hot-reload during development can emit transient React key warnings; a
  fresh load is clean (verified).

## 7. Owner checklist before the second prompt

1. Supply the official organizer sticker asset (or confirm the text badge).
2. Run one ingestion pass from a network-unrestricted environment and
   review the queue.
3. Register the real admin account first (or set `ADMIN_EMAILS`).
4. Deploy to a public URL and re-run the walkthrough in
   `docs/PRESENTATION.md` there.
5. Review `NEXT_PROMPT_HANDOFF.md` for the ranked next builds.
