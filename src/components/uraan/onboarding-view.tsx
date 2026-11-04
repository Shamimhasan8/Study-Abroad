"use client";

/**
 * Uraan onboarding — conversational, progressive, resumable.
 * One small group of questions per step; everything saves automatically
 * (localStorage for guests, profile API for signed-in users).
 */
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { PaperPlaneFlight, StudentReading } from "./illustrations";
import type { DegreeLevel, IntakeTerm, OfficialTestResult, ProfileData, Qualification } from "@/lib/types";
import { ArrowLeft, ArrowRight, GraduationCap, Plus, Trash2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const FIELD_OPTIONS = [
  "Computer Science", "Engineering", "Data Science", "Business", "Economics",
  "Public Policy", "Medicine", "Public Health", "Law", "Environmental Science",
  "Biology", "Chemistry", "Physics", "Mathematics", "Design", "Literature",
  "International Relations", "Development Studies", "Education", "Social Work",
];

const LANG_OPTIONS = ["English", "Bangla", "German", "Japanese", "French", "Other"];

const QUAL_LEVELS = [
  { value: "SSC", label: "SSC / O-Level (class 10)" },
  { value: "HSC", label: "HSC / A-Level (class 12)" },
  { value: "Diploma", label: "Diploma (after SSC)" },
  { value: "Bachelor's (4-year honours)", label: "Bachelor's — 4-year honours" },
  { value: "Bachelor's (3-year pass)", label: "Bachelor's — 3-year pass" },
  { value: "Master's", label: "Master's" },
  { value: "Other", label: "Other" },
];

const COUNTRY_OPTIONS = ["Bangladesh", "India", "Pakistan", "Nepal", "Russia", "Other"];

const CURRENT_YEAR = new Date().getFullYear();

function emptyProfile(): ProfileData {
  return {
    degreeLevel: "undecided",
    fieldInterests: [],
    intakeFlexible: true,
    citizenships: [],
    uiLanguage: "en",
    qualifications: [],
    languages: [],
    tests: [],
    financeUncertain: false,
    countryPrefs: [],
    instructionLang: "any",
    willingToLearnLang: false,
    onboardingCompleted: false,
  };
}

export function OnboardingView() {
  const { t, lang } = useI18n();
  const { profile, patchProfile, setProfile, user, navigate } = useAppStore();
  const [step, setStep] = useState(0);
  const [fly, setFly] = useState(false);

  const data = profile ?? emptyProfile();
  const totalSteps = 9;

  // Keep the active step visible when moving between steps (especially on mobile).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const save = (partial: Partial<ProfileData>) => {
    const next = { ...data, ...partial };
    setProfile(next);
    if (user) {
      void fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => undefined);
    }
  };

  const finish = () => {
    save({ onboardingCompleted: true });
    setFly(true);
    setTimeout(() => navigate("explore"), 900);
  };

  const stepTitle = [
    t("onboarding.step.degree"),
    t("onboarding.step.field"),
    t("onboarding.step.intake"),
    t("onboarding.step.origin"),
    t("onboarding.step.education"),
    t("onboarding.step.language"),
    t("onboarding.step.money"),
    t("onboarding.step.preferences"),
    t("onboarding.step.capacity"),
  ][step];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="font-display text-[26px] font-bold tracking-tight sm:text-3xl">{t("onboarding.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.subtitle")}</p>
        <div className="mt-4 flex items-center gap-3">
          <Progress value={((step + 1) / totalSteps) * 100} className="flex-1" aria-label={t("onboarding.progress", { current: String(step + 1), total: String(totalSteps) })} />
          <span className="text-xs font-medium text-muted-foreground">
            {t("onboarding.progress", { current: String(step + 1), total: String(totalSteps) })}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{t("onboarding.saveNote")}</p>
      </header>

      <Card className="border-border/70 bg-card">
        <CardContent className="p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">{stepTitle}</h2>

          {step === 0 && (
            <RadioGroup
              value={data.degreeLevel}
              onValueChange={(v) => save({ degreeLevel: v as DegreeLevel })}
              className="gap-3"
            >
              {(["bachelor", "master", "phd", "undecided"] as DegreeLevel[]).map((level) => (
                <label
                  key={level}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3.5 transition-colors hover:bg-secondary/60 has-[button[data-state=checked]]:border-leaf has-[button[data-state=checked]]:bg-secondary"
                >
                  <RadioGroupItem value={level} id={`deg-${level}`} />
                  <span className="text-sm font-medium">
                    {t(
                      level === "bachelor" ? "onboarding.degree.bachelor" :
                      level === "master" ? "onboarding.degree.master" :
                      level === "phd" ? "onboarding.degree.phd" : "onboarding.degree.undecided"
                    )}
                  </span>
                </label>
              ))}
            </RadioGroup>
          )}

          {step === 1 && (
            <FieldChips
              options={FIELD_OPTIONS}
              selected={data.fieldInterests}
              onChange={(selected) => save({ fieldInterests: selected })}
            />
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="intake-year">{t("onboarding.intake.year")}</Label>
                  <Select
                    value={data.targetIntakeYear ? String(data.targetIntakeYear) : ""}
                    onValueChange={(v) => save({ targetIntakeYear: Number(v) })}
                  >
                    <SelectTrigger id="intake-year" className="bg-card"><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3].map((offset) => (
                        <SelectItem key={offset} value={String(CURRENT_YEAR + offset)}>{CURRENT_YEAR + offset}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="intake-term">{t("onboarding.intake.term")}</Label>
                  <Select
                    value={data.targetIntakeTerm ?? ""}
                    onValueChange={(v) => save({ targetIntakeTerm: v as IntakeTerm })}
                  >
                    <SelectTrigger id="intake-term" className="bg-card"><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fall">{lang === "bn" ? "শরৎ (আগস্ট–সেপ্টেম্বর)" : "Fall (Aug–Sep)"}</SelectItem>
                      <SelectItem value="spring">{lang === "bn" ? "বসন্ত (এপ্রিল)" : "Spring (April)"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("onboarding.intake.hint")}</p>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border p-3 hover:bg-secondary/60">
                <Checkbox
                  checked={data.intakeFlexible}
                  onCheckedChange={(checked) => save({ intakeFlexible: checked === true })}
                />
                <span className="text-sm font-medium">{t("onboarding.intake.flexible")}</span>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <Label className="mb-2 block">{t("onboarding.origin.citizenship")}</Label>
                <FieldChips
                  options={COUNTRY_OPTIONS}
                  selected={data.citizenships}
                  onChange={(selected) => save({ citizenships: selected })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="residence">{t("onboarding.origin.residence")}</Label>
                <Input
                  id="residence"
                  className="bg-card"
                  defaultValue={data.residence ?? ""}
                  onBlur={(e) => save({ residence: e.target.value || undefined })}
                  placeholder={lang === "bn" ? "যেমন: বাংলাদেশ" : "e.g. Bangladesh"}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qual-country">{t("onboarding.origin.qualCountry")}</Label>
                <Input
                  id="qual-country"
                  className="bg-card"
                  defaultValue={data.qualificationCountry ?? ""}
                  onBlur={(e) => save({ qualificationCountry: e.target.value || undefined })}
                  placeholder={lang === "bn" ? "যেখানে পড়েছেন" : "Where you studied"}
                />
              </div>
            </div>
          )}

          {step === 4 && <EducationStep data={data} save={save} />}

          {step === 5 && <LanguageStep data={data} save={save} />}

          {step === 6 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contribution">{t("onboarding.money.contribution")}</Label>
                <Input
                  id="contribution"
                  type="number"
                  min={0}
                  className="bg-card"
                  defaultValue={data.annualContributionBdt ?? ""}
                  onBlur={(e) => save({ annualContributionBdt: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="upfront">{t("onboarding.money.upfront")}</Label>
                <Input
                  id="upfront"
                  type="number"
                  min={0}
                  className="bg-card"
                  defaultValue={data.upfrontFundsBdt ?? ""}
                  onBlur={(e) => save({ upfrontFundsBdt: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border p-3 hover:bg-secondary/60">
                <Checkbox
                  checked={data.financeUncertain}
                  onCheckedChange={(checked) => save({ financeUncertain: checked === true })}
                />
                <span className="text-sm font-medium">{t("onboarding.money.uncertain")}</span>
              </label>
              <p className="text-xs text-muted-foreground">{t("onboarding.money.note")}</p>
            </div>
          )}

          {step === 7 && (
            <div className="flex flex-col gap-4">
              <div>
                <Label className="mb-2 block">{t("onboarding.pref.countries")}</Label>
                <FieldChips
                  options={["US", "DE", "JP", "EU"]}
                  labels={["United States", "Germany", "Japan", "Europe (Erasmus)"]}
                  selected={data.countryPrefs}
                  onChange={(selected) => save({ countryPrefs: selected })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="instruction-lang">{t("onboarding.pref.instruction")}</Label>
                <Select
                  value={data.instructionLang}
                  onValueChange={(v) => save({ instructionLang: v as ProfileData["instructionLang"] })}
                >
                  <SelectTrigger id="instruction-lang" className="bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">{t("common.all")}</SelectItem>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="german">{lang === "bn" ? "জার্মান" : "German"}</SelectItem>
                    <SelectItem value="japanese">{lang === "bn" ? "জাপানি" : "Japanese"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border p-3 hover:bg-secondary/60">
                <Checkbox
                  checked={data.willingToLearnLang}
                  onCheckedChange={(checked) => save({ willingToLearnLang: checked === true })}
                />
                <span className="text-sm font-medium">{t("onboarding.pref.willingLang")}</span>
              </label>
            </div>
          )}

          {step === 8 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="weekly-hours">{t("onboarding.capacity.hours")}</Label>
                <Input
                  id="weekly-hours"
                  type="number"
                  min={1}
                  max={80}
                  className="bg-card"
                  defaultValue={data.weeklyHours ?? ""}
                  onBlur={(e) => save({ weeklyHours: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="work-years">{lang === "bn" ? "কাজের অভিজ্ঞতা (বছর, থাকলে)" : "Work experience (years, if any)"}</Label>
                <Input
                  id="work-years"
                  type="number"
                  min={0}
                  max={50}
                  className="bg-card"
                  defaultValue={data.workExperienceYears ?? ""}
                  onBlur={(e) => save({ workExperienceYears: e.target.value !== "" ? Number(e.target.value) : undefined })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="birth-year">{lang === "bn" ? "জন্মসাল (ঐচ্ছিক — বয়সসীমা শর্ত যাচাইয়ের জন্য)" : "Birth year (optional — for age-window rules)"}</Label>
                <Input
                  id="birth-year"
                  type="number"
                  min={1940}
                  max={2015}
                  className="bg-card"
                  defaultValue={data.birthYear ?? ""}
                  onBlur={(e) => save({ birthYear: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="responsibilities">{t("onboarding.capacity.responsibilities")}</Label>
                <Textarea
                  id="responsibilities"
                  className="min-h-20 bg-card"
                  defaultValue={data.responsibilities ?? ""}
                  onBlur={(e) => save({ responsibilities: e.target.value || undefined })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {t("common.back")}
        </Button>
        {step < totalSteps - 1 ? (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(step + 1)}>
              {t("common.skip")}
            </Button>
            <Button onClick={() => setStep(step + 1)}>
              {t("common.continue")}
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <Button onClick={finish} className="gap-1.5">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {t("onboarding.finish.generate")}
            {fly && <PaperPlaneFlight width={30} height={30} />}
          </Button>
        )}
      </div>
    </main>
  );
}

// ---------- Chip picker ----------

function FieldChips({
  options,
  labels,
  selected,
  onChange,
}: {
  options: string[];
  labels?: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {options.map((option, idx) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() =>
              onChange(active ? selected.filter((s) => s !== option) : [...selected, option])
            }
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-leaf bg-secondary text-secondary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-leaf/50 hover:text-foreground",
            )}
          >
            {labels?.[idx] ?? option}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Education step ----------

function EducationStep({
  data,
  save,
}: {
  data: ProfileData;
  save: (partial: Partial<ProfileData>) => void;
}) {
  const { t, lang } = useI18n();
  const qualifications = data.qualifications.length > 0 ? data.qualifications : [{ level: "HSC", institution: "", scale: "", grades: "", year: "" }];

  const update = (idx: number, patch: Partial<Qualification>) => {
    const next = qualifications.map((q, i) => (i === idx ? { ...q, ...patch } : q));
    save({ qualifications: next });
  };

  const add = () => {
    save({
      qualifications: [
        ...qualifications,
        { level: "HSC", institution: "", scale: "", grades: "", year: "", gapMonths: undefined },
      ],
    });
  };

  const remove = (idx: number) => {
    save({ qualifications: qualifications.filter((_, i) => i !== idx) });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("onboarding.step.educationQ")}</p>
      <p className="rounded-lg bg-accent p-3 text-xs leading-relaxed text-foreground/75">
        {t("onboarding.edu.preserveNote")}
      </p>
      {qualifications.map((q, idx) => (
        <div key={idx} className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <GraduationCap className="h-4 w-4 text-leaf" aria-hidden="true" />
              #{idx + 1}
            </span>
            {qualifications.length > 1 && (
              <Button variant="ghost" size="icon" onClick={() => remove(idx)} aria-label={t("common.remove")}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`qual-level-${idx}`}>{t("onboarding.edu.level")}</Label>
              <Select value={q.level} onValueChange={(v) => update(idx, { level: v })}>
                <SelectTrigger id={`qual-level-${idx}`} className="bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUAL_LEVELS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`qual-inst-${idx}`}>{t("onboarding.edu.institution")}</Label>
              <Input
                id={`qual-inst-${idx}`}
                className="bg-card"
                defaultValue={q.institution}
                onBlur={(e) => update(idx, { institution: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`qual-scale-${idx}`}>{t("onboarding.edu.scale")}</Label>
              <Input
                id={`qual-scale-${idx}`}
                className="bg-card"
                defaultValue={q.scale}
                onBlur={(e) => update(idx, { scale: e.target.value })}
                placeholder="GPA 5.00 / 100% / letter"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`qual-grades-${idx}`}>{t("onboarding.edu.grades")}</Label>
              <Input
                id={`qual-grades-${idx}`}
                className="bg-card"
                defaultValue={q.grades}
                onBlur={(e) => update(idx, { grades: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`qual-year-${idx}`}>{t("onboarding.edu.year")}</Label>
              <Input
                id={`qual-year-${idx}`}
                className="bg-card"
                defaultValue={q.year ?? ""}
                onBlur={(e) => update(idx, { year: e.target.value || undefined })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`qual-gap-${idx}`}>{t("onboarding.edu.gap")}</Label>
              <Input
                id={`qual-gap-${idx}`}
                type="number"
                min={0}
                className="bg-card"
                defaultValue={q.gapMonths ?? ""}
                onBlur={(e) => update(idx, { gapMonths: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" onClick={add} className="gap-1.5 self-start">
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t("onboarding.edu.addAnother")}
      </Button>
    </div>
  );
}

// ---------- Language step ----------

function LanguageStep({
  data,
  save,
}: {
  data: ProfileData;
  save: (partial: Partial<ProfileData>) => void;
}) {
  const { t, lang } = useI18n();
  const bn = lang === "bn";
  const languages = data.languages;
  const tests = data.tests;

  const known = useMemo(() => new Set(languages.map((l) => l.language)), [languages]);

  const toggleLanguage = (name: string) => {
    if (known.has(name)) {
      save({ languages: languages.filter((l) => l.language !== name) });
    } else {
      save({ languages: [...languages, { language: name, selfLevel: "intermediate" }] });
    }
  };

  const setLevel = (name: string, level: string) => {
    save({
      languages: languages.map((l) => (l.language === name ? { ...l, selfLevel: level as never } : l)),
    });
  };

  const updateTest = (idx: number, patch: Partial<OfficialTestResult>) => {
    save({ tests: tests.map((test, i) => (i === idx ? { ...test, ...patch } : test)) });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label className="mb-2 block">{t("onboarding.lang.speaks")}</Label>
        <div className="flex flex-wrap gap-2">
          {LANG_OPTIONS.map((name) => {
            const active = known.has(name);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={active}
                onClick={() => toggleLanguage(name)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "border-leaf bg-secondary" : "border-border bg-card text-muted-foreground hover:border-leaf/50",
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
        {languages.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {languages.map((l) => (
              <div key={l.language} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                <span className="w-20 text-sm font-medium">{l.language}</span>
                <Select value={l.selfLevel} onValueChange={(v) => setLevel(l.language, v)}>
                  <SelectTrigger className="h-8 flex-1 bg-card" aria-label={`${l.language} ${t("onboarding.lang.selfLevel")}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["beginner", "intermediate", "advanced", "fluent"].map((level) => (
                      <SelectItem key={level} value={level}>
                        {level === "beginner" ? (bn ? "শুরুর দিকে" : "Beginner") :
                         level === "intermediate" ? (bn ? "মধ্যম" : "Intermediate") :
                         level === "advanced" ? (bn ? "উন্নত" : "Advanced") : (bn ? "সাবলীল" : "Fluent")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{t("onboarding.lang.selfHint")}</p>
          </div>
        )}
      </div>

      <Separator />

      <div>
        <Label className="mb-2 block">{t("onboarding.lang.tests")}</Label>
        {tests.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("onboarding.lang.noTests")}</p>
        )}
        <div className="flex flex-col gap-2">
          {tests.map((test, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_0.8fr_0.8fr_auto] items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor={`test-type-${idx}`}>{t("onboarding.lang.testType")}</Label>
                <Input
                  id={`test-type-${idx}`}
                  className="bg-card"
                  defaultValue={test.testType}
                  onBlur={(e) => updateTest(idx, { testType: e.target.value })}
                  placeholder="IELTS Academic"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`test-score-${idx}`}>{t("onboarding.lang.testScore")}</Label>
                <Input
                  id={`test-score-${idx}`}
                  className="bg-card"
                  defaultValue={test.score}
                  onBlur={(e) => updateTest(idx, { score: e.target.value })}
                  placeholder="7.0"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`test-date-${idx}`}>{t("onboarding.lang.testDate")}</Label>
                <Input
                  id={`test-date-${idx}`}
                  type="date"
                  className="bg-card"
                  defaultValue={test.date ?? ""}
                  onChange={(e) => updateTest(idx, { date: e.target.value || undefined })}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => save({ tests: tests.filter((_, i) => i !== idx) })}
                aria-label={t("common.remove")}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 gap-1.5"
          onClick={() => save({ tests: [...tests, { testType: "", score: "" }] })}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("onboarding.lang.addTest")}
        </Button>
      </div>

      <div className="flex justify-end" aria-hidden="true">
        <StudentReading width={140} height={100} />
      </div>
    </div>
  );
}
