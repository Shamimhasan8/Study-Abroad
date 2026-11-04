# ARCHITECTURE.md — Uraan system design

## Shape: a maintainable modular monolith

One Next.js 16 App Router application containing UI, authenticated API
routes, and domain modules. No microservices, no second backend, no extra
agent frameworks.

```
UI (single-page student interface, nested views)
  │  fetch() — typed JSON contracts
API routes (src/app/api/**) — auth + ownership checks at every boundary
  │
  ├── Prisma (SQLite) — facts, profiles, plans, progress
  ├── Domain modules (src/lib/**) — deterministic engines
  ├── AI adapter (z-ai-web-dev-sdk, server-side only)
  └── Private document storage (db/private-docs, owner-checked)
Ingestion worker (admin-triggered + schedulable) → review queue → publish
```

## Stack decisions and sandbox equivalents

The build environment provides a fixed, supported stack. Where the original
research design named other services, this release implements an equivalent
and documents the difference:

| Concern | Research design | This release | Notes |
| --- | --- | --- | --- |
| DB | PostgreSQL | SQLite via Prisma | Same schema/migrations; swap `DATABASE_URL` for Postgres to move |
| Auth | Supabase Auth | First-party session auth: scrypt password hashing, opaque server-side session tokens in httpOnly cookies, `Session` table | Ownership checks live in API routes, not client flags |
| Files | Supabase private Storage | `db/private-docs/{userId}/{docId}` on disk, short-lived authorized download through the API with MIME/size checks and deletion lifecycle | Never a public path |
| AI | Provider adapter | `z-ai-web-dev-sdk` adapter behind `src/lib/ai/provider.ts` with timeouts, Zod validation, quotas, cost ceiling, graceful failure | Model never writes to DB or sends messages |
| Tests | Vitest + Playwright | Deferred in this environment (see RELEASE_REPORT) | Not skipped silently — recorded |

## Module layout

- `src/lib/identity/` — password hashing, sessions, guest→account merge.
- `src/lib/catalogue/` — country guides, opportunity queries, provenance.
- `src/lib/matching/` — deterministic requirement evaluator + gap report.
- `src/lib/planning/` — task templates, back-planning scheduler, replanning.
- `src/lib/funding/` — money math, uncovered-cost and upfront-needs calc.
- `src/lib/ai/` — provider adapter, evidence-bound explainers, draft feedback.
- `src/lib/documents/` — upload validation, storage, deletion.
- `src/lib/ingestion/` — allowlisted polite fetch, job persistence, review.
- `src/app/api/**` — thin HTTP layer: validate (Zod), authorize, call modules.

## Data model

See `prisma/schema.prisma`. Highlights:

- Every private entity (profile, plan, drafts, documents…) carries `userId`
  with enforced relations; API paths check session→user→ownership.
- Published facts reference `FactEvidence` → `Source` with retrieval
  timestamp, content hash, review state, and applicable cycle.
- Statuses are explicit enums-as-strings (SQLite has no native enums):
  `unknown` is a distinct value, never `null`-overloaded.
- Money: integers in original currency + currency code + period
  (annual/semester/monthly/one_time/total) + `estimate` flag. No float math.
- Dates: `precision` (date | month | window | unknown), `timezone` only when
  the source states one, `official` vs `estimated` basis.

## Key flows

1. **Onboarding → plan.** Conversational steps build a typed profile
   (Zod-validated). Guest profile persists in browser storage; on
   registration it is merged server-side exactly once, without duplicates.
2. **Matching.** `matching/engine.ts` evaluates reviewed requirements against
   the profile and returns per-rule results
   (`met | not_met | needs_information | needs_institution_confirmation |
   not_applicable`) plus a conservative aggregate and a
   requirement→action mapping.
3. **Planning.** `planning/engine.ts` back-plans template tasks from the
   target intake (explicitly approximate when no verified deadline exists),
   respects weekly capacity, flags infeasible schedules, and preserves
   stable task IDs and completed history across replans.
4. **Editorial.** Admin-only queue: source fetch health → candidate evidence
   → diff → approve → publish creates `AuditEvent` + `NotificationEvent` for
   affected plans. Rejected/pending facts never reach the student catalogue.
5. **AI.** Explain-plan and draft-feedback calls go through the adapter with
   bounded retries, sanitized logging, and labeled template fallback when the
   provider is unavailable. Citations must resolve to supplied evidence IDs.

## Security posture

- Server-side authorization on every private route; admin role from server
  session only (never a client-supplied flag).
- Upload validation: allowlist MIME types, size ceiling, random storage keys,
  content served as downloads with `Content-Disposition: attachment`.
- Ingestion fetches only the allowlisted source registry (SSRF-safe: no
  user-supplied URLs), with timeouts, size limits, and conditional requests.
- No sensitive content in logs or analytics; sanitized AI-run metadata only.
