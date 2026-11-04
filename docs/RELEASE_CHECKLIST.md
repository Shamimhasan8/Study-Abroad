# RELEASE_CHECKLIST.md — Uraan repair release (Prompt 02)

Build completed: 4 November 2026 (Asia/Dhaka). All commands below were run
in the build environment unless marked **owner**.

## 1. Automated gates

| Check | Command | Result |
| --- | --- | --- |
| Unit / integration tests | `bun run test` | **PASS — 37 tests, 3 files** (matching engine, money/funding/planning/editorial, validation schemas) |
| TypeScript | `bunx tsc --noEmit` | **PASS — 0 errors** (app scope; `ignoreBuildErrors` removed from next.config.ts) |
| ESLint | `bun run lint` | **PASS — 0 errors, 0 warnings** |
| Dev server health | `GET /api/health` | 200 — database reachable, 11 opportunities, 27 sources |
| Production build | `bun run build` | **NOT RUN in this environment** (hosting policy runs `bun run dev` only); `tsc --noEmit` covers the type gate; owner must run the build during deploy |

## 2. Live service checks (this environment)

| Endpoint | Result |
| --- | --- |
| `GET /api/catalogue` | 200 — typed JSON, 60s bounded public cache |
| `GET /api/catalogue/{slug}` | 200 — including `utokyo-peak` (closed, pending_recheck) and `mit-undergraduate-aid` (Jan 4 official) |
| `POST /api/auth/register` | student role always; race → email_taken |
| `POST /api/auth/login` | throttled (429 after 8 failures/15 min), cross-origin blocked |
| `POST /api/sync/merge-guest` | exactly-once receipts; 409 conflict preview; confirmReplace path |
| `POST /api/documents` | upload + signature validation (fake PDF rejected); download bytes match; cross-user 404; delete revokes |
| `POST /api/ai/practice` | live model reply, zod-validated, per-IP quota bucketed |
| `PATCH /api/admin/review` | transactional publish verified (see FEATURE_ACCEPTANCE) |

## 3. Browser verification

Golden path (headless browser, real flows, screenshots in
`docs/screenshots/`): onboarding → explore (filters/chips/search) → detail →
match → target → plan (21 tasks) → task completion → reload persistence →
registration → merge → server persistence → Bangla interface → 360px
layout → deep links + back/forward → zero console errors.

## 4. Security posture (re-verified)

- Admin role: CLI-provisioned only; registration/login/allowlist paths cannot grant it.
- Guest data: cleared only after validated durable merge receipts; failure keeps data + retry/export.
- Sessions: httpOnly, SameSite=Lax, server-side expiry; login throttling durable in DB.
- Cross-account: ownerKey cache scoping + server-side ownership checks (documents/state/plan).
- Uploads: MIME allowlist + magic-byte signature + size ceiling; orphan cleanup on metadata failure.
- SSRF: ingestion allowlist unchanged (no user-supplied URLs).
- Secrets: none in repo/git history (audited); .env.example placeholders only.

## 5. Deployment status — the honest line

**Implementation complete; production verification blocked by owner
credentials (Vercel/Supabase).** The previous deployment's root cause
(SQLite filesystem on serverless) is fixed in code and documented — the
owner executes `docs/DEPLOYMENT.md` steps 1–7, then re-runs the smoke
checks there and records results in this file.

Owner steps (in order):
1. Supabase Postgres project → `prisma migrate deploy` → `bun prisma/seed.ts`.
2. Private storage bucket + `DOCUMENTS_STORAGE=supabase` env set.
3. Register your own account → `bun run admin:grant -- your@email`.
4. Set `INGESTION_CRON_SECRET` + optional `vercel.json` crons.
5. Deploy → smoke `/api/health`, `/api/catalogue`, full walkthrough.
6. Supply the official Devpost sticker asset (still a submission blocker).

## 6. Blockers / known limitations

| Item | State |
| --- | --- |
| Managed Postgres / object storage / Vercel deploy | blocked on owner credentials — exact commands ready in DEPLOYMENT.md |
| Organizer sticker asset | blocked on owner (event page) |
| MEXT/Fulbright/EM/DAAD cycle-date re-verification | partially blocked by sandbox network (hosts unreachable); records flagged `pending_recheck` with notes |
| `next build` production artifact | not run here (hosting policy); type gate passes |
| Real-user evaluation | none (honest — no invented pilot users) |
