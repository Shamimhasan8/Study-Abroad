"use client";

/**
 * Opportunity detail — admission route, requirements, funding breakdown,
 * dates, sources with retrieval stamps, exclusions, and the official
 * apply link. The match check is deterministic; AI explains it on request.
 */
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  ArrowLeft, ExternalLink, Bookmark, Target, Loader2, Sparkles, CircleCheck, CircleX,
  CircleHelp, Building2, CalendarClock, FileWarning, Landmark, ShieldQuestion,
} from "lucide-react";
import { deadlineLabel } from "@/lib/dates";
import { formatBdt, formatForeign } from "@/lib/money";
import { buildFundingWorksheet, contributionContext, worksheetCurrencies } from "@/lib/funding/engine";
import type { EvaluationSummary, Opportunity } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OpportunityDetailView() {
  const { t, lang } = useI18n();
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
      void fetch("/api/shortlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      }).catch(() => undefined);
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

  const close = opportunity.deadlines.find((d) => d.closeDate);

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
        <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
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
            className="gap-1.5"
          >
            <Bookmark className={cn("h-4 w-4", shortlist.includes(opportunity.slug) && "fill-current")} aria-hidden="true" />
            {shortlist.includes(opportunity.slug) ? t("explore.shortlisted") : t("detail.addToShortlist")}
          </Button>
          <Button
            variant={goalSlug === opportunity.slug ? "secondary" : "outline"}
            onClick={() => setGoal(opportunity.slug)}
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
          ) : profile?.onboardingCompleted || (profile && profile.qualifications.length > 0) ? (
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
                {close?.closeDate && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {close.official ? t("cal.official") : t("cal.suggested")}:{" "}
                    {deadlineLabel(close.precision, close.closeDate, lang)}
                    {close.note ? ` — ${close.note}` : ""}
                  </p>
                )}
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
            <ul className="flex flex-col gap-2 text-sm">
              {opportunity.requirements.map((r) => (
                <li key={r.id} className="rounded-lg border border-border/70 p-3">
                  <p className="font-medium">{lang === "bn" && r.titleBn ? r.titleBn : r.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {lang === "bn" && r.detailBn ? r.detailBn : r.detail}
                  </p>
                  {r.requiredness === "conditional" && r.conditionNote && (
                    <p className="mt-1 text-xs italic text-coral">{r.conditionNote}</p>
                  )}
                </li>
              ))}
            </ul>
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

        <AccordionItem value="sources">
          <AccordionTrigger className="text-base font-semibold">{t("detail.sources")}</AccordionTrigger>
          <AccordionContent>
            <ul className="flex flex-col gap-2.5 text-sm">
              {opportunity.sources.map((s) => (
                <li key={s.key}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline decoration-leaf/40 underline-offset-4 hover:decoration-leaf"
                  >
                    {s.title} <ExternalLink className="inline h-3 w-3" aria-hidden="true" />
                  </a>
                  <p className="text-xs text-muted-foreground">{s.publisher} · {t("detail.retrieved")}: {s.retrievedAt}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("detail.reviewState")}: {t(opportunity.reviewState === "baseline_review" ? "review.baseline" : opportunity.reviewState === "verified_current" ? "review.verified" : "review.stale")} · {t("detail.officialNote")}
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </main>
  );
}
