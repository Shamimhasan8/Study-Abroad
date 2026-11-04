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

- Registered users: application database (SQLite in this environment) on the
  server, plus private document files under `db/private-docs/`.
- Guests: **browser local storage only** until you create an account; nothing
  about a guest reaches the server except anonymous API reads of the public
  catalogue. Creating an account merges your guest plan explicitly and once.
- Sessions: opaque random tokens in httpOnly cookies; password hashes use
  scrypt with per-user salts. Passwords are never stored or logged in
  readable form.

## What the AI provider receives

Two server-side AI features exist:

1. **Plan explanation / requirement-gap explanation.** Receives: your
   language preference and a summarized, non-identifying snapshot of your
   evaluation result (degree level, target country, rule outcomes, gap
   titles). No name, no email, no document contents.
2. **Draft feedback.** Receives: the draft text you submit for feedback, the
   essay prompt, word limit, and target degree level — because feedback
   without the text is impossible. The text is processed for the response and
   not persisted with the AI run record (only sanitized metadata: purpose,
   model, token counts, latency, status).

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
