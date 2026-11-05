"use client";

/**
 * Opportunity detail — admission route, requirements, funding breakdown,
 * dates, sources with retrieval stamps, exclusions, and the official
 * apply link. The match check is deterministic; AI explains it on request.
 */
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ArrowLeft, ExternalLink, Bookmark, Target, Loader2, Sparkles, CircleCheck, CircleX,
  CircleHelp, Building2, CalendarClock, FileWarning, Landmark, ShieldQuestion,
  BookCheck, ChevronDown, FileText, GraduationCap, Languages, Trophy, Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { deadlineExpired, deadlineLabel } from "@/lib/dates";
import { formatBdt, formatForeign } from "@/lib/money";
import { buildFundingWorksheet, contributionContext, worksheetCurrencies } from "@/lib/funding/engine";
import type { EvaluationSummary, Opportunity, RequirementRule, RuleResult } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Requirement matrix groups — fixed order, bilingual headers, one icon. */
const REQUIREMENT_CATEGORIES: { key: RequirementRule["category"]; en: string; bn: string; Icon: LucideIcon }[] = [
  { key: "admission", en: "Admission", bn: "ভর্তি", Icon: GraduationCap },
  { key: "language", en: "Language", bn: "ভাষা", Icon: Languages },
  { key: "funding", en: "Funding", bn: "ফান্ডিং", Icon: Wallet },
  { key: "documentation", en: "Documentation", bn: "ডকুমেন্টেশন", Icon: FileText },
  { key: "competitiveness", en: "Competitiveness", bn: "প্রতিযোগিতা", Icon: Trophy },
];

export function OpportunityDetailView() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { detailSlug, navigate, profile, evaluations, setEvaluation, shortlist, toggleShortlist, setGoal, goalSlug, user } = useAppStore();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState(false);
  const [explainBusy, setExplainBusy] = useState(false);
  const [explanation, setExplanation] = useState<{ text: string; aiGenerated: boolean } | null>(null);
  // Per-currency user-entered planning rates (never hardcoded defaults).
  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!detailSlug) {
      navigate("explore");
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/catalogue/${detailSlug}`);
        const json = await res.json();
        setOpportunity(json.ok ? json.data.opportunity : null);
      } catch {
        setOpportunity(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [detailSlug, navigate]);

  const evaluation = detailSlug ? evaluations[detailSlug] : undefined;

  // Shortlist sync for signed-in users (guests stay local).
  const onToggleShortlist = (slug: string) => {
    toggleShortlist(slug);
    if (user) {
      void (async () => {
        const result = await apiPost("/api/shortlist", { slug });
        if (!result.ok) {
          toggleShortlist(slug); // roll back to the server's truth
          toast({ title: t("common.error"), description: t("common.shortlistRetry"), variant: "destructive" });
        }
      })();
    }
  };
  const runMatch = async () => {
    if (!detailSlug) return;
    setMatching(true);
    setMatchError(false);
    try {
      const body: Record<string, unknown> = { slug: detailSlug };
      if (!user && profile) body.profile = profile;
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.ok) setEvaluation(detailSlug, json.data.evaluation);
      else setMatchError(true);
    } catch {
      setMatchError(true);
    } finally {
      setMatching(false);
    }
  };

  const explain = async () => {
    if (!detailSlug || !evaluation) return;
    setExplainBusy(true);
    try {
      const body: Record<string, unknown> = { slug: detailSlug, lang };
      if (!user && profile) body.profile = profile;
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.ok) {
        setExplanation({ text: json.data.explanation, aiGenerated: json.data.aiGenerated });
      } else {
        setExplanation({ text: t("journey.aiUnavailable"), aiGenerated: false });
      }
    } catch {
      setExplanation({ text: t("journey.aiUnavailable"), aiGenerated: false });
    } finally {
      setExplainBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-4 h-10 w-3/4" />
        <Skeleton className="mt-6 h-64 rounded-xl" />
      </main>
    );
  }

  if (!opportunity) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 text-center">
        <p className="text-sm text-muted-foreground">{t("error.notFound")}</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("explore")}>{t("nav.explore")}</Button>
      </main>
    );
  }

  const worksheet = buildFundingWorksheet(opportunity, profile ?? { degreeLevel: "undecided", fieldInterests: [], intakeFlexible: true, citizenships: [], uiLanguage: "en", qualifications: [], languages: [], tests: [], financeUncertain: false, countryPrefs: [], instructionLang: "any", willingToLearnLang: false, onboardingCompleted: false }, rates);
  const contribution = contributionContext(profile ?? ({} as never), worksheet.uncoveredAnnualBdt);

  const resultIcon = (result: string) => {
    switch (result) {
      case "met": return <CircleCheck className="h-4 w-4 text-leaf" aria-hidden="true" />;
      case "not_met": return <CircleX className="h-4 w-4 text-destructive" aria-hidden="true" />;
      case "needs_information": return <CircleHelp className="h-4 w-4 text-sunflower" aria-hidden="true" />;
      case "needs_institution_confirmation": return <ShieldQuestion className="h-4 w-4 text-coral" aria-hidden="true" />;
      default: return <FileWarning className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    }
  };

  const resultLabel = (result: string) =>
    t(
      result === "met" ? "match.met" :
      result === "not_met" ? "match.notMet" :
      result === "needs_information" ? "match.needsInfo" :
      result === "needs_institution_confirmation" ? "match.needsConfirm" : "match.notApplicable"
    );

  // State chip for the requirement matrix — derived from the stored
  // evaluation; rules never checked stay visibly "Unchecked".
  const requirementChip = (result: RuleResult | undefined) => {
    if (result === "met")
      return (
        <Badge variant="outline" className="gap-1 border-leaf/50 text-leaf">
          <CircleCheck className="h-3 w-3" aria-hidden="true" />
          {lang === "bn" ? "পূরণ হয়েছে" : "Met"}
        </Badge>
      );
    if (result === "not_met")
      return (
        <Badge variant="outline" className="border-coral/60 bg-coral/10 text-coral">
          {lang === "bn" ? "পূরণ হয়নি" : "Not met"}
        </Badge>
      );
    if (result === "needs_information")
      return (
        <Badge variant="outline" className="border-sunflower/70 bg-accent text-accent-foreground">
          {lang === "bn" ? "আপনার তথ্য দরকার" : "Needs your info"}
        </Badge>
      );
    if (result === "needs_institution_confirmation")
      return (
        <Badge variant="outline" className="border-coral/60 text-coral">
          {lang === "bn" ? "প্রতিষ্ঠানের সাথে নিশ্চিত করুন" : "Confirm with institution"}
        </Badge>
      );
    if (result === "not_applicable")
      return (
        <Badge variant="outline" className="border-border text-muted-foreground">
          {t("match.notApplicable")}
        </Badge>
      );
    return (
      <Badge variant="outline" className="border-border text-muted-foreground">
        {lang === "bn" ? "যাচাই হয়নি" : "Unchecked"}
      </Badge>
    );
  };

  const datedRounds = opportunity.deadlines.filter((d) => d.closeDate);

  // Requirement matrix: stored evaluation results keyed by rule id.
  const resultByRule = evaluation
    ? new Map(evaluation.results.map((r) => [r.ruleId, r]))
    : undefined;

  // Same usability gate the match card uses — the fit summary's run button
  // only appears when /api/evaluate would actually accept the request.
  const hasUsableProfile = Boolean(profile?.onboardingCompleted || (profile && profile.qualifications.length > 0));

  // Review state in ordinary language for the sources drawer.
  const retrievedLabel = deadlineLabel("date", opportunity.retrievedAt, lang);
  const reviewKey =
    opportunity.reviewState === "baseline_review" ? "review.baseline" :
    opportunity.reviewState === "verified_current" ? "review.verified" :
    opportunity.reviewState === "pending_recheck" ? "review.pending" : "review.stale";
  const reviewSentence =
    opportunity.reviewState === "verified_current"
      ? lang === "bn" ? `${retrievedLabel} পর্যন্ত বর্তমান হিসেবে যাচাই করা হয়েছে।` : `Verified current as of ${retrievedLabel}.`
      : opportunity.reviewState === "baseline_review"
        ? lang === "bn"
          ? `${retrievedLabel} তারিখে অফিসিয়াল পাতার সাথে মিলিয়ে দেখা হয়েছে; পুনঃযাচাই বাকি।`
          : `Checked against the official page on ${retrievedLabel}; re-verification pending.`
        : t(reviewKey);
  const reviewShortLabel =
    opportunity.reviewState === "verified_current" ? (lang === "bn" ? "বর্তমান হিসেবে যাচাইকৃত" : "Verified current") :
    opportunity.reviewState === "baseline_review" ? (lang === "bn" ? "বেসলাইন রিভিউ" : "Baseline review") :
    opportunity.reviewState === "pending_recheck" ? (lang === "bn" ? "পুনঃযাচাই বাকি" : "Recheck pending") :
    (lang === "bn" ? "সম্ভবত পুরোনো" : "Possibly outdated");
  const reviewBadgeClass =
    opportunity.reviewState === "verified_current" ? "border-leaf/50 bg-secondary/70 text-secondary-foreground" :
    opportunity.reviewState === "pending_recheck" ? "border-sunflower/60 bg-accent text-accent-foreground" :
    opportunity.reviewState === "stale" ? "border-coral/60 text-coral" :
    "text-muted-foreground";

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("explore")} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("nav.explore")}
      </Button>

      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="border-leaf/40 bg-secondary/70">{opportunity.countryLabel}</Badge>
          {opportunity.institution && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Building2 className="h-3 w-3" aria-hidden="true" />
              {opportunity.institution}
            </Badge>
          )}
          <Badge variant="outline" className="text-muted-foreground">
            {t(opportunity.kind === "funding_scheme" ? "explore.kind.scheme" : "explore.kind.programme")}
          </Badge>
        </div>
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight sm:text-3xl">
          {lang === "bn" && opportunity.titleBn ? opportunity.titleBn : opportunity.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {lang === "bn" && opportunity.descriptionBn ? opportunity.descriptionBn : opportunity.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild>
            <a href={opportunity.applyUrl} target="_blank" rel="noopener noreferrer" className="gap-1.5">
              {t("detail.apply")}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
          <Button
            variant={shortlist.includes(opportunity.slug) ? "secondary" : "outline"}
            onClick={() => onToggleShortlist(opportunity.slug)}
            aria-pressed={shortlist.includes(opportunity.slug)}
            className="gap-1.5"
          >
            <Bookmark className={cn("h-4 w-4", shortlist.includes(opportunity.slug) && "fill-current")} aria-hidden="true" />
            {shortlist.includes(opportunity.slug) ? t("explore.shortlisted") : t("detail.addToShortlist")}
          </Button>
          <Button
            variant={goalSlug === opportunity.slug ? "secondary" : "outline"}
            onClick={() => setGoal(opportunity.slug)}
            aria-pressed={goalSlug === opportunity.slug}
            className="gap-1.5"
          >
            <Target className="h-4 w-4" aria-hidden="true" />
            {goalSlug === opportunity.slug ? t("detail.isGoal") : t("detail.setAsGoal")}
          </Button>
        </div>
      </header>

      {/* Match card */}
      <Card className="mb-6 border-leaf/30 bg-card">
        <CardContent className="p-5">
          <h2 className="mb-3 text-base font-semibold tracking-tight">{t("detail.matchTitle")}</h2>
          {evaluation ? (
            <>
              <p className="mb-4 text-sm font-medium text-foreground/85">
                {t("match.summary", {
                  met: evaluation.counts.met,
                  notMet: evaluation.counts.notMet,
                  info: evaluation.counts.needsInfo,
                  confirm: evaluation.counts.needsConfirm,
                })}
              </p>
              <ul className="mb-4 flex flex-col gap-2.5">
                {evaluation.results
                  .filter((r) => r.result !== "not_applicable")
                  .map((r) => (
                    <li key={r.ruleId} className="flex items-start gap-2.5 rounded-lg border border-border/70 p-3">
                      {resultIcon(r.result)}
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {lang === "bn" && r.titleBn ? r.titleBn : r.title}
                          <span className="ml-2 text-xs font-semibold text-muted-foreground">[{resultLabel(r.result)}]</span>
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{r.detail}</p>
                        {r.suggestedAction && (
                          <p className="mt-1 text-xs italic text-leaf">{t("match.action")}: {r.suggestedAction}</p>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
              <p className="text-xs text-muted-foreground">{t("match.conservative")}</p>
              <Separator className="my-4" />
              <Button variant="outline" size="sm" onClick={explain} disabled={explainBusy} className="gap-1.5">
                {explainBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                {explainBusy ? t("journey.aiExplaining") : t("journey.aiExplain")}
              </Button>
              {explanation && (
                <div className="mt-3 rounded-lg bg-accent p-4 text-sm leading-relaxed whitespace-pre-line">
                  {!explanation.aiGenerated && (
                    <p className="mb-2 text-xs font-semibold text-coral">{t("journey.aiTemplateNote")}</p>
                  )}
                  {explanation.text}
                </div>
              )}
            </>
          ) : hasUsableProfile ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">{t("detail.needsProfile")}</p>
              <Button onClick={runMatch} disabled={matching} className="gap-1.5">
                {matching && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {matching ? t("detail.matchRun") : t("detail.runMatch")}
              </Button>
              {matchError && (
                <p className="text-xs text-destructive">{t("common.error")} — {t("common.retry")}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">{t("detail.needsProfile")}</p>
              <Button variant="outline" onClick={() => navigate("onboarding")}>{t("home.ctaPrimary")}</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fit summary — deterministic counts in ordinary language. No AI:
          the same stored evaluation the match card runs, restated plainly. */}
      <Card className="mb-6 bg-card">
        <CardContent className="p-5">
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold tracking-tight">
            <Sparkles className="h-4 w-4 text-leaf" aria-hidden="true" />
            {lang === "bn" ? "ফিট সারসংক্ষেপ" : "Fit summary"}
          </h2>
          {evaluation ? (
            <p className="text-sm leading-relaxed text-foreground/85">
              {lang === "bn"
                ? `নথিভুক্ত ${evaluation.results.length}টি শর্তের মধ্যে: ${evaluation.counts.met}টি পূরণ হয়েছে, ${evaluation.counts.notMet}টি এখনো পূরণ হয়নি, ${evaluation.counts.needsInfo}টির জন্য আপনার তথ্য দরকার, ${evaluation.counts.needsConfirm}টির জন্য প্রতিষ্ঠানের নিশ্চিতকরণ দরকার।`
                : `Of ${evaluation.results.length} documented requirements: ${evaluation.counts.met} met, ${evaluation.counts.notMet} not met yet, ${evaluation.counts.needsInfo} need your information, ${evaluation.counts.needsConfirm} need institution confirmation.`}
              {evaluation.conservativeNote ? ` ${t("match.conservative")}` : ""}
              {lang === "bn"
                ? " অনিশ্চিত শর্ত অনিশ্চিতই থাকে — Uraan কখনো নিজে থেকে সেগুলো পাস করিয়ে দেয় না।"
                : " Unconfirmed items stay unconfirmed — Uraan never auto-passes them."}
            </p>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {lang === "bn"
                  ? "শর্ত যাচাই এখনো চালানো হয়নি — নিশ্চিত ফিট সারসংক্ষেপ দেখতে যাচাইটি চালান।"
                  : "The requirement check has not run yet — run it to see a deterministic fit summary."}
              </p>
              {hasUsableProfile ? (
                <Button variant="ghost" size="sm" onClick={runMatch} disabled={matching} className="gap-1.5">
                  {matching && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {matching ? t("detail.matchRun") : lang === "bn" ? "শর্ত যাচাই চালান" : "Run requirement check"}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">{t("detail.needsProfile")}</p>
              )}
              {matchError && (
                <p className="text-xs text-destructive">{t("common.error")} — {t("common.retry")}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Facts accordion */}
      <Accordion type="multiple" defaultValue={["dates", "funding"]} className="rounded-xl border border-border/70 bg-card px-4">
        <AccordionItem value="route">
          <AccordionTrigger className="text-base font-semibold">{t("detail.route")}</AccordionTrigger>
          <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
            {lang === "bn" && opportunity.routeNoteBn ? opportunity.routeNoteBn : opportunity.routeNote}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="dates">
          <AccordionTrigger className="text-base font-semibold">{t("detail.dates")}</AccordionTrigger>
          <AccordionContent>
            <div className="flex items-start gap-2.5 text-sm">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-leaf" aria-hidden="true" />
              <div>
                <p className="text-foreground/85">{opportunity.deadlineNote}</p>
                {/* Every dated round with its own state: a record with Early
                    Action and Regular Action shows BOTH — the expired round
                    labelled closed, the upcoming round labelled open — instead
                    of surfacing only the first array entry. */}
                {datedRounds.map((d) => {
                  const expired = deadlineExpired(d.closeDate!);
                  return (
                    <p key={d.id} className="mt-1.5 text-xs text-muted-foreground">
                      {d.official ? t("cal.official") : t("cal.suggested")}:{" "}
                      {deadlineLabel(d.precision, d.closeDate!, lang)} —{" "}
                      <span className={expired ? "font-medium text-coral" : "font-medium text-leaf"}>
                        {expired ? t("detail.roundExpired") : t("detail.roundUpcoming")}
                      </span>
                      {d.note ? ` — ${d.note}` : ""}
                    </p>
                  );
                })}
                <p className="mt-1 text-xs text-muted-foreground">{t("cal.precisionNote")}</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="funding">
          <AccordionTrigger className="text-base font-semibold">{t("detail.funding")}</AccordionTrigger>
          <AccordionContent>
            <p className="mb-3 text-sm font-medium text-foreground/85">{opportunity.fundingType}</p>
            {opportunity.funding.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("funding.unknownNote")}</p>
            )}
            <ul className="flex flex-col gap-2">
              {opportunity.funding.map((f) => (
                <li key={f.id} className="flex items-start gap-2 rounded-lg border border-border/70 p-3 text-sm">
                  <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-leaf" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-medium">{f.label}</p>
                    {f.amount !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        {formatForeign(f.amount, f.currency)} · {t(`funding.${f.period === "total_award" ? "totalAward" : f.period === "annual" ? "perYear" : f.period === "monthly" ? "monthly" : "oneTime"}` as Parameters<typeof t>[0])}
                        {f.period === "semester" ? " / semester" : ""}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {f.status === "policy" ? "🛡" : "⚠"}{" "}
                      {f.status === "policy"
                        ? lang === "bn" ? "প্রতিষ্ঠানের নীতি-সহায়তা (ভর্তি ও সহায়তা আবেদন শর্তে)" : "Institutional aid-policy promise (if admitted, aid application approved)"
                        : lang === "bn" ? "প্রতিযোগিতামূলক অ্যাওয়ার্ড — নিশ্চিত অর্থ নয়" : "Competitive award — not guaranteed funds"}
                    </p>
                    {f.restrictions && <p className="mt-0.5 text-xs italic text-muted-foreground">{f.restrictions}</p>}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">{t("funding.competitiveNote")}</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="requirements">
          <AccordionTrigger className="text-base font-semibold">{t("detail.requirements")}</AccordionTrigger>
          <AccordionContent>
            {/* Requirement matrix — rules grouped by category; each row's state
                chip comes from the stored evaluation (if any). Expand a rule
                for its detail and suggested action. */}
            <div className="flex flex-col gap-4">
              {REQUIREMENT_CATEGORIES.map(({ key, en, bn, Icon }) => {
                const rules = opportunity.requirements.filter((r) => r.category === key);
                if (rules.length === 0) return null;
                return (
                  <div key={key}>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Icon className="h-3.5 w-3.5 text-leaf" aria-hidden="true" />
                      {lang === "bn" ? bn : en}
                    </p>
                    <div role="list" className="flex flex-col gap-2">
                      {rules.map((r) => {
                        const result = resultByRule?.get(r.id);
                        return (
                          <Collapsible key={r.id} role="listitem" className="rounded-lg border border-border/70">
                            <div className="flex items-start gap-2 p-3">
                              <CollapsibleTrigger className="flex min-w-0 flex-1 items-start gap-2 text-left text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&[data-state=open]_.rule-chevron]:rotate-180">
                                <ChevronDown className="rule-chevron mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" aria-hidden="true" />
                                <span className="min-w-0 leading-snug">{lang === "bn" && r.titleBn ? r.titleBn : r.title}</span>
                              </CollapsibleTrigger>
                              <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                                {requirementChip(result?.result)}
                                {r.requiredness === "optional" && (
                                  <Badge variant="outline" className="text-muted-foreground">{t("common.optional")}</Badge>
                                )}
                                {r.requiredness === "conditional" && (
                                  <Badge variant="outline" className="text-muted-foreground" title={r.conditionNote}>
                                    {lang === "bn" ? "শর্তসাপেক্ষ" : "Conditional"}
                                  </Badge>
                                )}
                              </span>
                            </div>
                            <CollapsibleContent>
                              <div className="px-3 pb-3 pl-9 text-xs leading-relaxed text-muted-foreground">
                                <p>{lang === "bn" && r.detailBn ? r.detailBn : r.detail}</p>
                                {r.requiredness === "conditional" && r.conditionNote && (
                                  <p className="mt-1 italic text-coral">{r.conditionNote}</p>
                                )}
                                {result?.suggestedAction && (
                                  <p className="mt-1 italic text-leaf">
                                    {t("match.action")}: {lang === "bn" && result.suggestedActionBn ? result.suggestedActionBn : result.suggestedAction}
                                  </p>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="worksheet">
          <AccordionTrigger className="text-base font-semibold">{t("detail.worksheet")}</AccordionTrigger>
          <AccordionContent>
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-secondary/60 p-3">
              {(worksheetCurrencies(opportunity).length === 0 ? ["—"] : worksheetCurrencies(opportunity)).map((currency) =>
                currency === "—" ? null : (
                  <div key={currency} className="flex flex-col gap-1">
                    <label htmlFor={`planning-rate-${currency}`} className="text-xs font-semibold text-foreground/80">
                      {t("funding.rate")} · {currency}
                    </label>
                    <input
                      id={`planning-rate-${currency}`}
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={rates[currency] ?? ""}
                      onChange={(e) => {
                        const value = e.target.value ? Number(e.target.value) : undefined;
                        setRates((prev) => {
                          const next = { ...prev };
                          if (value && value > 0) next[currency] = value;
                          else delete next[currency];
                          return next;
                        });
                      }}
                      className="h-9 w-36 rounded-md border border-border bg-card px-3 text-sm tabular-nums"
                      placeholder={`BDT / ${currency}`}
                    />
                  </div>
                ),
              )}
              <p className="flex-1 text-xs leading-relaxed text-muted-foreground">{t("funding.rateNote")}</p>
            </div>
            {worksheet.missingRateCurrencies && worksheet.missingRateCurrencies.length > 0 && (
              <p className="mb-3 rounded-lg border border-border/70 bg-accent/40 p-2.5 text-xs leading-relaxed text-foreground/80">
                {lang === "bn"
                  ? `এই কারেন্সিগুলোর প্ল্যানিং রেট এখনো দেওয়া হয়নি: ${worksheet.missingRateCurrencies.join(", ")} — সেই লাইনগুলো অজানা থাকে, ভুল সংখ্যা বসানো হয় না।`
                  : `No planning rate entered yet for ${worksheet.missingRateCurrencies.join(", ")} — those lines stay unknown rather than being converted with a wrong number.`}
              </p>
            )}
            {worksheet.noDocumentedCosts && (
              <p className="mb-3 rounded-lg border border-border/70 bg-accent/40 p-2.5 text-xs leading-relaxed text-foreground/80">
                {lang === "bn"
                  ? "এই রেকর্ডে জীবনযাপনের খরচের কোনো ডকুমেন্টেড লাইন নেই — খরচ শূন্য নয়, অজানা। অফিসিয়াল পাতায় বর্তমান সংখ্যা দেখে নিন।"
                  : "This record documents no living-cost lines — that means unknown, not free. Check the current official cost-of-living figures before planning."}
              </p>
            )}
            {worksheet.costLines.length === 0 && worksheet.fundingLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("funding.unknownNote")}</p>
            ) : (
              <>
                {worksheet.costLines.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-sm font-semibold">{t("funding.costs")}</p>
                    <ul className="flex flex-col gap-1.5 text-sm">
                      {worksheet.costLines.map((c) => (
                        <li key={c.id} className="flex items-baseline justify-between gap-3">
                          <span className="text-muted-foreground">{c.label}</span>
                          <span className="font-medium">
                            {c.amount !== undefined && c.amountBdt !== undefined ? formatBdt(c.amountBdt) : t("common.unknown")}
                            {c.estimate ? <span className="ml-1 text-xs text-muted-foreground">({t("funding.range")})</span> : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {worksheet.uncoveredAnnualBdt !== undefined ? (
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-sm font-semibold">{t("funding.uncovered")}: {formatBdt(worksheet.uncoveredAnnualBdt)}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{contribution.note}</p>
                    {contribution.contributionBdt !== undefined && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {lang === "bn" ? "পারিবারিক সহায়তা" : "Family contribution"}: {formatBdt(contribution.contributionBdt)}
                        {contribution.gapBdt !== undefined && contribution.gapBdt > 0 && (
                          <span className="ml-2 font-semibold text-coral">
                            {lang === "bn" ? "ঘাটতি" : "Gap"}: {formatBdt(contribution.gapBdt)}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/70 bg-accent/40 p-3">
                    <p className="text-sm font-semibold">
                      {lang === "bn" ? "সঠিক মোট এখন দেওয়া সম্ভব নয়" : "An exact total is not possible yet"}
                    </p>
                    {worksheet.knownCostSubtotalBdt !== undefined && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {lang === "bn" ? "পরিচিত অংশ (বার্ষিক):" : "Known annual subtotal:"}{" "}
                        {formatBdt(worksheet.knownCostSubtotalBdt)}{" "}
                        {lang === "bn" ? "— অজানা লাইন যোগ হলে বাড়বে" : "— grows as unknown lines are resolved"}
                      </p>
                    )}
                    {worksheet.unknownCategories && worksheet.unknownCategories.length > 0 && (
                      <ul className="mt-1.5 list-disc pl-5 text-xs leading-relaxed text-muted-foreground">
                        {worksheet.unknownCategories.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-1.5 text-xs italic text-muted-foreground">{t("funding.unknownNote")}</p>
                  </div>
                )}
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="exclusions">
          <AccordionTrigger className="text-base font-semibold">{t("detail.exclusions")}</AccordionTrigger>
          <AccordionContent>
            <ul className="list-disc pl-5 text-sm leading-relaxed text-muted-foreground">
              {(lang === "bn" && opportunity.exclusionsBn ? opportunity.exclusionsBn : opportunity.exclusions).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Sources & verification drawer — the evidence trail moved out of the
          accordion onto its own surface; the review-state badge sits beside
          the trigger so freshness is visible before opening. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <BookCheck className="h-4 w-4" aria-hidden="true" />
              {lang === "bn" ? `সোর্স ও যাচাই (${opportunity.sources.length})` : `Sources & verification (${opportunity.sources.length})`}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
            <SheetHeader className="border-b border-border/70">
              <SheetTitle className="pr-6">
                {lang === "bn" ? "সোর্স ও যাচাই" : "Sources & verification"}
              </SheetTitle>
              <SheetDescription>
                {lang === "bn"
                  ? "এই রেকর্ডের প্রতিটি তথ্য এই অফিসিয়াল পাতা থেকে নেওয়া।"
                  : "Every fact in this record traces back to these official pages."}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 p-4">
              {/* Review state in ordinary language, with the retrieval date. */}
              <p className="rounded-lg bg-accent/60 p-3 text-xs leading-relaxed text-foreground/80">
                {reviewSentence}
              </p>
              <ul className="flex flex-col gap-2.5 text-sm">
                {opportunity.sources.map((s) => (
                  <li key={s.key} className="rounded-lg border border-border/70 p-3">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-1.5 font-medium underline decoration-leaf/40 underline-offset-4 hover:decoration-leaf"
                    >
                      {s.title}
                      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </a>
                    <p className="mt-1 text-xs text-muted-foreground">{s.publisher}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("detail.retrieved")}: {deadlineLabel("date", s.retrievedAt, lang)}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">{t("detail.officialNote")}</p>
            </div>
          </SheetContent>
        </Sheet>
        <Badge variant="outline" className={reviewBadgeClass} title={t(reviewKey)}>
          {reviewShortLabel}
        </Badge>
      </div>
    </main>
  );
}
