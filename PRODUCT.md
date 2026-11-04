# PRODUCT.md — Uraan first-release definition

Working name: **Uraan** (উড়ান — "flight"). Editable name; no trademark claim.
Research baseline: 4 November 2026. Owner: Adil.

## The essential user question

> Given my education, interests, budget, language ability, and intended
> intake, which routes are plausible, what is missing, and what should I do
> next?

## First user (persona)

A Bangladeshi student beginning 12–24 months before an intended intake, with
little prior knowledge of foreign admission systems, mixed English
confidence, and a realistic family budget. They may be aiming for a
bachelor's, master's, or PhD route.

## First meaningful outcome (release gate)

A beginner completes onboarding, compares real sourced opportunities,
selects a target, sees a transparent requirement-gap report, receives a
realistic dated plan, completes a preparation task, and returns later to
find progress saved.

A scholarship directory plus an open chatbot does **not** satisfy this.

## Scope of this first release

**In scope:**
1. English/Bangla interface with beginner-friendly explanations.
2. Public browsing without sign-in (guest mode with persistence).
3. Progressive conversational onboarding; save/resume; guest→account merge.
4. Separate bachelor's / master's / PhD preparation tracks.
5. Destination guides: United States, Germany, Japan.
6. A catalogue of real, distinct opportunities covering all three degree
   levels (see `docs/SOURCE_REGISTRY.md` for the verified list and each
   record's review state).
7. Opportunity detail pages with field-level sources, cycle, freshness.
8. Deterministic requirement matching, country comparison, shortlist.
9. 12–24 month preparation framework; weekly and 30-day actionable views.
10. Funding-gap and upfront-cost worksheet (no false precision).
11. Starter tools: language prep, experience journal, essay/SOP editor with
    AI feedback, recommender requests, PhD research preparation.
12. Application tracking, in-app reminders, ICS calendar export, plan export.
13. Private document storage with deletion.
14. Protected editorial workflow for sources and requirement changes.
15. Real AI integration in plan explanation and draft feedback flows.
16. Deployment configuration and an honest release report.

**Explicitly out of scope (first release):**
- Live speech scoring; email/push delivery (reminders are in-app only).
- Visa or legal advice; Russia-specific eligibility guidance.
- Broader country coverage beyond the three guides.
- Publication of unverified "best country" rankings or success metrics.

## Product judgment rules (binding)

- Admission eligibility ≠ scholarship eligibility ≠ preparation progress ≠
  competitive selection. A completed checklist is never a probability.
- Full tuition, partial award, stipend, need-based aid, assistantship, and
  full-cost coverage are different funding arrangements and stay distinct.
- Country-level guidance never overrides programme-specific requirements.
- Citizenship, residence, qualification country, and destination are separate
  fields.
- An unspecified requirement is `needs_information` or
  `needs_institution_confirmation`, never an automatic pass.
- No invented deadlines: closed cycles render as closed; date-only values
  keep date-only precision; unknown windows are labelled approximate.
- Funding math shows ranges for estimates; unknown costs prevent a falsely
  precise total; competitive awards are not counted as guaranteed funds.
- Family responsibilities, employment, community work, creative work, and
  independent projects are valid recorded experiences. Never prescribe
  expensive extracurriculars as universal prerequisites.

## Degree-track branching

- **Bachelor's:** school qualifications, required subjects, credential
  recognition, tests, authentic activities, essays, teacher/counselor
  recommendations, financial aid.
- **Master's:** relevant bachelor's preparation, prerequisite courses,
  transcripts, professional vs research route, SOP, references; work
  experience only where a programme requires it.
- **PhD:** research interests and evidence, programme structure,
  faculty/lab fit, writing sample/proposal where required, references,
  advertised doctoral positions vs programme admissions, funding conditions.

No universal requirement of publications, a pre-PhD master's, supervisor
outreach, work experience, or a particular test — programme-specific rules
only.

## Competition context (research notes, recheck before submission)

- Event: YuNet AI Ignite 2026 (Devpost). Functional B2C web app, meaningful
  AI, public access for judges; solo participation from Bangladesh.
- Organizer sticker required near the top/navbar; official asset was not
  retrievable in the build environment — recorded as a submission blocker in
  `RELEASE_REPORT.md` until the owner supplies the asset.
- Submission deadline treated as **5 November 2026, 22:00 Asia/Dhaka**
  (earlier of the two published times) unless the organizer resolves the
  discrepancy.
