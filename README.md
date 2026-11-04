# Uraan — Study-Abroad Preparation Workspace

Uraan (উড়ান — "flight") is a study-abroad preparation platform for
Bangladeshi students. It answers one question honestly:

> Given my education, interests, budget, language ability, and intended
> intake, which routes are plausible, what is missing, and what should I
> do next?

A beginner completes onboarding, compares **real sourced opportunities**,
selects a target, sees a **transparent requirement-gap report**, receives a
**realistic dated plan**, completes preparation tasks, and returns later to
find progress saved. Uraan never promises admission, scholarships, or visas.

**Verified coverage (first release):** United States · Germany · Japan ·
bachelor's, master's, and PhD routes · 11 distinct real opportunities from
official sources. See `docs/SOURCE_REGISTRY.md`.

## Stack

- **Next.js 16 (App Router) + TypeScript** — single-page student interface + JSON API routes
- **Prisma + SQLite** (portable to Postgres via `DATABASE_URL`)
- **Tailwind CSS 4 + shadcn/ui** with the Uraan warm-paper design system
- **First-party auth** — scrypt password hashing, httpOnly session cookies, server-side ownership checks
- **AI via z-ai-web-dev-sdk (server-side only)** — evidence-bound explanations and draft feedback, with labelled template fallbacks
- **Zod** boundary validation on every API route

Full design notes: `ARCHITECTURE.md` · product scope: `PRODUCT.md` ·
privacy: `DATA_POLICY.md` · agent instructions: `AGENTS.md`.

## Setup and local run

Requirements: Node 18+ / Bun 1.1+.

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env         # defaults work for local SQLite

# 3. Create the database and generate the client
bun run db:push              # prisma db push (schema in prisma/schema.prisma)

# 4. Seed the verified catalogue (27 sources, 3 guides, 11 opportunities)
bun prisma/seed.ts

# 5. Start the dev server
bun run dev                  # http://localhost:3000
```

Lint: `bun run lint` · Typecheck: `bunx tsc --noEmit`.

### The first registered user becomes admin

With `ADMIN_EMAILS` empty, the **first account created becomes the
editorial admin**; set `ADMIN_EMAILS=a@x.com,b@x.com` in `.env` to pin the
allowlist instead. The admin role only ever comes from the server session —
never a client flag.

## Daily operation

### Source ingestion (editorial)

The ingestion worker records fetch health (HTTP status, size, content hash)
for the 27 allowlisted official sources. A fetch success is **never**
treated as factual verification — candidate facts go through human review.

```bash
# Manual run (or via the in-app Editorial workspace → "Run source checks now")
curl -X POST http://localhost:3000/api/admin/ingestion            # needs admin session
curl -X POST "http://localhost:3000/api/admin/ingestion?volatility=cycle-critical"
```

For scheduled runs, hit the same endpoint with any scheduler (cron, Vercel
cron, systemd timer) carrying an admin session or a service token you add
at the gateway. `IngestionJob` rows persist run history, leases, attempts,
and failures; `SourceVersion` rows keep every fetch attempt.

### Editorial review flow

1. Admin opens **Editorial** (admin-only view).
2. Submits candidate evidence (field path, value, unit, confidence, source key).
3. The queue shows it as *pending*; **Approve & publish** creates a
   `ReviewEvent` + `AuditEvent` and notifies every user whose active goal
   targets that opportunity — completed/edited tasks are never rewritten.

### Backup and restore

The durable state is one SQLite file plus the private documents directory:

```bash
# Backup (stop the server or use SQLite's online backup)
sqlite3 db/custom.db ".backup db/backup-$(date +%F).db"
tar czf docs-backup-$(date +%F).tgz db/private-docs/

# Restore
cp db/backup-2026-11-04.db db/custom.db
tar xzf docs-backup-2026-11-04.tgz
bun run db:push && bun prisma/seed.ts   # re-sync client + catalogue if needed
```

### Deletion

- A document delete revokes access and removes the file immediately; a
  tombstone row (name/sizes/timestamps) remains for audit.
- Account deletion (`DELETE /api/account`, wired in Settings) removes
  profile, goals, plans, drafts, applications, experiences, recommenders,
  research notes, language logs, documents, sessions, notifications, and
  AI-run metadata. Public source facts are unaffected.

## Project layout

```
src/app/               single-page UI (page.tsx) + API routes under api/
src/components/uraan/  product views, illustrations, prepare suite
src/lib/               domain modules: identity, catalogue, matching,
                       planning, funding, ai, documents, ingestion
prisma/                schema + seeds (sources, guides, opportunities)
db/                    SQLite database + private-docs/ (gitignored)
docs/                  SOURCE_REGISTRY.md, PRESENTATION.md
```

## Honest limitations (see RELEASE_REPORT.md)

- Catalogue facts carry `baseline_review` state: checked against official
  pages at the 2026-11-04 research baseline, with cycle dates to re-verify
  per record before reliance.
- Reminders are in-app only (no email/push).
- No Russia-specific eligibility or visa guidance; no UK/Canada/Australia
  guides yet.
- Tests (Vitest/Playwright) are deferred in this environment and recorded
  as an open item in the release report — not silently skipped.

## License

MIT (see LICENSE).
