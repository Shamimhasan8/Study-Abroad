/**
 * Destination guides — United States, Germany, Japan.
 * Honest, orientation-level content with official links. Country guidance
 * never overrides programme-specific requirements.
 */
export interface CountryGuideSeed {
  code: string;
  nameEn: string;
  nameBn: string;
  contentEn: string;
  contentBn: string;
  sources: { key: string; url: string; title: string; publisher: string; retrievedAt: string }[];
}

const BASELINE = "2026-11-04";

export const COUNTRY_GUIDES: CountryGuideSeed[] = [
  {
    code: "US",
    nameEn: "United States",
    nameBn: "যুক্তরাষ্ট্র",
    contentEn: `**Route overview.** U.S. universities admit through direct institutional applications (Common App for many bachelor's programmes; graduate programmes through each department). Aid for internationals at bachelor's level is mostly need-based and institution-specific; some universities meet full demonstrated need for admitted internationals. At graduate level, funding is common in research fields via assistantships and fellowships, plus programmes like Fulbright.

**What admission actually turns on:** your full secondary record (bachelor's: 12 years of schooling with strong marks, typically HSC for Bangladeshi applicants), standardized tests where required (SAT/ACT — some universities are test-optional; check each one), English proficiency (TOEFL/IELTS/Duolingo accepted at most), essays and recommendation letters. Master's and PhD admission weighs your bachelor's transcript, statement of purpose, references, and (PhD) research fit.

**Money reality:** U.S. costs are high (total attendance often USD 60k–100k+/year). Need-based aid can cover much of it at some institutions; merit scholarships rarely cover everything. Never plan on part-time work closing a gap — visa rules limit work hours and jobs are not guaranteed.

**Timeline:** bachelor's applications ~12 months ahead (deadlines cluster in November–January); graduate deadlines vary from October to February for the following fall.

**Confirmation tasks:** every university sets its own tests, deadlines, and aid forms (CSS Profile / ISFAA). Verify each on its official admissions and aid pages — EducationUSA's five-steps guide is orientation, not a substitute.`,
    contentBn: `**পথের সারসংক্ষেপ।** যুক্তরাষ্ট্রের বিশ্ববিদ্যালয়ে ভর্তি হয় সরাসরি প্রতিষ্ঠানের আবেদনে (ব্যাচেলরে অনেক ক্ষেত্রে Common App; গ্র্যাজুয়েটে প্রতিটি ডিপার্টমেন্ট নিজেই)। ব্যাচেলর লেভেলে আন্তর্জাতিক শিক্ষার্থীদের জন্য সহায়তা মূলত need-based এবং প্রতিষ্ঠানভেদে ভিন্ন; কিছু বিশ্ববিদ্যালয় ভর্তিপ্রাপ্তদের প্রমাণিত প্রয়োজন পুরোপুরি মেটায়। গ্র্যাজুয়েট লেভেলে রিসার্চ ক্ষেত্রে assistantship ও fellowship সাধারণ; Fulbright-এর মতো প্রোগ্রামও আছে।

**ভর্তি আসলে কী দেখে:** পুরো মাধ্যমিক ফলাফল (ব্যাচেলরে ১২ বছরের শিক্ষা ও ভালো নম্বর — বাংলাদেশি আবেদনকারীদের জন্য সাধারণত HSC), যেখানে লাগে সেখানে SAT/ACT (কিছু প্রতিষ্ঠান test-optional — একে একে দেখুন), ইংরেজি দক্ষতা (TOEFL/IELTS/Duolingo), এসে ও রেকমেন্ডেশন। মাস্টার্স/পিএইচডিতে ব্যাচেলর ট্রান্সক্রিপ্ট, SOP, রেফারেন্স এবং (পিএইচডি) রিসার্চ ফিট।

**টাকার বাস্তবতা:** খরচ অনেক বেশি (বছরে প্রায় ৬০–১০০ হাজার ডলার বা তার বেশি)। কিছু প্রতিষ্ঠানে need-based aid বড় অংশ ঢাকে; merit scholarship প্রায়ই পুরোটা ঢাকে না। খরচ মেটাতে পার্ট-টাইম কাজের প্ল্যান করবেন না — ভিসা নিয়মে ঘণ্টা সীমিত, কাজের নিশ্চয়তা নেই।

**সময়রেখা:** ব্যাচেলর আবেদন ~১২ মাস আগে (নভেম্বর–জানুয়ারিতে ডেডলাইন); গ্র্যাজুয়েট ডেডলাইন অক্টোবর–ফেব্রুয়ারি।

**নিশ্চিতকরণ কাজ:** প্রতিটি বিশ্ববিদ্যালয়ের টেস্ট, ডেডলাইন ও এইড ফর্ম (CSS Profile / ISFAA) আলাদা — অফিসিয়াল পাতায় যাচাই করুন। EducationUSA-র গাইড পরিচিতিমূলক, বিকল্প নয়।`,
    sources: [
      { key: "educationusa-5steps", url: "https://educationusa.state.gov/your-5-steps-us-study", title: "Your 5 Steps to U.S. Study", publisher: "EducationUSA", retrievedAt: BASELINE },
      { key: "educationusa-ug", url: "https://educationusa.state.gov/your-5-steps-us-study/research-your-options/undergraduate", title: "Research Your Options — Undergraduate", publisher: "EducationUSA", retrievedAt: BASELINE },
      { key: "educationusa-fin-grad", url: "https://educationusa.state.gov/your-5-steps-us-study/finance-your-studies/graduate", title: "Finance Your Studies — Graduate", publisher: "EducationUSA", retrievedAt: BASELINE },
    ],
  },
  {
    code: "DE",
    nameEn: "Germany",
    nameBn: "জার্মানি",
    contentEn: `**Route overview.** Public universities charge almost no tuition (a semester contribution of ~€150–350; Baden-Württemberg charges non-EU students ~€1,500/semester). Most bachelor's programmes are taught in German (B1–C1 proof needed; some English-taught exceptions exist). Many master's programmes are English-taught. The main gates are qualification recognition and, for self-funded students, the blocked account (~€11,904/year at recent rates) for the visa.

**Recognition matters:** for Bangladeshi applicants, HSC alone does not usually qualify for direct bachelor's admission in Germany — a one-year foundation course (Studienkolleg) or completed bachelor's may be required. DAAD's admission database gives nonbinding undergraduate guidance; for master's/PhD, each faculty evaluates your degree directly. HSC holders should check their exact case and treat it as an institution-confirmation task.

**Money reality:** living costs ~€950–1,200/month depending on city. Funded routes (DAAD scholarships like EPOS, Helmut Schmidt, research grants) pay a monthly stipend; they are competitive, not guaranteed. Low tuition does not mean low living cost — plan the full year.

**Language:** German-taught programmes need TestDaF/DSH; English-taught programmes need IELTS/TOEFL. Learning basic German helps daily life and part-time options, but plan realistically.

**Timeline:** winter semester applications typically due ~mid-July (via uni-assist for many universities); summer semester ~mid-January. Scholarships have their own deadlines (often Aug–Nov of the previous year).

**Confirmation tasks:** verify your qualification route in the DAAD/anabin databases (nonbinding), each programme's language requirement and deadline, and blocked-account rates before relying on any number here.`,
    contentBn: `**পথের সারসংক্ষেপ।** সরকারি বিশ্ববিদ্যালয়ে টিউশন প্রায় নেই (সেমিস্টার ফি ~১৫০–৩৫০ ইউরো; Baden-Württemberg-এ অনাইউ শিক্ষার্থীদের ~১,৫০০ ইউরো/সেমিস্টার)। বেশিরভাগ ব্যাচেলর জার্মান ভাষায় (B1–C1 প্রমাণ লাগে; ইংরেজিতে কিছু ব্যতিক্রম আছে)। অনেক মাস্টার্স ইংরেজিতে। মূল দুই বাধা: কোয়ালিফিকেশন স্বীকৃতি আর স্ব-অর্থায়িতদের জন্য ব্লক অ্যাকাউন্ট (~সাম্প্রতিক হারে বছরে ~১১,৯০৪ ইউরো)।

**স্বীকৃতি গুরুত্বপূর্ণ:** বাংলাদেশি আবেদনকারীদের জন্য শুধু HSC দিয়ে সরাসরি ব্যাচেলরে ভর্তি সাধারণত হয় না — এক বছরের Studienkolleg বা সম্পন্ন ব্যাচেলর লাগতে পারে। DAAD-এর অ্যাডমিশন ডেটাবেস আন্ডারগ্র্যাজুয়েট নির্দেশনা দেয় (আবদ্ধ নয়); মাস্টার্স/পিএইচডিতে ফ্যাকাল্টি সরাসরি মূল্যায়ন করে।

**টাকার বাস্তবতা:** মাসিক খরচ ~৯৫০–১,২০০ ইউরো (শহরভেদে)। DAAD স্কলারশিপ (EPOS, Helmut Schmidt, রিসার্চ গ্রান্ট) মাসিক স্টাইপেন্ড দেয় — প্রতিযোগিতামূলক, নিশ্চিত নয়। টিউশন কম মানে জীবনযাত্রার খরচ কম নয়।

**ভাষা:** জার্মান-মাধ্যম প্রোগ্রামে TestDaF/DSH; ইংরেজি-মাধ্যমে IELTS/TOEFL। বেসিক জার্মান দৈনন্দিন জীবনে সাহায্য করে।

**সময়রেখা:** উইন্টার সেমিস্টারের আবেদন সাধারণত ~জুলাই মাঝামাঝি; সামারের ~জানুয়ারি মাঝামাঝি। স্কলারশিপের ডেডলাইন আলাদা (প্রায়ই আগের বছরের আগস্ট–নভেম্বর)।

**নিশ্চিতকরণ কাজ:** DAAD/anabin ডেটাবেসে আপনার কোয়ালিফিকেশন পথ যাচাই, প্রোগ্রামের ভাষা শর্ত ও ডেডলাইন, আর ব্লক অ্যাকাউন্টের বর্তমান হার নিজে দেখুন।`,
    sources: [
      { key: "daad-admission-db", url: "https://www.daad.de/en/studying-in-germany/requirements/admission-database/", title: "DAAD Admission Database (undergraduate guidance, nonbinding)", publisher: "DAAD", retrievedAt: BASELINE },
      { key: "daad-epos", url: "https://www.daad.de/en/study-and-research-in-germany/scholarships/development-related-postgraduate-courses/", title: "EPOS Scholarships", publisher: "DAAD", retrievedAt: BASELINE },
    ],
  },
  {
    code: "JP",
    nameEn: "Japan",
    nameBn: "জাপান",
    contentEn: `**Route overview.** Japan offers two main funded doors for Bangladeshi students: the MEXT (Monbukagakusho) scholarship via Embassy of Japan recommendation (undergraduate and research-student tracks), and direct admission to English-taught programmes (e.g., PEAK at the University of Tokyo) or regular Japanese-taught programmes.

**MEXT essentials:** the embassy track runs once a year — applications historically open around April–June at the Embassy of Japan in Dhaka, with written screening and interviews. Undergraduate awards require 12 years of schooling and cover tuition, a monthly stipend, and airfare. The research-student award requires a completed bachelor's (or 16 years of education) and a field consistent with your background. Important honesty note: the research-student scheme places you first as a research student; conversion to a degree programme (master's/PhD) requires the university's own screening — it is not automatic degree admission.

**Direct admission:** English-taught bachelor's programmes (PEAK and similar) admit through their own applications, typically ~November–January for autumn intake. Regular programmes require Japanese proficiency (EJU exam for many) plus university exams. National universities charge ~¥535,800/year tuition; MEXT covers it for awardees.

**Money reality:** living costs in Tokyo run high (~¥100–150k/month realistically); outside Tokyo is cheaper. MEXT stipends are intended to cover living costs; self-funded students need ~¥1.5–2M/year total planning figures. Part-time work on a student visa needs permission and is capped in hours.

**Timeline:** MEXT (April–June application → screening summer → departure following spring/autumn); PEAK-style programmes (apply ~Nov–Jan for October). Plan 12–18 months ahead.

**Confirmation tasks:** exact current-cycle MEXT dates from the Embassy of Japan in Bangladesh; each English-taught programme's test requirements; university-level screening details for research students.`,
    contentBn: `**পথের সারসংক্ষেপ।** বাংলাদেশি শিক্ষার্থীদের জন্য জাপানের দুটি প্রধান ফান্ডেড পথ: MEXT (মনবুকাগাকুশো) স্কলারশিপ — জাপান দূতাবাসের রেকমেন্ডেশনে (আন্ডারগ্র্যাজুয়েট ও রিসার্চ-স্টুডেন্ট ট্র্যাক), আর ইংরেজি-মাধ্যম প্রোগ্রামে (যেমন টোকিও বিশ্ববিদ্যালয়ের PEAK) সরাসরি ভর্তি।

**MEXT-এর মূল কথা:** দূতাবাস ট্র্যাক বছরে একবার — ঢাকার জাপান দূতাবাসে আবেদন ঐতিহাসিকভাবে এপ্রিল–জুনে খোলে, লিখিত স্ক্রিনিং ও ইন্টারভিউ হয়। আন্ডারগ্র্যাজুয়েটে ১২ বছরের শিক্ষা লাগে; টিউশন, মাসিক স্টাইপেন্ড ও ভাড়া ঢাকে। রিসার্চ-স্টুডেন্টে সম্পন্ন ব্যাচেলর (বা ১৬ বছর শিক্ষা) আর নিজের ব্যাকগ্রাউন্ডের সাথে মিলে এমন ফিল্ড লাগে। **সৎ নোট:** রিসার্চ-স্টুডেন্ট স্কিমে প্রথমে রিসার্চ স্টুডেন্ট হিসেবে যান; ডিগ্রি প্রোগ্রামে (মাস্টার্স/পিএইচডি) যাওয়ার জন্য বিশ্ববিদ্যালয়ের নিজস্ব স্ক্রিনিং লাগে — সেটা স্বয়ংক্রিয় নয়।

**সরাসরি ভর্তি:** ইংরেজি-মাধ্যম ব্যাচেলর প্রোগ্রাম (PEAK-এর মতো) নিজস্ব আবেদনে নেয় — সাধারণত ~নভেম্বর–জানুয়ারিতে (অক্টোবর ইনটেকের জন্য)। নিয়মিত প্রোগ্রামে জাপানি দক্ষতা (অনেকে EJU) + বিশ্ববিদ্যালয়ের পরীক্ষা লাগে। জাতীয় বিশ্ববিদ্যালয়ের টিউশন ~৫,৩৫,৮০০ ইয়েন/বছর; MEXT প্রাপকদের তা ঢাকে।

**টাকার বাস্তবতা:** টোকিওতে মাসিক খরচ বাস্তবে ~১–১.৫ লাখ ইয়েন; টোকিওর বাইরে কম। MEXT স্টাইপেন্ড জীবনযাত্রার খরচ মেটানোর জন্যই। স্ব-অর্থায়িতদের বছরে ~১৫–২০ লাখ ইয়েন ধরা ভালো।

**সময়রেখা:** MEXT (এপ্রিল–জুন আবেদন → গ্রীষ্মে স্ক্রিনিং → পরের বসন্ত/শরৎ যাত্রা); PEAK-এর মতো প্রোগ্রাম (~নভেম্বর–জানুয়ারি আবেদন)। ১২–১৮ মাস আগে পরিকল্পনা করুন।

**নিশ্চিতকরণ কাজ:** বাংলাদেশে জাপান দূতাবাস থেকে বর্তমান MEXT তারিখ; প্রোগ্রামভিত্তিক টেস্ট শর্ত; রিসার্চ স্টুডেন্টদের বিশ্ববিদ্যালয় স্ক্রিনিং বিস্তারিত।`,
    sources: [
      { key: "mext-ug", url: "https://www.studyinjapan.go.jp/en/smap-stopj-applications-undergraduate.html", title: "MEXT Undergraduate (Embassy track)", publisher: "Study in Japan (MEXT)", retrievedAt: BASELINE },
      { key: "mext-research", url: "https://www.studyinjapan.go.jp/en/smap-stopj-applications-research.html", title: "MEXT Research Students (Embassy track)", publisher: "Study in Japan (MEXT)", retrievedAt: BASELINE },
      { key: "mext-faq", url: "https://www.studyinjapan.go.jp/en/faq/mext-scholarship/", title: "MEXT FAQ", publisher: "Study in Japan", retrievedAt: BASELINE },
      { key: "utokyo-peak", url: "https://www.u-tokyo.ac.jp/en/admissions/undergraduate/e_peak.html", title: "UTokyo PEAK", publisher: "University of Tokyo", retrievedAt: BASELINE },
    ],
  },
];
