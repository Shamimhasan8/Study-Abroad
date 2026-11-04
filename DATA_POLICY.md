# DATA_POLICY.md — Privacy, retention, and honest operation

## What Uraan collects (and why)

**Profile (private, owner-scoped):** intended degree level, field interests,
target intake, citizenship(s), residence, qualification country, UI language,
qualifications with grades as reported (no GPA conversion), language
self-assessments and official test results, family contribution and upfront
funds, country preferences, weekly preparation time, and responsibilities.

**Never collected in this release:** passports, NID numbers, bank
credentials, full addresses, bank statements. Onboarding explicitly does not
ask for them.

**Documents you upload (optional):** stored privately, accessible only to
your account through an authenticated download; deletable at any time.

**What we do NOT do:** public profiles, social feeds, selling data, tracking
pixels, cross-account visibility, AI training claims on your essays.

## Where data lives

- Registered users: the application database — **SQLite in this development
  environment; managed PostgreSQL (e.g. Supabase) in production** (see
  `docs/DEPLOYMENT.md`). Documents live in private, owner-scoped object
  storage in production (a private bucket; downloads flow only through the
  authenticated, ownership-checked API). In development only, the local
  filesystem adapter stores them under `db/private-docs/`.
- Guests: **browser local storage only** until you create an account; nothing
  about a guest reaches the server except anonymous API reads of the public
  catalogue. Creating an account merges your guest plan explicitly and once
  (idempotent, with a conflict preview if the account already has a plan).
- Sessions: opaque random tokens in httpOnly cookies; password hashes use
  scrypt with per-user salts. Passwords are never stored or logged in
  readable form. Failed logins are throttled durably (8 failures per 15
  minutes per email).
- Guest→account merges are recorded in a `GuestImport` ledger with receipts;
  upload deletions leave only a tombstone (name, sizes, timestamps).

## What the AI provider receives

Three server-side AI features exist:

1. **Plan explanation / requirement-gap explanation.** Receives: your
   language preference and a summarized, non-identifying snapshot of your
   evaluation result (degree level, target country, rule outcomes, gap
   titles). No name, no email, no document contents.
2. **Draft feedback.** Receives: the draft text you submit for feedback, the
   essay prompt, word limit, and target degree level — because feedback
   without the text is impossible. The text is processed for the response and
   not persisted with the AI run record (only sanitized metadata: purpose,
   model, token counts, latency, status).
3. **Language practice feedback.** Receives: your practice paragraph and the
   fixed practice prompt. Guests are quota-bucketed by a short IP prefix
   (stored for quota accounting only); replies are schema-validated before
   display. Template fallbacks (when the provider is unreachable) contain no
   proficiency estimate — word counts are not an assessment.

Every model reply passes strict output-schema validation; malformed replies
fail visibly and never impersonate a successful AI response.

Operational logs record errors and AI run metadata without essay text or
personal documents. We do not claim zero provider retention or encryption we
have not verified.

## Retention and deletion

- Delete a document → access revoked immediately, file removed from active
  storage; a tombstone row (name, sizes, timestamps) remains for audit.
- Delete your account (or email the operator) → profile, plans, drafts,
  applications, documents and session records are scheduled for deletion.
  Published source facts are public records and unaffected.
- Backups: the operator's database backup rotation may retain deleted data
  for a bounded window; restore procedure is documented in README.

## Age and consent

Study-abroad preparation commonly involves students under 18. This release
minimizes collection (no contact network, no public profiles, no social
features) and requires only an email to save progress. Broad public launch
requires jurisdiction-appropriate age/consent review; we do not claim blanket
legal compliance.

## Reporting a data or fact problem

Use the in-app **Sources & coverage** view (error report link) or open a
GitHub issue. Factual corrections enter the editorial queue and are never
silently overwritten.
