# DEPLOYMENT.md — taking Uraan from this environment to production

Status: **implementation complete; production verification pending owner
credentials.** The build sandbox here has no Supabase/Neon/Vercel account
access, so every production step below is written to be executed by the
owner. Nothing in this document claims to have been deployed.

## What broke on the last deployment (root cause)

The audited Vercel deployment served `503 database: unreachable` and blank
`500`s because:

1. The app shipped with `provider = "sqlite"` + a file `DATABASE_URL`. Vercel
   function instances have ephemeral, per-instance filesystems — a bundled
   SQLite file is not a shared durable database. Every cold start saw either
   an empty or a missing file.
2. Document uploads wrote to `./db/private-docs` — same ephemerality problem.
3. `/api/catalogue` had no failure envelope, so the DB error surfaced as a
   blank 500 instead of a typed 503.

Fixes already in this repo (this commit range): typed 503 envelopes with
request IDs on every data route, a document storage adapter with a
production object-storage backend, and this documented migration path.

## What failed the Vercel *build* (root cause, fixed 2026-11-05)

The deployment check on `main` failed during `next build` on Vercel:

1. **No `postinstall` hook** — Vercel's install step did not guarantee
   `prisma generate`, so `@prisma/client` had no generated types/models and
   the build's typecheck failed. `package.json` now runs
   `postinstall: prisma generate` on every host.
2. **Sandbox-only `cp` commands chained into `build`** — the script assumed
   the standalone output layout of this build environment. `build` is now a
   host-agnostic `next build`; the standalone assembly moved into `start`,
   where it is actually needed.
3. **Route handlers could be prerendered at build time** — all API routes
   now export `dynamic = "force-dynamic"`, so a build can never fail on
   build-time database access, and no build-time response can get baked
   into the output.

With these three, the build passes on Vercel with **zero configuration**.
Because serverless instances still have no SQLite file, the deployed app
then serves the public catalogue from the committed verified seeds
(`src/lib/catalogue/fallback.ts`) — see the next section.

## Verification record — clean-room deploy audit (2026-11-05)

A full clean-room audit was run to settle "there was a problem deploying
the code" reports. Results, each reproduced from a bare checkout state
(no `.env`, no `db/*.db`, no `DATABASE_URL` in the environment):

| Check | Result |
| --- | --- |
| `next build` with zero env/db | ✔ exit 0 — compiled, 3/3 static pages |
| Standalone boot (`npm start` / `bun run start`, node runtime) | ✔ homepage/health/static all 200 |
| `next start` boot | ✔ works (logs a standalone-config warning, serves normally) |
| `/api/health`, `/api/catalogue`, `/api/state`, `/api/capabilities` with no database | ✔ 200 with `status: "degraded"`, `catalogue: "seed-fallback"` (11 opportunities / 27 sources from committed seeds) |
| Write paths with no database (register) | ✔ honest typed 500 envelope `{"ok":false,"error":"server_error","retryable":true}` — no crash, no blank page |
| `engines` / start script | ✔ `node >= 20.9.0` declared; standalone server boots with plain `node` (no Bun requirement on the host) |

**Conclusion:** the repository is deployable as-is on Vercel with zero
configuration (public browsing via seed-fallback; accounts/uploads/mentor
unlock with Steps 1–2 env). A "Sorry, there was a problem deploying the
code — return to the generation page" message is a **deploy-platform-side
failure** (generator UI, credentials, or quota), not a defect in this
codebase: retrying the deploy, or importing the GitHub repo into Vercel
directly, is the correct path.

## Step 0 — Zero-config Vercel deployment (seed-fallback mode)

Importing this repo into Vercel and deploying with **no environment
variables** yields a working public site:

| Capability | Seed-fallback mode | With Step 1–2 env (full mode) |
| --- | --- | --- |
| Browse catalogue, guides, sources | ✔ verified seed snapshot | ✔ live database |
| Guest matching, plan generation | ✔ deterministic engines | ✔ |
| Guest persistence (localStorage) | ✔ | ✔ |
| Accounts, sign-in, shortlists, applications | ✖ typed 503 (honest) | ✔ |
| Editorial review, admin, ingestion | ✖ typed 503 (honest) | ✔ |
| Private document uploads | ✖ typed 503 (honest) | ✔ (needs Step 2) |

Rules the fallback obeys: it triggers only on database *failure* (a
reachable but empty database still returns an honest empty list), it
serves read paths only, and `/api/health` reports
`status: "degraded", catalogue: "seed-fallback"` with real serving
counts so monitoring can tell the two modes apart. Guest demo flows are
fully functional; write paths degrade honestly instead of faking success.

## Step 1 — Managed Postgres (Supabase recommended)

1. Create a Supabase project (region close to your users, e.g. Singapore for
   Bangladesh). From **Project settings → Database** copy:
   - Connection string (**Session pooler / port 5432**) → `DATABASE_URL`
     for migrations/seeds/CLI scripts.
   - Connection string (**Transaction pooler / port 6543**) →
     `DATABASE_URL_POOLED` for the deployed app (serverless-friendly).
2. Convert the Prisma schema provider (SQLite dev → Postgres prod):

   ```bash
   # in the repo, on your machine
   cp prisma/schema.prisma prisma/schema.sqlite.prisma   # keep dev copy
   sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
   # delete any sqlite-specific `url = "file:..."` rows; env DATABASE_URL is used
   DATABASE_URL="postgresql://..." bunx prisma migrate dev --name pg-baseline
   ```

   The schema contains no SQLite-only column types, so the swap is a
   provider change plus a fresh migration. `prisma migrate dev` locally
   generates `prisma/migrations/…_pg_baseline`; commit it.
3. Apply to production (do **not** use `db push --accept-data-loss` on prod):

   ```bash
   DATABASE_URL="<session-pooler url>" bunx prisma migrate deploy
   ```
4. Seed the baseline catalogue — idempotent, never overwriting editorially
   reviewed rows (see `prisma/seed.ts` guard):

   ```bash
   DATABASE_URL="<session-pooler url>" bun prisma/seed.ts
   ```
5. On Vercel set `DATABASE_URL` to the **transaction pooler** URL.
   Migrations run via the CLI above, never per-request.

> Data transfer note: the dev SQLite file here contains only test accounts
> and baseline seeds — no real user data exists to migrate. If you later
> have real SQLite data, export per-table and import with `COPY`/inserts;
> never sync by pointing both providers at one file.

## Step 2 — Private document storage

1. In Supabase → Storage, create a **private** bucket
   `uraan-documents` (default name).
2. On Vercel set:

   ```
   DOCUMENTS_STORAGE="supabase"
   SUPABASE_URL="https://<project>.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="<service_role key>"
   DOCUMENTS_BUCKET="uraan-documents"
   ```

   The adapter (`src/lib/documents/adapters/supabase.ts`) stores each
   object under `{userId}/{48-hex-random}`; downloads flow only through
   the authenticated, owner-checked API route. The service key never
   reaches the browser.
3. Existing local dev uploads under `./db/private-docs` (none in this
   environment) would be re-uploaded per user with `documents/route.ts`'s
   upload flow; there is no silent auto-migration — deliberate, so nothing
   is copied without the owner choosing to.

## Step 3 — Admin provisioning (before opening registration)

```bash
# after YOU register your own account on the deployed app:
DATABASE_URL="<session url>" bun run admin:grant -- your@email.example
# audit roles any time:
bun run admin:audit
```

Public registration can now NEVER mint an admin (audited fix).

## Step 4 — Scheduled ingestion (Vercel Cron)

`vercel.json` (repo root, optional):

```json
{
  "crons": [{ "path": "/api/admin/ingestion?volatility=high", "schedule": "0 2 * * *" }]
}
```

Set `INGESTION_CRON_SECRET` on Vercel; Vercel Cron calls the path with GET
and an `Authorization: Bearer` header carrying that secret — the route
accepts the cron secret on **GET** (machine credential only; a GET never
accepts an admin session cookie, so schedulers can never borrow a human
identity and CSRF is impossible by construction). Signed-in admins use the
**POST** button in the admin view. Runs persist in `IngestionJob` +
`AuditEvent` with a `via: cron|admin` marker. After the first scheduled
run, verify a `done`/`failed` job row and review-queue entries exist
before relying on the pipeline.

## Step 5 — AI provider

The AI adapter is server-side only (`src/lib/ai/provider.ts`). Verify the
z-ai-web-dev-sdk credential path on Vercel per its documentation; the
provider, quotas, timeouts, and labelled fallbacks are already wired. If
the sdk cannot run on your platform, replace the adapter module — feature
routes stay unchanged.

## Step 6 — Environment variables (Vercel → Settings → Environment Variables)

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | transaction pooler URL | Postgres; see step 1 |
| `DOCUMENTS_STORAGE` | `supabase` | production persistence |
| `SUPABASE_URL` | project URL | documents |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key | documents; server only |
| `DOCUMENTS_BUCKET` | `uraan-documents` | private bucket |
| `ADMIN_EMAILS` | your emails | advisory for CLI only |
| `INGESTION_CRON_SECRET` | long random string | cron auth |
| `AI_*` | optional tuning | timeouts/quotas/limits |

Never set `DOCUMENTS_STORAGE=local` on serverless — the adapter refuses
implicit local mode in production and answers a clear operational error.

## Step 7 — Post-deploy smoke checks

```bash
curl -s https://<your-domain>/api/health          # 200; healthy (counts) or degraded/seed-fallback (counts)
curl -s https://<your-domain>/api/catalogue | head -c 200   # typed JSON, 11 opportunities either way
```

A `degraded` health status means Step 1 (Postgres) is not wired yet: the
public site still serves the verified seed catalogue, and account/admin
flows answer typed 503s. Complete Step 1 to move to `healthy`.

Then run the browser walkthrough in `docs/PRESENTATION.md` on the public
URL (register → merge → plan → task completion → reload → Bangla → 360px).
Record results in `docs/RELEASE_CHECKLIST.md`.

## Local development (unchanged)

`bun run dev` keeps SQLite + local document adapter; no production
prerequisites are hidden — misconfigurations answer with actionable
errors instead of silently degrading.
