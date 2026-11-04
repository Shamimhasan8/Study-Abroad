/**
 * Allowlisted official sources — mirrors docs/SOURCE_REGISTRY.md.
 * The ingestion worker fetches ONLY from this registry (SSRF-safe).
 * Research baseline: 2026-11-04.
 */
export interface SourceSeed {
  key: string;
  url: string;
  title: string;
  publisher: string;
  tier: number; // 1 programme page … 4 general orientation
  volatility: "cycle-critical" | "medium" | "low";
}

export const SOURCES: SourceSeed[] = [
  { key: "mext-ug", url: "https://www.studyinjapan.go.jp/en/smap-stopj-applications-undergraduate.html", title: "MEXT Scholarship — Undergraduate Students (Embassy Recommendation)", publisher: "Study in Japan (MEXT)", tier: 1, volatility: "cycle-critical" },
  { key: "mext-research", url: "https://www.studyinjapan.go.jp/en/smap-stopj-applications-research.html", title: "MEXT Scholarship — Research Students (Embassy Recommendation)", publisher: "Study in Japan (MEXT)", tier: 1, volatility: "cycle-critical" },
  { key: "mext-faq", url: "https://www.studyinjapan.go.jp/en/faq/mext-scholarship/", title: "MEXT Scholarship FAQ", publisher: "Study in Japan (MEXT)", tier: 2, volatility: "medium" },
  { key: "educationusa-5steps", url: "https://educationusa.state.gov/your-5-steps-us-study", title: "Your 5 Steps to U.S. Study", publisher: "EducationUSA (U.S. Department of State)", tier: 3, volatility: "low" },
  { key: "educationusa-ug", url: "https://educationusa.state.gov/your-5-steps-us-study/research-your-options/undergraduate", title: "Research Your Options — Undergraduate", publisher: "EducationUSA", tier: 3, volatility: "low" },
  { key: "educationusa-ug-app", url: "https://educationusa.state.gov/your-5-steps-us-study/complete-your-application/undergraduate", title: "Complete Your Application — Undergraduate", publisher: "EducationUSA", tier: 3, volatility: "low" },
  { key: "educationusa-fin-grad", url: "https://educationusa.state.gov/your-5-steps-us-study/finance-your-studies/graduate", title: "Finance Your Studies — Graduate", publisher: "EducationUSA", tier: 3, volatility: "low" },
  { key: "mit-aid", url: "https://sfs.mit.edu/undergraduate-students/", title: "MIT Student Financial Services — Undergraduate Aid", publisher: "MIT", tier: 1, volatility: "cycle-critical" },
  { key: "mit-admissions", url: "https://mitadmissions.org/", title: "MIT Admissions", publisher: "MIT", tier: 1, volatility: "cycle-critical" },
  { key: "harvard-aid", url: "https://college.harvard.edu/financial-aid", title: "Harvard College Financial Aid", publisher: "Harvard College", tier: 1, volatility: "cycle-critical" },
  { key: "khs", url: "https://knighthennessy.stanford.edu/admission/application-deadlines", title: "Knight-Hennessy Scholars — Application Deadlines", publisher: "Stanford University", tier: 1, volatility: "cycle-critical" },
  { key: "fulbright-foreign", url: "https://foreign.fulbrightonline.org/", title: "Fulbright Foreign Student Program", publisher: "Fulbright (IIE)", tier: 2, volatility: "cycle-critical" },
  { key: "fulbright-bd", url: "https://bd.usembassy.gov/education-culture/fulbright-foreign-student-program/", title: "Fulbright Foreign Student Program — Bangladesh", publisher: "U.S. Embassy Dhaka", tier: 2, volatility: "cycle-critical" },
  { key: "emjm", url: "https://erasmus-plus.ec.europa.eu/opportunities/individuals/students/erasmus-mundus-joint-masters", title: "Erasmus Mundus Joint Masters", publisher: "European Commission (Erasmus+)", tier: 1, volatility: "cycle-critical" },
  { key: "daad-epos", url: "https://www.daad.de/en/study-and-research-in-germany/scholarships/development-related-postgraduate-courses/", title: "Development-Related Postgraduate Courses (EPOS)", publisher: "DAAD", tier: 1, volatility: "cycle-critical" },
  { key: "daad-hsp", url: "https://www.daad.de/en/study-and-research-in-germany/scholarships/helmut-schmidt-programme/", title: "Helmut-Schmidt-Programme (Public Policy and Good Governance)", publisher: "DAAD", tier: 1, volatility: "cycle-critical" },
  { key: "daad-research-grants", url: "https://www.daad.de/en/study-and-research-in-germany/scholarships/daad-funding-programmes/research-grants-doctoral-programmes/", title: "Research Grants — Doctoral Programmes", publisher: "DAAD", tier: 1, volatility: "cycle-critical" },
  { key: "daad-admission-db", url: "https://www.daad.de/en/studying-in-germany/requirements/admission-database/", title: "Admission Database (undergraduate guidance, nonbinding)", publisher: "DAAD", tier: 3, volatility: "low" },
  { key: "utokyo-peak", url: "https://www.u-tokyo.ac.jp/en/admissions/undergraduate/e_peak.html", title: "UTokyo PEAK — Programs in English at Komaba", publisher: "University of Tokyo", tier: 1, volatility: "cycle-critical" },
  { key: "cornell-grad-steps", url: "https://gradschool.cornell.edu/admissions/application-steps/", title: "Graduate Application Steps", publisher: "Cornell Graduate School", tier: 3, volatility: "low" },
  { key: "cornell-sop", url: "https://gradschool.cornell.edu/admissions/application-steps/statements-of-purpose/", title: "Statements of Purpose Guidance", publisher: "Cornell Graduate School", tier: 3, volatility: "low" },
  { key: "cornell-ai-policy", url: "https://gradschool.cornell.edu/admissions/application-steps/important-application-policies/", title: "Important Application Policies (incl. AI use)", publisher: "Cornell Graduate School", tier: 3, volatility: "low" },
  { key: "ielts-types", url: "https://ielts.org/take-a-test/test-types", title: "IELTS Test Types", publisher: "IELTS", tier: 2, volatility: "low" },
  { key: "commonapp-fraud", url: "https://www.commonapp.org/fraud-policy/", title: "Application Integrity / Fraud Policy", publisher: "Common App", tier: 3, volatility: "low" },
  { key: "educanada", url: "https://www.educanada.ca/scholarships-bourses/non_can/index.aspx?lang=en", title: "Scholarships for Non-Canadians", publisher: "EduCanada (Government of Canada)", tier: 3, volatility: "medium" },
  { key: "euraxess", url: "https://euraxess.ec.europa.eu/jobs", title: "EURAXESS — European Research Jobs", publisher: "European Commission", tier: 3, volatility: "medium" },
  { key: "studyuk-plan", url: "https://study-uk.britishcouncil.org/plan-studies", title: "Plan Your Studies (Study UK)", publisher: "British Council", tier: 3, volatility: "medium" },
];
