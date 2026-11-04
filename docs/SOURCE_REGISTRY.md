# SOURCE_REGISTRY.md — Allowlisted sources and initial catalogue coverage

Research baseline: 4 November 2026. Authority order: (1) programme/department
admissions page and official scholarship call, (2) university
admissions/financial-aid office, (3) government / embassy / administrator /
official national portal, (4) general orientation material labelled general.

## Verification honesty

Each catalogue record stores its own `reviewState` and `retrievedAt`. Records
created from the research baseline (facts about long-running official
schemes, checked against the official pages listed below) are marked
`baseline_review` — they are usable for planning **with visible caveats**
(unknown fields stay unknown; cycle status must be confirmed on the official
page before relying on a date). The ingestion worker records live fetch
health per source; nothing is marked "auto-updated" without a successful,
recorded fetch.

An HTTP 200 is not factual verification. A general application season is
never presented as an exact programme date. Closed calls render as closed.

## Allowlisted sources

| Key | Publisher | URL | Tier | Volatility class |
| --- | --- | --- | --- | --- |
| `mext-ug` | Study in Japan (MEXT) | https://www.studyinjapan.go.jp/en/smap-stopj-applications-undergraduate.html | 1 | cycle-critical |
| `mext-research` | Study in Japan (MEXT) | https://www.studyinjapan.go.jp/en/smap-stopj-applications-research.html | 1 | cycle-critical |
| `mext-faq` | Study in Japan FAQ | https://www.studyinjapan.go.jp/en/faq/mext-scholarship/ | 2 | medium |
| `educationusa-5steps` | EducationUSA (U.S. State Dept) | https://educationusa.state.gov/your-5-steps-us-study | 3 (orientation) | low |
| `educationusa-ug` | EducationUSA | https://educationusa.state.gov/your-5-steps-us-study/research-your-options/undergraduate | 3 (orientation) | low |
| `educationusa-ug-app` | EducationUSA | https://educationusa.state.gov/your-5-steps-us-study/complete-your-application/undergraduate | 3 (orientation) | low |
| `educationusa-fin-grad` | EducationUSA | https://educationusa.state.gov/your-5-steps-us-study/finance-your-studies/graduate | 3 (orientation) | low |
| `mit-aid` | MIT Student Financial Services | https://sfs.mit.edu/undergraduate-students/ | 1 | cycle-critical |
| `mit-admissions` | MIT Admissions | https://mitadmissions.org/ | 1 | cycle-critical |
| `harvard-aid` | Harvard College Financial Aid | https://college.harvard.edu/financial-aid | 1 | cycle-critical |
| `khs` | Knight-Hennessy Scholars (Stanford) | https://knighthennessy.stanford.edu/admission/application-deadlines | 1 | cycle-critical |
| `fulbright-foreign` | Fulbright Foreign Student Program | https://foreign.fulbrightonline.org/ | 2 | cycle-critical |
| `fulbright-bd` | U.S. Embassy Dhaka | https://bd.usembassy.gov/education-culture/fulbright-foreign-student-program/ | 2 | cycle-critical |
| `emjm` | European Commission (Erasmus+) | https://erasmus-plus.ec.europa.eu/opportunities/individuals/students/erasmus-mundus-joint-masters | 1 | cycle-critical |
| `daad-epos` | DAAD | https://www.daad.de/en/study-and-research-in-germany/scholarships/development-related-postgraduate-courses/ | 1 | cycle-critical |
| `daad-hsp` | DAAD Helmut-Schmidt-Programme | https://www.daad.de/en/study-and-research-in-germany/scholarships/helmut-schmidt-programme/ | 1 | cycle-critical |
| `daad-research-grants` | DAAD Research Grants | https://www.daad.de/en/study-and-research-in-germany/scholarships/daad-funding-programmes/research-grants-doctoral-programmes/ | 1 | cycle-critical |
| `daad-admission-db` | DAAD admission database (undergraduate guidance, nonbinding) | https://www.daad.de/en/studying-in-germany/requirements/admission-database/ | 3 | low |
| `utokyo-peak` | UTokyo PEAK | https://www.u-tokyo.ac.jp/en/admissions/undergraduate/e_peak.html | 1 | cycle-critical |
| `cornell-grad-steps` | Cornell Grad School | https://gradschool.cornell.edu/admissions/application-steps/ | 3 | low |
| `cornell-sop` | Cornell Grad School — SOP guidance | https://gradschool.cornell.edu/admissions/application-steps/statements-of-purpose/ | 3 | low |
| `cornell-ai-policy` | Cornell Grad School — application policies | https://gradschool.cornell.edu/admissions/application-steps/important-application-policies/ | 3 | low |
| `ielts-types` | IELTS official | https://ielts.org/take-a-test/test-types | 2 | low |
| `commonapp-fraud` | Common App fraud policy | https://www.commonapp.org/fraud-policy/ | 3 | low |
| `educanada` | EduCanada scholarships discovery | https://www.educanada.ca/scholarships-bourses/non_can/index.aspx?lang=en | 3 | medium |
| `euraxess` | EURAXESS jobs | https://euraxess.ec.europa.eu/jobs | 3 | medium |
| `studyuk-plan` | Study UK (British Council) | https://study-uk.britishcouncil.org/plan-studies | 3 | medium |

## Initial catalogue coverage (11 distinct real records)

Legend: kind **FS** = broad funding scheme, **UP** = specific university
programme. All amounts are as published in recent official calls and are
re-verified per cycle; stipend/amount fields carry `estimate=false` only when
the official page states the value for the stated cycle — otherwise the
record keeps `verify current call` caveats.

| # | Record | Kind | Level | Destination | Funding | Cycle status (as stored) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | MEXT Undergraduate (Embassy track) | FS | Bachelor's | Japan | Full: tuition + stipend + airfare | opens later in cycle — embassy window, approximate (Apr–Jun historical); confirm with Embassy of Japan |
| 2 | MEXT Research Student (Embassy track) | FS | Master's/PhD | Japan | Full: tuition + stipend + airfare | opens later — embassy window; university placement after screening |
| 3 | UTokyo PEAK (Programs in English at Komaba) | UP | Bachelor's | Japan | None (self-funded; ~¥535,800/yr public tuition + fees) | application window historically ~Nov–Jan for October intake; verify current cycle |
| 4 | MIT need-based undergraduate aid | UP | Bachelor's | USA | Need-based aid meeting full demonstrated need; need-blind review | cycle in progress — EA historically Nov 1 (date-only), RA early Jan; verify |
| 5 | Harvard College financial aid | UP | Bachelor's | USA | Need-based aid meeting full demonstrated need | cycle in progress — deadlines historically Nov 1 / Jan 1 (date-only); verify |
| 6 | Fulbright Foreign Student Program (Bangladesh) | FS | Master's/PhD | USA | Full: tuition, stipend, airfare, health benefits | opens later — Bangladesh window historically ~Apr–Jun; verify with U.S. Embassy Dhaka |
| 7 | Knight-Hennessy Scholars (Stanford) | FS | Master's/PhD | USA | Full Stanford degree funding; competitive | KHS deadline historically early October — likely closed for next intake; reopens later |
| 8 | Erasmus Mundus Joint Masters | FS | Master's | EU (consortia incl. Germany) | Tuition (programme participation) + monthly stipend + travel/installation | per-consortium deadlines, typically Oct–Feb for September start; per-programme verification required |
| 9 | DAAD EPOS — Development-Related Postgraduate Courses | FS | Master's | Germany | Monthly stipend (934 € recent calls), insurance, travel, study allowance | course-wise deadlines, typically ~Aug–Oct for the following year; verify each course |
| 10 | DAAD Helmut-Schmidt-Programme (PPGG) | FS | Master's | Germany | Monthly stipend + German language preparation at 8 partner universities | window historically ~Aug–Oct/Nov; verify current call |
| 11 | DAAD Research Grants (doctoral programmes) | FS | PhD | Germany | Monthly doctoral stipend + travel/insurance | country deadline tables; verify current call |

Coverage matrix: Bachelor's 4, Master's 6, PhD 4; destinations US/Germany/
Japan all covered; both funding schemes and self-funded university
programmes included; funding types include full-cost schemes, need-based
aid, and competitive fellowships.

## Known gaps (visible in the product)

- No Germany bachelor's-specific funded record (public universities are
  largely tuition-free; block accounts and German-language tests dominate
  the real cost picture — covered in the country guide, not as a fake
  "scholarship").
- Fulbright Bangladesh exact current-cycle dates: not published in the
  baseline — stored as an approximate window with an institution-confirmation
  task generated for the student.
- No Russia-origin route coverage (explicitly out of scope per product
  boundaries; profile can still record other citizenships).
