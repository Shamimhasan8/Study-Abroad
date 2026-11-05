"use client";

/**
 * Scenario preview drawer — change one constraint, preview how the plan
 * moves, then apply or close. Cancel mutates nothing (the cancel contract).
 *
 * Flow (single replan contract, src/lib/planning/replan.ts):
 * - "Preview changes" POSTs /api/plan/generate with ONLY the fields the
 *   student actually changed (compared against the profile), as `scenario`
 *   (preview-only merge, never persisted). Guests also send their profile.
 * - The response is parsed through parsePlanGenerateOk: kind "plan" (or the
 *   guest path) yields the proposed plan; kind "confirmation" (signed-in,
 *   edited plan) yields a persisted preview whose plan we display but NEVER
 *   auto-confirm — the confirmation flow happens on the workspace screen.
 * - Apply: guests patchProfile + setPlan locally. Signed-in users save the
 *   FULL merged profile to /api/profile first (the route expects the whole
 *   object), then navigate to the workspace to review the replan preview.
 * - Any failure keeps the drawer open with inputs intact and a toast.
 */
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { localizeDigits, useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiPost } from "@/lib/api-client";
import { parsePlanGenerateOk, type PlanGenerateOk } from "@/lib/planning/replan";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GitCompareArrows, Loader2, ShieldCheck } from "lucide-react";
import type { PlanData, ProfileData } from "@/lib/types";

const INTAKE_YEARS = [2026, 2027, 2028, 2029, 2030];

/** Only the fields the student actually CHANGED (vs the profile). */
type ScenarioChanges = Partial<
  Pick<ProfileData, "weeklyHours" | "targetIntakeYear" | "targetIntakeTerm" | "annualContributionBdt">
>;

/** The previewed proposal, frozen with the scenario that produced it. */
interface ScenarioProposal {
  plan: PlanData;
  /** Signed-in replan over an edited plan — edits are preserved in preview. */
  preservesEdits: boolean;
  /** The exact scenario payload that produced this preview (apply uses it). */
  scenario: ScenarioChanges;
}

interface ScenarioDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** One labelled stat row in the diff card; changed values get sunflower bg. */
function DiffRow({ label, value, changed }: { label: string; value: ReactNode; changed?: boolean }) {
  return (
    <div className={changed ? "-mx-1.5 rounded-md bg-sunflower/30 px-1.5 py-1" : "py-1"}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="text-sm font-medium leading-snug">{value}</div>
    </div>
  );
}

export function ScenarioDrawer({ open, onOpenChange }: ScenarioDrawerProps) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { goalSlug, profile, plan, user, navigate, patchProfile, setPlan, setReplanConfirmation } = useAppStore();

  const [weeklyHours, setWeeklyHours] = useState("");
  const [intakeYear, setIntakeYear] = useState("");
  const [intakeTerm, setIntakeTerm] = useState("");
  const [contribution, setContribution] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [proposal, setProposal] = useState<ScenarioProposal | null>(null);

  // Initialize from the profile each time the drawer opens; a fresh open
  // always starts from the student's real current state.
  useEffect(() => {
    if (!open) return;
    setWeeklyHours(profile?.weeklyHours != null ? String(profile.weeklyHours) : "");
    setIntakeYear(
      profile?.targetIntakeYear != null && INTAKE_YEARS.includes(profile.targetIntakeYear)
        ? String(profile.targetIntakeYear)
        : "",
    );
    setIntakeTerm(profile?.targetIntakeTerm ?? "");
    setContribution(
      profile?.annualContributionBdt != null ? String(profile.annualContributionBdt) : "",
    );
    setProposal(null);
  }, [open, profile]);

  // Inline validation (the API contract is int 1–80 / int ≥ 0).
  const hoursError = useMemo(() => {
    const raw = weeklyHours.trim();
    if (raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 80) {
      return lang === "bn" ? "১–৮০ এর মধ্যে পূর্ণ সংখ্যা হতে হবে" : "must be a whole number between 1 and 80";
    }
    return null;
  }, [weeklyHours, lang]);

  const contributionError = useMemo(() => {
    const raw = contribution.trim();
    if (raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      return lang === "bn" ? "০ বা তার বেশি পূর্ণ সংখ্যা হতে হবে" : "must be a whole number of 0 or more";
    }
    return null;
  }, [contribution, lang]);

  /** Only fields that differ from the profile make it into the request. */
  const scenario = useMemo<ScenarioChanges>(() => {
    const changes: ScenarioChanges = {};
    const rawHours = weeklyHours.trim();
    if (rawHours !== "") {
      const n = Number(rawHours);
      if (Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= 80 && n !== profile?.weeklyHours) {
        changes.weeklyHours = n;
      }
    }
    if (intakeYear !== "") {
      const n = Number(intakeYear);
      if (n !== profile?.targetIntakeYear) changes.targetIntakeYear = n;
    }
    if (
      (intakeTerm === "fall" || intakeTerm === "spring") &&
      intakeTerm !== profile?.targetIntakeTerm
    ) {
      changes.targetIntakeTerm = intakeTerm;
    }
    const rawMoney = contribution.trim();
    if (rawMoney !== "") {
      const n = Number(rawMoney);
      if (
        Number.isFinite(n) &&
        Number.isInteger(n) &&
        n >= 0 &&
        n !== profile?.annualContributionBdt
      ) {
        changes.annualContributionBdt = n;
      }
    }
    return changes;
  }, [weeklyHours, intakeYear, intakeTerm, contribution, profile]);

  const hasChanges = Object.keys(scenario).length > 0;

  // ---------- preview ----------

  const runPreview = async () => {
    if (!goalSlug || previewing || hoursError || contributionError) return;
    setPreviewing(true);
    try {
      const body: Record<string, unknown> = { slug: goalSlug, scenario };
      if (!user && profile) body.profile = profile;
      const res = await apiPost<PlanGenerateOk>("/api/plan/generate", body);
      if (!res.ok) {
        // Drawer stays open, inputs intact — the student can fix and retry.
        toast({
          title:
            res.error === "needs_profile"
              ? t("journey.needsProfile")
              : t("journey.generateFailed"),
          description: res.error === "needs_profile" ? undefined : t("common.errorHint"),
          variant: "destructive",
        });
        return;
      }
      const parsed = parsePlanGenerateOk(res.data);
      if (!parsed) {
        toast({
          title: t("common.error"),
          description: t("journey.generateFailed"),
          variant: "destructive",
        });
        return;
      }
      if (parsed.kind === "confirmation") {
        // Never auto-confirm: the workspace screen owns the confirm flow.
        setProposal({ plan: parsed.preview, preservesEdits: true, scenario });
      } else {
        setProposal({ plan: parsed.plan, preservesEdits: false, scenario });
      }
    } finally {
      setPreviewing(false);
    }
  };

  // ---------- apply ----------

  const apply = async () => {
    if (!proposal || applying) return;
    if (!user) {
      // Guest: the previewed proposal plan IS applicable — local
      // persistence is this browser's durable store.
      if (Object.keys(proposal.scenario).length > 0) patchProfile(proposal.scenario);
      setPlan(proposal.plan);
      toast({
        title: lang === "bn" ? "সিনারিও আপনার প্ল্যানে যুক্ত হয়েছে।" : "Scenario applied to your plan.",
      });
      onOpenChange(false);
      navigate("workspace");
      return;
    }
    if (!profile) {
      toast({ title: t("journey.needsProfile"), variant: "destructive" });
      return;
    }
    setApplying(true);
    try {
      // /api/profile expects the FULL profile object — merge first.
      const merged: ProfileData = { ...profile, ...proposal.scenario };
      const res = await apiPost("/api/profile", merged);
      if (!res.ok) {
        // Failure keeps the drawer open with inputs intact.
        toast({
          title: t("common.error"),
          description: t("common.errorHint"),
          variant: "destructive",
        });
        return;
      }
      // Keep the hydrated store cache in sync with the saved server truth.
      if (Object.keys(proposal.scenario).length > 0) patchProfile(proposal.scenario);
      // The scenario preview was NEVER applied server-side (preview-only
      // contract). Apply = save profile (done above), then a real
      // generation: applied directly, or gated by the replan confirmation
      // on the workspace — both honor "apply exactly what was reviewed".
      const gen = await apiPost("/api/plan/generate", { slug: goalSlug });
      const genParsed = gen.ok ? parsePlanGenerateOk(gen.data) : null;
      if (genParsed?.kind === "plan") {
        setPlan(genParsed.plan);
        setReplanConfirmation(null);
        toast({
          title: lang === "bn" ? "সিনারিও আপনার প্ল্যানে যুক্ত হয়েছে।" : "Scenario applied to your plan.",
        });
      } else if (genParsed?.kind === "confirmation") {
        setReplanConfirmation(genParsed);
        toast({
          title: lang === "bn" ? "প্রোফাইল আপডেট হয়েছে।" : "Profile updated.",
          description: lang === "bn"
            ? "ওয়ার্কস্পেসে রিপ্ল্যান প্রিভিউটি দেখে নিন।"
            : "Review the replan preview on your workspace.",
        });
      } else {
        // Profile saved, but generation failed — the student can regenerate
        // from the workspace; nothing was lost.
        toast({
          title: lang === "bn" ? "প্রোফাইল আপডেট হয়েছে।" : "Profile updated.",
          description: t("journey.generateFailed"),
          variant: "destructive",
        });
      }
      onOpenChange(false);
      navigate("workspace");
    } finally {
      setApplying(false);
    }
  };

  // ---------- diff card helpers ----------

  const planStats = (p: PlanData | null) => ({
    horizon: p ? t("plan.months", { n: localizeDigits(p.horizonMonths, lang) }) : "—",
    tasks: p ? localizeDigits(p.tasks.length, lang) : "—",
    effort: p
      ? t("plan.effort", {
          hours: localizeDigits(Math.round(p.tasks.reduce((sum, task) => sum + task.effortHours, 0)), lang),
        })
      : "—",
    infeasible: p ? p.infeasible : undefined,
    titles: p
      ? p.tasks
          .slice(0, 3)
          .map((task) => (lang === "bn" && task.titleBn ? task.titleBn : task.title))
      : [],
  });

  const current = planStats(plan);
  const proposedStats = proposal ? planStats(proposal.plan) : null;

  const feasibility = (infeasible: boolean | undefined) =>
    infeasible === undefined ? (
      "—"
    ) : infeasible ? (
      <span className="font-semibold text-coral">
        {lang === "bn" ? "সক্ষমতার বাইরে" : "Over capacity"}
      </span>
    ) : (
      <span className="font-semibold text-leaf">{lang === "bn" ? "আঁটে" : "Fits"}</span>
    );

  const titlesNode = (titles: string[]) =>
    titles.length === 0 ? (
      <span className="text-muted-foreground">{t("plan.empty")}</span>
    ) : (
      <span className="flex flex-col">
        {titles.map((title, idx) => (
          <span key={idx} className="truncate">
            {title}
          </span>
        ))}
      </span>
    );

  const noGoal = !goalSlug;
  const previewDisabled =
    previewing || applying || noGoal || !hasChanges || Boolean(hoursError) || Boolean(contributionError);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/70 p-4 pb-3">
          <SheetTitle className="flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4 text-leaf" aria-hidden="true" />
            {lang === "bn" ? "পরিকল্পনার প্রিভিউ" : "Scenario preview"}
          </SheetTitle>
          <SheetDescription>
            {lang === "bn"
              ? "একটি শর্ত বদলান, প্ল্যানের নড়াচড়া দেখুন। Apply না করা পর্যন্ত কিছুই বদলায় না।"
              : "Change a constraint, see the plan move. Nothing changes until you apply."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
          {/* Constraints */}
          <section className="flex flex-col gap-4" aria-label={lang === "bn" ? "শর্ত" : "Constraints"}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scenario-hours">{t("onboarding.capacity.hours")}</Label>
              <Input
                id="scenario-hours"
                type="number"
                min={1}
                max={80}
                step={1}
                inputMode="numeric"
                className="bg-card tabular-nums"
                value={weeklyHours}
                onChange={(event) => setWeeklyHours(event.target.value)}
                placeholder="1–80"
              />
              {hoursError && <p className="text-xs text-destructive">{hoursError}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scenario-intake-year">
                {lang === "bn" ? "টার্গেট ইনটেক (আনুমানিক)" : "Target intake (approx)"}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={intakeYear} onValueChange={setIntakeYear}>
                  <SelectTrigger id="scenario-intake-year" className="w-full bg-card">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTAKE_YEARS.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {localizeDigits(year, lang)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={intakeTerm} onValueChange={setIntakeTerm}>
                  <SelectTrigger id="scenario-intake-term" className="w-full bg-card">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fall">
                      {lang === "bn" ? "শরৎ (সেপ্টেম্বর)" : "Fall (Sep)"}
                    </SelectItem>
                    <SelectItem value="spring">
                      {lang === "bn" ? "বসন্ত (এপ্রিল)" : "Spring (Apr)"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scenario-contribution">{t("onboarding.money.contribution")}</Label>
              <Input
                id="scenario-contribution"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className="bg-card tabular-nums"
                value={contribution}
                onChange={(event) => setContribution(event.target.value)}
                placeholder={lang === "bn" ? "ঐচ্ছিক" : "optional"}
              />
              {contributionError && <p className="text-xs text-destructive">{contributionError}</p>}
            </div>

            {noGoal && (
              <p className="rounded-lg border border-sunflower/70 bg-sunflower/15 p-2.5 text-xs leading-relaxed text-foreground/80">
                {lang === "bn"
                  ? "এখনো কোনো টার্গেট নেই — আগে Explore থেকে একটি টার্গেট বেছে নিন।"
                  : "No goal selected yet — pick a target in Explore first."}
              </p>
            )}
            {!noGoal && !hasChanges && !previewing && (
              <p className="text-xs text-muted-foreground">
                {lang === "bn"
                  ? "প্রিভিউ দেখতে উপরের একটি মান বদলান।"
                  : "Change a value above to preview its effect."}
              </p>
            )}
          </section>

          {/* Current vs Proposed */}
          {proposal && proposedStats && (
            <Card className="border-sunflower/60 bg-accent/50">
              <CardContent className="p-0">
                <div className="grid grid-cols-2 divide-x divide-border/70">
                  <div className="p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {lang === "bn" ? "বর্তমান" : "Current"}
                    </p>
                    <DiffRow label={t("plan.horizon")} value={current.horizon} />
                    <DiffRow
                      label={lang === "bn" ? "টাস্ক" : "Tasks"}
                      value={current.tasks}
                    />
                    <DiffRow
                      label={lang === "bn" ? "মোট শ্রমঘণ্টা" : "Total effort"}
                      value={current.effort}
                    />
                    <DiffRow
                      label={lang === "bn" ? "সক্ষমতা" : "Feasibility"}
                      value={feasibility(current.infeasible)}
                    />
                    <DiffRow label={lang === "bn" ? "শুরুর টাস্ক" : "First tasks"} value={titlesNode(current.titles)} />
                  </div>
                  <div className="p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {lang === "bn" ? "প্রস্তাবিত" : "Proposed"}
                    </p>
                    <DiffRow
                      label={t("plan.horizon")}
                      value={proposedStats.horizon}
                      changed={!plan || current.horizon !== proposedStats.horizon}
                    />
                    <DiffRow
                      label={lang === "bn" ? "টাস্ক" : "Tasks"}
                      value={proposedStats.tasks}
                      changed={!plan || current.tasks !== proposedStats.tasks}
                    />
                    <DiffRow
                      label={lang === "bn" ? "মোট শ্রমঘণ্টা" : "Total effort"}
                      value={proposedStats.effort}
                      changed={!plan || current.effort !== proposedStats.effort}
                    />
                    <DiffRow
                      label={lang === "bn" ? "সক্ষমতা" : "Feasibility"}
                      value={feasibility(proposedStats.infeasible)}
                      changed={!plan || current.infeasible !== proposedStats.infeasible}
                    />
                    <DiffRow
                      label={lang === "bn" ? "শুরুর টাস্ক" : "First tasks"}
                      value={titlesNode(proposedStats.titles)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {proposal?.preservesEdits && (
            <p className="flex items-start gap-2 rounded-lg border border-leaf/40 bg-secondary/60 p-2.5 text-xs leading-relaxed">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf" aria-hidden="true" />
              <span>
                {lang === "bn"
                  ? "আপনার এডিট করা টাস্কগুলো প্রিভিউতে রক্ষিত থাকে — নিশ্চিত করার আগে পর্যালোচনা করুন।"
                  : "Your edits are preserved in the preview — review before confirming."}
              </span>
            </p>
          )}
        </div>

        <SheetFooter className="flex-row flex-wrap gap-2 border-t border-border/70 p-4">
          {proposal ? (
            <Button onClick={apply} disabled={applying || previewing} className="gap-1.5">
              {applying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {lang === "bn" ? "আমার প্ল্যানে যুক্ত করুন" : "Apply to my plan"}
            </Button>
          ) : (
            <Button onClick={runPreview} disabled={previewDisabled} className="gap-1.5">
              {previewing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {lang === "bn" ? "পরিবর্তনের প্রিভিউ" : "Preview changes"}
            </Button>
          )}
          {proposal && (
            <Button variant="outline" onClick={runPreview} disabled={previewDisabled}>
              {lang === "bn" ? "আবার প্রিভিউ" : "Preview again"}
            </Button>
          )}
          {/* Cancel contract: close without ANY mutation. */}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {lang === "bn" ? "বদল না করেই বন্ধ করুন" : "Close without changing"}
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            {lang === "bn"
              ? "এটা শুধু প্রিভিউ — বাতিল করলে কিছুই বদলায় না।"
              : "Preview only — cancel changes nothing."}
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
