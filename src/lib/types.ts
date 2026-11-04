/**
 * Uraan shared domain types — the contract between UI, API routes, and the
 * deterministic engines. Statuses are explicit strings; `unknown` is always
 * a real value, never an overloaded null.
 */

// ---------- Profile ----------

export type DegreeLevel = "bachelor" | "master" | "phd" | "undecided";
export type IntakeTerm = "fall" | "spring";
export type SelfLevel = "beginner" | "intermediate" | "advanced" | "fluent";
export type InstructionLang = "english" | "german" | "japanese" | "any";

export interface Qualification {
  level: string; // e.g. "SSC/HSC", "Bachelor's (BSc)", "Diploma"
  institution: string;
  scale: string; // exactly as reported — never converted
  grades: string; // exactly as reported
  year?: string;
  expectedYear?: string;
  gapMonths?: number;
  subjects?: string;
}

export interface LanguageAbility {
  language: string; // "English" | "Bangla" | "German" | "Japanese" | ...
  selfLevel: SelfLevel; // clearly labelled estimate
}

export interface OfficialTestResult {
  testType: string; // IELTS Academic, TOEFL iBT, GRE, Duolingo, JLPT, TestDaF, DSH…
  score: string;
  date?: string;
}

export interface ProfileData {
  degreeLevel: DegreeLevel;
  fieldInterests: string[];
  targetIntakeYear?: number;
  targetIntakeTerm?: IntakeTerm;
  intakeFlexible: boolean;
  citizenships: string[];
  residence?: string;
  qualificationCountry?: string;
  uiLanguage: "en" | "bn";
  birthYear?: number; // optional; used only for age-window rules
  qualifications: Qualification[];
  languages: LanguageAbility[];
  tests: OfficialTestResult[];
  annualContributionBdt?: number;
  upfrontFundsBdt?: number;
  financeUncertain: boolean;
  countryPrefs: string[];
  instructionLang: InstructionLang;
  willingToLearnLang: boolean;
  weeklyHours?: number;
  workExperienceYears?: number; // optional; used for experience-based rules
  responsibilities?: string;
  onboardingCompleted: boolean;
}

// ---------- Catalogue ----------

export type OpportunityKind = "funding_scheme" | "programme";
export type LevelCoverage = "bachelor" | "master" | "phd" | "master_phd";
export type CycleStatus =
  | "open"
  | "opens_later"
  | "closed"
  | "in_progress"
  | "rolling"
  | "unknown";
export type ReviewState = "baseline_review" | "verified_current" | "stale";

export interface SourceRef {
  key: string;
  url: string;
  title: string;
  publisher: string;
  retrievedAt: string; // ISO date
}

export interface RequirementRule {
  id: string;
  category: "admission" | "language" | "funding" | "documentation" | "competitiveness";
  title: string;
  titleBn?: string;
  operator: string; // human-readable predicate, e.g. "minimum_score"
  thresholdValue?: string;
  unit?: string;
  requiredness: "required" | "optional" | "conditional";
  conditionNote?: string;
  detail: string;
  detailBn?: string;
  evidenceKey?: string;
}

export interface DeadlineEvent {
  id: string;
  type: "admission" | "scholarship" | "nomination" | "reference" | "test" | "document";
  openDate?: string;
  closeDate?: string;
  precision: "date" | "month" | "window" | "unknown";
  timezone?: string; // only when the source states one
  official: boolean;
  note?: string;
}

export interface CostItem {
  id: string;
  kind:
    | "tuition"
    | "fee"
    | "housing"
    | "meals"
    | "insurance"
    | "books"
    | "travel"
    | "visa"
    | "test"
    | "deposit"
    | "living_total";
  label: string;
  amount?: number; // undefined = unknown
  currency: string;
  period: "annual" | "semester" | "monthly" | "one_time" | "total_award";
  estimate: boolean;
  note?: string;
}

export interface FundingItem {
  id: string;
  kind:
    | "full_cost"
    | "full_tuition"
    | "partial_award"
    | "stipend"
    | "need_based_aid"
    | "assistantship"
    | "tuition_waiver";
  label: string;
  amount?: number;
  currency: string;
  period: "annual" | "semester" | "monthly" | "one_time" | "total_award";
  /**
   * Competitive: win-based award — never counted as guaranteed funds while
   * planning. Policy: institutional funding promise (e.g. need-based aid
   * meeting demonstrated need) — conditional on admission/aid application.
   * A user's confirmed award is account-level data, never catalogue data.
   */
  status: "competitive" | "policy";
  restrictions?: string;
  renewalTerms?: string;
}

export interface Opportunity {
  id: string;
  slug: string;
  kind: OpportunityKind;
  level: LevelCoverage;
  title: string;
  titleBn?: string;
  country: string; // "US" | "DE" | "JP" | "EU"
  countryLabel: string;
  institution?: string;
  subjectAreas: string[];
  routeNote: string;
  routeNoteBn?: string;
  description: string;
  descriptionBn?: string;
  fundingType: string;
  applyUrl: string;
  cycleYear?: number;
  cycleStatus: CycleStatus;
  deadlineNote: string;
  deadlines: DeadlineEvent[];
  requirements: RequirementRule[];
  costs: CostItem[];
  funding: FundingItem[];
  exclusions: string[];
  exclusionsBn?: string[];
  sources: SourceRef[];
  reviewState: ReviewState;
  retrievedAt: string;
  nextReviewAt?: string;
}

// ---------- Matching ----------

export type RuleResult =
  | "met"
  | "not_met"
  | "needs_information"
  | "needs_institution_confirmation"
  | "not_applicable";

export interface RequirementEvalResult {
  ruleId: string;
  title: string;
  titleBn?: string;
  category: RequirementRule["category"];
  result: RuleResult;
  detail: string;
  suggestedAction?: string;
  suggestedActionBn?: string;
  evidenceUrl?: string;
}

export interface EvaluationSummary {
  opportunitySlug: string;
  results: RequirementEvalResult[];
  counts: { met: number; notMet: number; needsInfo: number; needsConfirm: number; notApplicable: number };
  gapTitles: string[];
  conservativeNote: boolean;
}

// ---------- Planning ----------

export type TaskStatus = "todo" | "in_progress" | "done" | "skipped";
export type TaskCategory =
  | "language"
  | "tests"
  | "academic"
  | "experience"
  | "writing"
  | "recommenders"
  | "funding"
  | "documents"
  | "research"
  | "logistics";

export interface PlanTask {
  id: string;
  stableKey: string;
  title: string;
  titleBn?: string;
  purpose: string;
  purposeBn?: string;
  category: TaskCategory;
  effortHours: number;
  dueDate?: string; // ISO date (date-only precision kept)
  dateBasis: "official" | "estimated";
  status: TaskStatus;
  completedAt?: string;
  notes?: string;
  userEdited: boolean;
  order: number;
}

export interface PlanData {
  id: string;
  goalSlug?: string;
  goalTitle?: string;
  horizonMonths: number;
  generatedAt: string;
  engineVersion: string;
  infeasible: boolean;
  feasibilityNote?: string;
  tasks: PlanTask[];
}

// ---------- Funding worksheet ----------

export interface FundingWorksheet {
  opportunitySlug: string;
  costLines: (CostItem & { amountBdt?: number })[];
  fundingLines: (FundingItem & { amountBdt?: number })[];
  uncoveredAnnualBdt?: number; // undefined when unknowns prevent a total
  upfrontNeededBdt?: number;
  hasUnknownCosts: boolean;
  /** Policy-promise coverage (conditional on admission/aid application). */
  policyAnnualBdt?: number;
  competitiveAnnualBdt?: number;
  /** Per-currency user-entered planning rates actually used (null = missing). */
  planningRates?: Record<string, number | null>;
  /** Known portion of annual costs even when the exact total is blocked. */
  knownCostSubtotalBdt?: number;
  /** Categories whose amounts/periods/rates are unknown — never silently zero. */
  unknownCategories?: string[];
  /** True when the record documents no cost lines at all (living costs unknown, not free). */
  noDocumentedCosts?: boolean;
  /** Foreign currencies still lacking a user planning rate. */
  missingRateCurrencies?: string[];
}

// ---------- Applications ----------

export type ApplicationStatus =
  | "draft"
  | "preparing"
  | "ready"
  | "submitted"
  | "awaiting"
  | "closed";

export interface ApplicationEvent {
  id: string;
  type: string;
  note?: string;
  createdAt: string;
}

export interface ApplicationRecord {
  id: string;
  opportunitySlug: string;
  opportunityTitle: string;
  status: ApplicationStatus;
  intendedIntake?: string;
  notes?: string;
  events: ApplicationEvent[];
  createdAt: string;
  updatedAt: string;
}

// ---------- Preparation tools ----------

export interface ExperienceEntry {
  id: string;
  kind: "project" | "work" | "community" | "family" | "creative";
  title: string;
  description: string;
  reflection?: string;
  startDate?: string;
  endDate?: string;
  links?: string[];
  createdAt: string;
}

export type DraftKind = "essay" | "sop" | "research";

export interface DraftVersion {
  id: string;
  content: string;
  wordCount: number;
  note?: string;
  createdAt: string;
}

export interface WritingDraft {
  id: string;
  kind: DraftKind;
  title: string;
  institutionPrompt?: string;
  wordLimit?: number;
  aiPolicy: "unknown" | "allowed" | "prohibited";
  currentContent: string;
  versions: DraftVersion[];
  updatedAt: string;
  createdAt: string;
}

export type RecommenderStatus =
  | "planned"
  | "drafted"
  | "sent_user"
  | "confirmed"
  | "declined";

export interface RecommenderRequest {
  id: string;
  name: string;
  role?: string;
  relationship?: string;
  status: RecommenderStatus;
  requestDraft?: string;
  createdAt: string;
}

export interface ReadingLogEntry {
  id: string;
  title: string;
  takeaway?: string;
  addedAt: string;
}

export interface ResearchNoteData {
  interestStatement?: string;
  readingLog: ReadingLogEntry[];
  projectSummary?: string;
  facultyFitNotes?: string;
  outreachDraft?: string;
  updatedAt?: string;
}

export interface LanguageLogEntry {
  id: string;
  skill: "reading" | "writing" | "listening" | "speaking" | "grammar" | "vocab";
  minutes: number;
  note?: string;
  date: string;
}

export interface PracticeFeedback {
  estimatedLevel: string;
  strengths: string[];
  improvements: string[];
  note: string;
  aiGenerated: boolean; // false => labelled template fallback
}

// ---------- Documents ----------

export interface PrivateDocumentMeta {
  id: string;
  purpose: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: "stored" | "deleted";
  createdAt: string;
  deletedAt?: string;
}

// ---------- Auth / account ----------

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  role: "student" | "admin";
}

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body?: string;
  read: boolean;
  createdAt: string;
}

// ---------- API envelope ----------

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };
