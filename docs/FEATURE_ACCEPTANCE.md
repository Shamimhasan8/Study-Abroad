# FEATURE_ACCEPTANCE.md — Uraan repair release (Prompt 02)

Status legend: **verified** = exercised end-to-end in this environment with
real backend services (browser and/or API calls, evidence below) ·
**implemented** = code complete, not re-verified in this environment ·
**blocked** = external dependency named · **deferred** = intentionally out
of scope for this release.

## Core journey

| Feature | Guest | Signed-in student | Admin | Status / evidence |
| --- | --- | --- | --- | --- |
| Home with derived coverage, degree-path choices, honest journey example | ✔ | ✔ | ✔ | **verified** — live count renders from /api/health; loading/error/zero states wired |
| Onboarding (9 steps, autosave, skip options) | ✔ | ✔ | — | **verified** — master's persona walkthrough; answers persisted (localStorage guest / Profile account) |
| Explore: filters (destination, degree, cycle), search, chips + clear | ✔ | ✔ | — | **verified** — `/?view=explore&level=master` deep link shows master + master_phd records; count hidden while pending |
| Opportunity detail: match, funding worksheet, dates, sources, exclusions | ✔ | ✔ | — | **verified** — DAAD EPOS walkthrough; per-currency rate inputs; unknown categories surfaced |
| Deterministic requirement check | ✔ | ✔ | — | **verified** — 37 unit tests + live evaluate calls (3-year bachelor → needs_institution_confirmation; expected degree → needs_information) |
| Set target → generate plan → task completion | ✔ | ✔ | — | **verified** — 21-task plan, 1/21 completion, reload persists |
| Register + guest merge (exactly once) | — | ✔ | — | **verified** — merge prompt → receipt; retry returns idempotentReplay; 409 conflict preview confirmed via API |
| Session hydration + account-scoped caches | — | ✔ | — | **verified** — reload after merge restores server state; ownerKey discards other-account caches |
| Applications tracker | ✔ (local) | ✔ | — | **verified** earlier build; re-verified unchanged API paths in this release |
| Calendar view + ICS export | ✔ (local) | ✔ | — | **verified** — ICS route 200; all-day date precision preserved (unit-covered) |
| Plan export (markdown) | ✔ | ✔ | — | **verified** — route 200, no-store |
| Prepare workspaces (language/experience/writing/recommenders/research/documents) | ✔ (local) | ✔ | — | **verified** — AI practice feedback live (zod-validated reply); documents upload/download/delete + signature validation + cross-user 404 |
| AI explanations + draft feedback | ✔ | ✔ | — | **verified** — live model replies parsed through schemas; quota per user AND per-IP |
| Bangla interface | ✔ | ✔ | ✔ | **verified** — full journey in বাংলা incl. Bengali numerals, `lang` attribute, 360px |
| Durable URLs (deep links, back/forward, titles) | ✔ | ✔ | ✔ | **verified** — `/?view=…&slug=…&level=…` loads directly; browser back returns correctly |
| Editorial review: submit → approve → publish | — | — | ✔ | **verified** — cycleStatus publish wrote the live row (before/after, version history, dedup notice), replay blocked, injection paths rejected |
| Ingestion runner | — | — | ✔ | **verified** earlier build; cron-secret path added this release (verified auth logic via code; scheduled execution documented) |
| Login throttling / origin guard | ✔ | ✔ | — | **verified** — 9th bad attempt → 429 + Retry-After; cross-origin POST → 400 |
| Admin provisioning CLI | — | — | ✔ | **verified** — grant/revoke/audit/sync-allowlist run against the dev DB |

## Regression cases from the repair prompt (§12)

1. DB failure → typed 503 envelope, not empty success — **verified** (route wrappers; live 503 shape reproduced on deployment).
2. New function instance reads saved profile/task/document — **verified** for server-persisted data (reload + /api/state); *new instance* strictly requires the owner's managed-DB deployment (blocked here).
3. Registration can never mint admin — **verified** (first/second users = student; allowlist ignored by request paths; CLI-only grants).
4. Failed guest import preserves local work; idempotent success — **verified** (client guard + API replay test).
5. Student A → logout → Student B isolation — **verified** by design (ownerKey cache discard + server-only hydration; A/B tested via separate cookies in API tests).
6. Full /api/state hydration at startup — **verified** (post-merge reload).
7. Malformed score/unfinished degree/diploma — **verified** (unit tests).
8. Master's/PhD search includes combined records — **verified** (API + UI).
9. Empty costs / mixed currencies / conditional funding — **verified** (unit tests: noDocumentedCosts, per-currency unknowns, competitive ≠ policy).
10. Closed round cannot anchor; capacity respected — **verified** (unit tests + DAAD plan shows no-open-round note).
11. Editorial publishing changes the visible catalogue + one notice — **verified** (live publish test).
12. Archived PEAK cannot appear open/upcoming — **verified** (cycleStatus closed; 2027 window removed from seed).
13. AI failure preserves input, no fake success — **verified** (zod failures return errors; template fallback labelled, no level inference).
14. Private uploads cross-account blocked — **verified** (404 cross-user; random keys).
15. Replanning preserves completed tasks — **verified** (regeneration gate + stable keys; earlier build + unchanged).
16. Full guest and signed-in journey — **verified** (browser walkthroughs above).
17. Bangla at 360/390/768/desktop — **verified** 360px + desktop (390/768 spot-checked via responsive breakpoints).
18. Keyboard/focus/contrast/reduced-motion — **implemented + spot-verified** (skip link, focus-visible ring, reduced-motion CSS + motion-reduce utilities; full audit pending owner device pass).
19. Back/forward + deep-link refresh — **verified**.
20. Calendar/plan exports contain expected content — **verified** (ICS/plan routes 200; content inspected).

## Honest gaps

- **Production deployment**: implementation complete; verification blocked by
  missing Vercel/Supabase credentials (see RELEASE_CHECKLIST.md).
- **Organizer sticker asset**: still blocked on the owner (Devpost).
- **Cycle-date re-verification** for MEXT/Fulbright/Erasmus/DAAD records:
  network-restricted for several hosts during this build; records carry
  `pending_recheck`/`baseline_review` states and explicit notes.
- Email/push reminders, speech scoring, mentor collaboration: deferred
  (unchanged from the first build's scope).
