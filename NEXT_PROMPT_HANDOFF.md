# NEXT_PROMPT_HANDOFF.md — for the second build prompt

Owner: Adil · Baseline: 5 November 2026 · First build: see RELEASE_REPORT.md

## Architecture as shipped

- Single-page Next.js 16 App Router UI (`src/app/page.tsx` switches views
  via Zustand `useAppStore`); all server logic in `src/app/api/**` routes.
- Domain modules in `src/lib/`: `identity/` (scrypt+sessions),
  `catalogue/` (typed queries), `matching/engine.ts` (deterministic
  evaluator), `planning/` (templates + scheduler), `funding/engine.ts`
  (worksheet), `ai/` (provider adapter + features), `documents/storage.ts`,
  `ingestion/runner.ts`.
- Prisma schema (~30 models) in `prisma/schema.prisma`; JSON columns for
  nested catalogue shapes validated by Zod (`src/lib/validation.ts`).
- Guests: localStorage persistence; account creation merges exactly once
  (`/api/sync/merge-guest`, transactional).
- AI: `z-ai-web-dev-sdk` behind `src/lib/ai/provider.ts` (timeout, 2
  retries, daily quota, `AiRun` sanitized logs). Fallbacks are labelled
  templates, never fake AI.

## Migrations and data

`bun run db:push` (SQLite; Postgres-ready). Seeds in `prisma/seeds/`:
27 sources, 3 country guides (EN+BN), 11 opportunities. Idempotent via
`bun prisma/seed.ts`. To add a record: copy an existing seed file's
structure, extend `SOURCES`/`COUNTRY_GUIDES`/opportunity arrays, re-run.

## Source coverage state

All 11 records are `baseline_review` (checked against official pages
2026-11-04). Next-cycle verification is the top editorial task: run
ingestion from an unrestricted network, then review/publish per field.
`FactEvidence` + `ReviewEvent` + `AuditEvent` already model the pipeline;
an "evidence applied → catalogue field update" step is the missing link
(admin approval currently records and notifies but does not rewrite the
catalogue row — deliberately, to avoid unreviewed auto-mutation).

## Failing / blocked checks (from the release report)

1. Organizer sticker asset — blocked on owner/network.
2. Cycle-date re-verification — blocked on network in build environment.
3. Vitest/Playwright suites — deferred by environment policy (no test code
   written; add `vitest` for the engines first: matching, planning,
   funding math are pure functions).
4. Production build/deploy — not attempted (`bun run dev` only, per
   environment rules); `next build` path is standard.

## Best next builds (ranked)

1. **Editorial catalogue updates**: when approved evidence changes a
   deadline/amount, write the new value into the `Opportunity` row with
   version history + a "changed" badge on the detail page.
2. **Engine test suite**: unit tests for `matching/engine.ts` (all
   operators), `planning/engine.ts` (back-planning, capacity, stable
   keys), `funding/engine.ts` (period math, unknowns), `dates.ts` (ICS).
3. **More verified records** toward 12+: e.g., specific Erasmus Mundus
   consortia with published current-cycle deadlines; DAAD course-level
   EPOS entries; a second Japan university programme.
4. **Recommender briefing packet generation** from profile facts
   (deterministic template + optional AI polish).
5. **Deadlines board**: upcoming official dates across shortlist with
   precision-aware sorting.
6. **Bangla content pass**: translate the remaining EN-only catalogue
   notes (deadlineNote, exclusions for a few records).
7. **Speech practice** (if scope allows): read-aloud + transcript-based
   feedback, clearly labelled non-official.

## Conventions to preserve

- Never let AI override deterministic results; explain only.
- Unknown → `needs_information` / `needs_institution_confirmation`, never
   an automatic pass.
- Competitive awards are not guaranteed funds; unknown costs block totals.
- Date-only values never gain times or timezones (ICS uses VALUE:DATE).
- Every private entity ownership-checks server-side; admin from session
  only.
- Commit style: conventional prefixes, one concern per commit.
