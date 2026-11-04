# AGENTS.md — Repository instructions for coding agents

This repository contains **Uraan**, a study-abroad preparation platform for
Bangladeshi students (first release). Read this file before editing anything.

## Working rules for any agent or contributor

1. **Honesty over coverage.** Never invent deadlines, probabilities, funding
   guarantees, testimonials, or eligibility rules. An unspecified value is
   `unknown` — it is never assumed satisfied. Missing data must stay visible.
2. **Deterministic core.** Requirement matching, funding math, and schedule
   planning run in reviewed code paths (`src/lib/matching`,
   `src/lib/planning`, `src/lib/funding`). AI may *explain* results or *give
   feedback on drafts*; it must never silently override a deterministic result.
3. **Sources.** Every decision-relevant published fact should reference a
   `Source` + `FactEvidence` record with retrieval timestamp and review state.
   Authority order: programme page → admissions/aid office →
   government/embassy/administrator → general orientation (labelled general).
4. **Never commit secrets.** Tokens, passwords, API keys, `.env` files stay out
   of git. `.env.example` documents placeholders only.
5. **Preserve unrelated work.** Do not delete or rewrite other contributors'
   files to make a feature fit; extend instead.
6. **Commits.** Small, meaningful, one concern per commit. Prefix with
   `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`.
7. **Stack.** Next.js 16 App Router + TypeScript + Tailwind 4 + shadcn/ui +
   Prisma (SQLite in this environment) + z-ai-web-dev-sdk (server-side only).
   Do not introduce a second backend or microservices.
8. **Accessibility.** Keyboard operability, visible focus, honest alt text,
   360px layouts, Bangla typography support, `prefers-reduced-motion` respect.
9. **Privacy.** Student documents are private; every private entity has an
   owner and every access path checks ownership server-side.
10. **No fake polish.** A disabled or unimplemented feature must be labelled,
    not decorated as if it worked.

## Map of the repository

- `src/app/` — the single-page student interface (durable query-param routes:
  `/?view=…&slug=…&tab=…&ids=…&dest=…&level=…&cycle=…&q=…`) + API routes
- `src/lib/` — domain modules: identity, catalogue, matching, planning,
  funding, ai adapter, documents (storage adapters), editorial (field
  registry), ingestion
- `prisma/` — schema + seeds (SQLite in this dev environment; production
  uses managed Postgres — see docs/DEPLOYMENT.md; a bare `DATABASE_URL` swap
  does NOT migrate data)
- `scripts/admin-grant.ts` — the ONLY admin provisioning path (owner-run CLI)
- `src/components/uraan/` — product-specific UI (illustrations, header, views)
- `src/components/ui/` — shadcn/ui primitives (do not hand-rewrite)
- `docs/` — source registry, repair audit, feature acceptance, release
  checklist, deployment guide, methodology, presentation outline
- `db/` — dev SQLite database + dev-only local document adapter (gitignored);
  production documents live in private object storage (`DOCUMENTS_STORAGE`)

### Deterministic engines (never AI-overridden)

| Module | Role |
| --- | --- |
| `src/lib/matching/engine.ts` | Requirement evaluator — operators over profile facts; 5-valued results; unknown operators resolve to `needs_institution_confirmation`, never a pass |
| `src/lib/planning/engine.ts` + `templates.ts` | Back-planned task scheduler with capacity check and stable task keys |
| `src/lib/funding/engine.ts` | Worksheet math — competitive awards never counted as guaranteed; unknown amounts block exact totals |
| `src/lib/dates.ts` | Date-only precision, all-day ICS generation (no invented times/zones) |
| `src/lib/ai/provider.ts` | The ONLY z-ai-web-dev-sdk touchpoint — timeouts, retries, quotas, sanitized logs |

## Environment notes

The development sandbox maps the app to port 3000 and uses a Caddy gateway.
The catalogue seed uses `prisma/seed.ts` run through Bun (idempotent — it
never overwrites editorially reviewed rows). See `README.md` for exact
commands.

## Production assumptions (supersede the dev SQLite defaults)

- **Database:** managed Postgres (Supabase recommended). Migrations via
  `prisma migrate deploy`, NEVER `db push --accept-data-loss` on production.
  Full path: `docs/DEPLOYMENT.md` step 1.
- **Documents:** `DOCUMENTS_STORAGE=supabase` + private bucket; the local
  filesystem adapter is refused implicitly in production.
- **Admins:** granted ONLY through `bun run admin:grant` on a trusted
  machine; `ADMIN_EMAILS` is advisory input for the CLI, ignored by request
  paths. Public registration always creates a student.
- **Scheduled ingestion:** Vercel Cron calls `POST /api/admin/ingestion`
  with `Authorization: Bearer $INGESTION_CRON_SECRET`; human admins keep
  their cookie path.
- **Editorial publishing:** `PATCH /api/admin/review` writes real catalogue
  values through the allowlisted field registry with optimistic-concurrency
  versioning and full history (`OpportunityVersion`).

## Tests

`bun run test` (Vitest) covers the deterministic engines and boundary
schemas — run it before every merge that touches `src/lib/matching`,
`src/lib/planning`, `src/lib/funding`, `src/lib/money`,
`src/lib/editorial`, or `src/lib/validation`.
