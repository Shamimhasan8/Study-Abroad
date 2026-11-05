"use client";

/**
 * Funding plan — the affordability worksheet for the active goal
 * (?view=funding). Every figure comes from the funding engine
 * (src/lib/funding/engine.ts); this view only groups, labels, and draws it.
 *
 * Honesty rules kept here:
 * - Planning exchange rates are the student's own (persisted locally under
 *   "uraan.planningRates"); Uraan never invents or fetches rates. Totals
 *   move only when the student moves them.
 * - Competitive awards are displayed but never reduce any total shown.
 * - Unknown amounts/periods block exact totals; the known part and the
 *   unknown categories stay visible instead ("unknown", never zero).
 * - The timeline is schematic: only the intake anchor is derived (approx,
 *   from the profile). Disbursement dates stay "unknown" when unknown.
 */
import { useEffect, useMemo, useState } from "react";
import { localizeDigits, useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import {
  buildFundingWorksheet,
  contributionContext,
  worksheetCurrencies,
} from "@/lib/funding/engine";
import { formatBdt, formatForeign } from "@/lib/money";
import { deadlineLabel, isoOf, monthsBetween } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MilestonePath } from "../illustrations";
import {
  CalendarClock,
  CircleAlert,
  Coins,
  HandCoins,
  Landmark,
} from "lucide-react";
import type { CostItem, FundingItem, Opportunity } from "@/lib/types";

/** Local, per-browser planning rates (never synced, never guessed). */
const RATES_STORAGE_KEY = "uraan.planningRates";

/** Cost kinds that fall due BEFORE enrolment (spec: Group A). */
const UPFRONT_KINDS: ReadonlySet<CostItem["kind"]> = new Set([
  "fee",
  "deposit",
  "test",
  "visa",
  "travel",
]);

/** Cost periods that repeat while studying (spec: Group B). */
const RECURRING_PERIODS: ReadonlySet<CostItem["period"]> = new Set([
  "annual",
  "semester",
  "monthly",
]);

type CostLine = CostItem & { amountBdt?: number };
type FundingLine = FundingItem & { amountBdt?: number };

/** Intake anchor: fall → September, spring → April; +12 months if absent. */
function approxIntake(profile: {
  targetIntakeYear?: number;
  targetIntakeTerm?: "fall" | "spring";
}) {
  const now = new Date();
  if (typeof profile.targetIntakeYear === "number") {
    const month = profile.targetIntakeTerm === "spring" ? 3 : 8; // April / September
    return { date: new Date(profile.targetIntakeYear, month, 1), fromProfile: true };
  }
  return { date: new Date(now.getFullYear(), now.getMonth() + 12, 1), fromProfile: false };
}

export function FundingView() {
  const { t, lang } = useI18n();
  const { goalSlug, profile, navigate } = useAppStore();

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  // Per-currency planning rates the student enters (persisted to localStorage).
  const [rates, setRates] = useState<Record<string, number>>({});

  // Load stored rates once on mount (client-only; storage may be unavailable).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RATES_STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const clean: Record<string, number> = {};
      for (const [code, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
          clean[code] = value;
        }
      }
      setRates(clean);
    } catch {
      /* corrupted or unavailable storage — start empty, honestly */
    }
  }, []);

  const setRate = (currency: string, raw: string) => {
    const parsed = Number(raw);
    const next = { ...rates };
    if (raw.trim() !== "" && Number.isFinite(parsed) && parsed > 0) {
      next[currency] = parsed;
    } else {
      delete next[currency];
    }
    setRates(next);
    try {
      window.localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — the worksheet still works in-memory */
    }
  };

  // Fetch the goal opportunity (same pattern as journey-view).
  useEffect(() => {
    if (!goalSlug) {
      setOpportunity(null);
      setLoading(false);
      setLoadError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    void (async () => {
      try {
        const res = await fetch(`/api/catalogue/${goalSlug}`);
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        setOpportunity(res.ok && json?.ok ? (json.data.opportunity as Opportunity) : null);
        setLoadError(!(res.ok && json?.ok));
      } catch {
        if (!cancelled) {
          setOpportunity(null);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [goalSlug, reloadNonce]);

  const currencies = useMemo(
    () => (opportunity ? worksheetCurrencies(opportunity) : []),
    [opportunity],
  );

  const worksheet = useMemo(
    () => (opportunity && profile ? buildFundingWorksheet(opportunity, profile, rates) : null),
    [opportunity, profile, rates],
  );

  // ---------- rendering helpers (bilingual, engine-truthful) ----------

  /** Bengali digits for Bangla UI; plain otherwise. */
  const bnDigits = (text: string) =>
    lang === "bn" ? text.replace(/\d/g, (d) => localizeDigits(Number(d), lang)) : text;
  const moneyBdt = (n: number) => bnDigits(formatBdt(n));
  const moneyForeign = (n: number, currency: string) => bnDigits(formatForeign(n, currency));

  const missingRate = (currency: string) =>
    Boolean(worksheet?.missingRateCurrencies?.includes(currency));

  const periodLabel = (period: CostItem["period"] | FundingItem["period"]): string => {
    switch (period) {
      case "annual":
        return t("funding.perYear");
      case "semester":
        return lang === "bn" ? "প্রতি সেমেস্টার" : "per semester";
      case "monthly":
        return t("funding.monthly");
      case "one_time":
        return t("funding.oneTime");
      case "total_award":
        return t("funding.totalAward");
      default:
        return t("common.unknown");
    }
  };

  /** Amount cell: BDT when the engine resolved it, else the documented
   * foreign figure with the honest reason, else "not documented". */
  const renderAmount = (line: CostLine | FundingLine) => {
    if (line.amountBdt !== undefined) {
      return <span className="font-semibold tabular-nums">{moneyBdt(line.amountBdt)}</span>;
    }
    if (line.amount !== undefined) {
      const reason = missingRate(line.currency)
        ? lang === "bn"
          ? "আপনার হার দরকার"
          : "needs your rate"
        : lang === "bn"
          ? "সময়কাল অজানা — বার্ষিক হিসাব হয় না"
          : "duration unknown — not annualized";
      return (
        <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
          <span className="tabular-nums">
            {line.currency === "BDT"
              ? moneyBdt(line.amount)
              : moneyForeign(line.amount, line.currency)}
          </span>
          <Badge
            variant="outline"
            className="border-sunflower/60 bg-sunflower/20 text-[10px] font-normal text-foreground/80"
          >
            {reason}
          </Badge>
        </span>
      );
    }
    return (
      <Badge
        variant="outline"
        className="border-sunflower/60 bg-sunflower/20 text-[10px] font-normal text-foreground/80"
      >
        {lang === "bn" ? "পরিমাণ ডকুমেন্টেড নয়" : "Amount not documented"}
      </Badge>
    );
  };

  // ---------- empty / loading states ----------

  if (!goalSlug || !profile) {
    const needsProfile = !profile;
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 text-center sm:px-6">
        <MilestonePath width={260} height={110} className="mx-auto" aria-hidden="true" />
        <h1 className="mt-6 font-display text-[26px] font-bold tracking-tight sm:text-3xl">
          {lang === "bn" ? "ফান্ডিং প্ল্যান" : "Funding plan"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {needsProfile
            ? lang === "bn"
              ? "হিসাব শুরু করতে আগে অনবোর্ডিং সম্পূর্ণ করুন — তারপর একটি টার্গেট বেছে নিন।"
              : "Finish onboarding and pick a target first — then the funding worksheet can be built."
            : lang === "bn"
              ? "এখনো কোনো টার্গেট নেই। Explore থেকে একটি সুযোগ বেছে নিলে এখানে খরচ-বনাম-ফান্ডিং হিসাব দেখা যাবে।"
              : "No goal picked yet. Choose an opportunity in Explore and its costs-versus-funding worksheet appears here."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={() => navigate(needsProfile ? "onboarding" : "explore")}>
            {needsProfile ? t("home.ctaPrimary") : t("journey.setGoal")}
          </Button>
          {!needsProfile && (
            <Button variant="outline" onClick={() => navigate("onboarding")}>
              {t("common.back")}
            </Button>
          )}
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" aria-busy="true" />
        <div className="mt-6 flex flex-col gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl border border-border/60 bg-muted/60" />
          ))}
        </div>
        <span className="sr-only">{t("common.loading")}</span>
      </main>
    );
  }

  if (loadError || !opportunity || !worksheet) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="font-display text-[26px] font-bold tracking-tight sm:text-3xl">
          {lang === "bn" ? "ফান্ডিং প্ল্যান" : "Funding plan"}
        </h1>
        <Card className="mt-6 border-border/70 bg-card">
          <CardContent className="flex flex-col items-start gap-3 p-5">
            <p className="text-sm text-muted-foreground">
              {lang === "bn"
                ? "এই টার্গেটের ফান্ডিং রেকর্ড এখন আনা যায়নি — আপনার ডেটা নিরাপদ, কিছুই বদলায়নি।"
                : "The funding record for this goal could not be loaded — your data is safe and nothing changed."}
            </p>
            <Button variant="outline" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // ---------- worksheet groupings (the engine output is the truth) ----------

  const costLines: CostLine[] = worksheet.costLines;
  const isUpfrontLine = (line: CostLine) =>
    line.period === "one_time" || UPFRONT_KINDS.has(line.kind);
  const isRecurringLine = (line: CostLine) =>
    !isUpfrontLine(line) && RECURRING_PERIODS.has(line.period);
  const upfrontLines = costLines.filter(isUpfrontLine);
  const recurringLines = costLines.filter(isRecurringLine);
  // Never silently drop a documented line that fits neither group.
  const otherLines = costLines.filter(
    (line) => !isUpfrontLine(line) && !isRecurringLine(line),
  );

  const policyLines: FundingLine[] = worksheet.fundingLines.filter(
    (line) => line.status === "policy",
  );
  const competitiveLines: FundingLine[] = worksheet.fundingLines.filter(
    (line) => line.status === "competitive",
  );

  // Annual cost truth: sum the engine's annualized BDT lines; the total is
  // exact only when every documented line resolved.
  const annualExact =
    !worksheet.noDocumentedCosts &&
    costLines.length > 0 &&
    costLines.every((line) => line.amountBdt !== undefined);
  const annualKnownSum = costLines.reduce((sum, line) => sum + (line.amountBdt ?? 0), 0);

  const unknownCategories = worksheet.unknownCategories ?? [];
  const hasUnknownCosts =
    unknownCategories.length > 0 || Boolean(worksheet.noDocumentedCosts);

  // ---------- timeline geometry (schematic; intake anchor approx) ----------

  const intake = approxIntake(profile);
  const monthsToIntake = Math.max(1, monthsBetween(new Date(), intake.date));
  const totalMonths = monthsToIntake + 24;
  const xOf = (m: number) => 60 + (m / totalMonths) * 680;
  const xEnrol = xOf(monthsToIntake);
  const xYear1 = xOf(monthsToIntake + 12);
  const xYear2 = xOf(totalMonths);
  const bandMid = (xEnrol + xYear2) / 2;
  const intakeText = intake.fromProfile
    ? bnDigits(deadlineLabel("month", isoOf(intake.date), lang))
    : `+${localizeDigits(12, lang)} ${lang === "bn" ? "মাস" : "months"}`;
  const enrolLabel = `${lang === "bn" ? "ভর্তি" : "Enrolment"} ${intakeText} (${
    lang === "bn" ? "আনুমানিক" : "approx"
  })`;

  const upfrontMarkerLabel =
    worksheet.upfrontNeededBdt !== undefined ? moneyBdt(worksheet.upfrontNeededBdt) : null;
  const annualMarkerLabel = annualExact ? moneyBdt(annualKnownSum) : null;
  const drawPolicyBand = policyLines.length > 0;
  const drawCompetitive = competitiveLines.length > 0;
  const unknownText = lang === "bn" ? "অজানা" : "unknown";

  // ---------- contribution context ----------

  const contribution = contributionContext(profile, worksheet.uncoveredAnnualBdt);
  const bnNote =
    contribution.gapBdt === undefined
      ? lang === "bn"
        ? "কিছু পরিমাণ অজানা থাকায় সম্পূর্ণ ঘাটতি এখনো হিসাব করা যাচ্ছে না।"
        : null
      : contribution.gapBdt > 0
        ? lang === "bn"
          ? "এই ঘাটতি বাস্তব — বন্ধ করতে পারে শুধু নিশ্চিত অ্যাওয়ার্ড, বদলে যাওয়া পরিকল্পনা বা অর্থায়িত বিকল্প; অনুমানের খণ্ডকালীন কাজ বা নামহীন ভবিষ্যৎ বৃত্তি দিয়ে নয়।"
          : null
        : lang === "bn"
          ? "আপনার লেখা অবদান ডকুমেন্টেড অনাচ্ছাদিত খরচ কভার করছে। খরচ বদলায় — প্রতি সাইকেলে আবার মিলিয়ে নিন।"
          : null;

  // ---------- render ----------

  const costLineRow = (line: CostLine, recurring: boolean) => (
    <li
      key={line.id}
      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-1.5 text-sm"
    >
      <span className="min-w-0">
        <span className="leading-snug">{line.label}</span>
        <span className="ml-2 whitespace-nowrap text-xs text-muted-foreground">
          {periodLabel(line.period)}
        </span>
        {recurring && line.amountBdt !== undefined && line.period === "semester" && (
          <span className="ml-1 whitespace-nowrap text-xs text-muted-foreground">
            {`· ${lang === "bn" ? "×২/বছর ≈" : "×2/yr ≈"}`}
          </span>
        )}
        {recurring && line.amountBdt !== undefined && line.period === "monthly" && (
          <span className="ml-1 whitespace-nowrap text-xs text-muted-foreground">
            {`· ${lang === "bn" ? "×১২/বছর ≈" : "×12/yr ≈"}`}
          </span>
        )}
      </span>
      <span className="shrink-0 text-right">{renderAmount(line)}</span>
    </li>
  );

  const fundingLineRow = (line: FundingLine, variant: "policy" | "competitive") => (
    <li
      key={line.id}
      className={
        variant === "policy"
          ? "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-leaf/30 bg-secondary/60 px-3 py-2 text-sm"
          : "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-sm"
      }
    >
      <span className="min-w-0">
        <span className="leading-snug">{line.label}</span>
        <span className="ml-2 whitespace-nowrap text-xs text-muted-foreground">
          {periodLabel(line.period)}
        </span>
      </span>
      <span className="shrink-0 text-right">{renderAmount(line)}</span>
    </li>
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 font-display text-[26px] font-bold tracking-tight sm:text-3xl">
          <Coins className="h-6 w-6 text-leaf" aria-hidden="true" />
          {lang === "bn" ? "ফান্ডিং প্ল্যান" : "Funding plan"}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Badge
            variant="outline"
            className="max-w-full border-leaf/40 bg-secondary/70 sm:max-w-[340px]"
          >
            <span className="truncate">
              {lang === "bn" && opportunity.titleBn ? opportunity.titleBn : opportunity.title}
            </span>
          </Badge>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => navigate("detail", goalSlug)}
          >
            {t("common.viewDetails")}
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("funding.subtitle")}</p>
      </header>

      {/* 2. Exchange assumptions */}
      {currencies.length > 0 && (
        <Card className="mb-6 border-border/70 bg-card">
          <CardContent className="p-5">
            <h2 className="text-base font-semibold tracking-tight">
              {lang === "bn" ? "আপনার পরিকল্পনার বিনিময় হার" : "Your planning exchange rates"}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {lang === "bn"
                ? "এই হারগুলো আপনি ঠিক করেন — উড়ান কখনোই হার বানায় না। আপনি বদলালে মোটও বদলে যায়।"
                : "You set these — Uraan never invents rates. Totals change when you change them."}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {currencies.map((currency) => (
                <div key={currency} className="flex flex-col gap-1.5">
                  <Label htmlFor={`rate-${currency}`}>
                    {`1 ${currency} = ? BDT ${
                      lang === "bn" ? "(আপনার অনুমান)" : "(your assumption)"
                    }`}
                  </Label>
                  <Input
                    id={`rate-${currency}`}
                    type="number"
                    min={0}
                    step={0.01}
                    inputMode="decimal"
                    className="bg-card tabular-nums"
                    value={rates[currency] ?? ""}
                    onChange={(event) => setRate(currency, event.target.value)}
                    placeholder={lang === "bn" ? "হার লিখুন" : "Enter a rate"}
                  />
                  {!(rates[currency] > 0) && (
                    <p className="text-xs font-medium text-coral">
                      {`${currency} — ${
                        lang === "bn" ? "এই হারটি দরকার" : "needs your rate"
                      }`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. When you need cash */}
      <Card className="mb-6 border-border/70 bg-card">
        <CardContent className="p-5">
          <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
            <CalendarClock className="h-4 w-4 text-leaf" aria-hidden="true" />
            {lang === "bn" ? "টাকা কখন লাগবে" : "When you need cash"}
          </h2>

          <section className="mt-4">
            <h3 className="text-sm font-semibold">
              {lang === "bn" ? "ভর্তির আগেই (এককালীন)" : "Before you can enrol (one-time)"}
            </h3>
            {upfrontLines.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {lang === "bn"
                  ? "এই রেকর্ডে ভর্তির-আগে খরচের কোনো সারি নেই।"
                  : "No before-enrolment cost lines documented for this record."}
              </p>
            ) : (
              <ul className="mt-1 divide-y divide-border/60">
                {upfrontLines.map((line) => costLineRow(line, false))}
              </ul>
            )}
          </section>

          <Separator className="my-4" />

          <section className="mt-4">
            <h3 className="text-sm font-semibold">
              {lang === "bn" ? "পড়ার সময় প্রতি বছর" : "Every year while studying"}
            </h3>
            {recurringLines.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {lang === "bn"
                  ? "এই রেকর্ডে বার্ষিক/সেমেস্টার/মাসিক খরচের কোনো সারি নেই।"
                  : "No annual/semester/monthly cost lines documented for this record."}
              </p>
            ) : (
              <ul className="mt-1 divide-y divide-border/60">
                {recurringLines.map((line) => costLineRow(line, true))}
              </ul>
            )}
            {otherLines.length > 0 && (
              <>
                <h4 className="mt-3 text-sm font-semibold">
                  {lang === "bn" ? "যেমন ডকুমেন্টেড (অন্যান্য)" : "As documented (other)"}
                </h4>
                <ul className="mt-1 divide-y divide-border/60">
                  {otherLines.map((line) => costLineRow(line, false))}
                </ul>
              </>
            )}
          </section>

          {hasUnknownCosts && (
            <div className="mt-4 rounded-lg border border-sunflower/70 bg-sunflower/15 p-3">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <CircleAlert className="h-4 w-4 text-sunflower" aria-hidden="true" />
                {lang === "bn" ? "অজানা খরচ" : "Unknown costs"}
              </h3>
              <p className="mt-1 text-xs font-medium">
                {lang === "bn" ? "এগুলো অজানা — বিনামূল্যে নয়।" : "These are UNKNOWN, not free."}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("funding.unknownNote")}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-foreground/80">
                {worksheet.noDocumentedCosts && (
                  <li>
                    {lang === "bn"
                      ? "এই রেকর্ডে জীবনযাত্রার খরচ ডকুমেন্ট করা নেই।"
                      : "Living costs are not documented for this record."}
                  </li>
                )}
                {unknownCategories.map((category) => (
                  <li key={category}>{category}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 rounded-lg bg-accent p-3">
            {worksheet.upfrontNeededBdt !== undefined && upfrontLines.length > 0 ? (
              <p className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="font-semibold">{t("funding.upfront")}:</span>
                <span className="text-base font-bold tabular-nums text-coral">
                  {moneyBdt(worksheet.upfrontNeededBdt)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {lang === "bn" ? "ভর্তির আগেই হাতে থাকতে হবে" : "must be in hand before enrolment"}
                </span>
              </p>
            ) : upfrontLines.length === 0 ? (
              /* Zero DOCUMENTED upfront lines is not the same as "you need
                 zero money" — visa/residence/permit costs are simply not
                 documented for this record. Never let absence read as free. */
              <p className="text-sm">
                <span className="font-semibold">{t("funding.upfront")}:</span>{" "}
                <span className="font-medium text-sunflower">
                  {lang === "bn" ? "নথিভুক্ত কোনো ভর্তির-আগে খরচ নেই" : "No before-enrolment costs documented"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {lang === "bn"
                    ? "এর মানে এই নয় যে কিছুই লাগবে না — ভিসা/রেসিডেন্স পারমিটের খরচ এই রেকর্ডে নথিভুক্ত নয়; অফিসিয়াল সূত্রে যাচাই করুন।"
                    : "That is NOT the same as free — visa/residence-permit costs are simply undocumented for this record; verify them on the official source."}
                </span>
              </p>
            ) : worksheet.knownCostSubtotalBdt !== undefined ? (
              <p className="flex flex-wrap items-baseline gap-2 text-sm">
                <span>
                  {lang === "bn"
                    ? "অজানা থাকায় শুরুর মোট হিসাব বন্ধ — ডকুমেন্টেড অংশ:"
                    : "Upfront total blocked by unknowns — known documented part:"}
                </span>
                <span className="font-semibold tabular-nums">
                  {moneyBdt(worksheet.knownCostSubtotalBdt)}
                </span>
                <span className="text-xs text-muted-foreground">{`(${t("funding.perYear")})`}</span>
              </p>
            ) : (
              <p className="text-sm">
                {lang === "bn"
                  ? "অজানা খরচ থাকায় শুরুর মোট এখন হিসাব করা যাচ্ছে না।"
                  : "The upfront total cannot be computed while some costs are unknown."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4. Funding — kept separate */}
      <Card className="mb-6 border-border/70 bg-card">
        <CardContent className="p-5">
          <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
            <Landmark className="h-4 w-4 text-leaf" aria-hidden="true" />
            {lang === "bn" ? "ফান্ডিং — আলাদা রাখা" : "Funding — kept separate"}
          </h2>

          {policyLines.length > 0 && (
            <section className="mt-4">
              <h3 className="text-sm font-semibold text-leaf">
                {lang === "bn" ? "শর্তসাপেক্ষ / নীতিভিত্তিক ফান্ডিং" : "Conditional / policy funding"}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {lang === "bn"
                  ? "ভর্তি ও এইড আবেদন সম্পূর্ণ হলে নীতি অনুযায়ী প্রতিশ্রুত — নিশ্চিত নগদ নয়।"
                  : "Promised by policy if admitted & aid application complete — not guaranteed cash."}
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {policyLines.map((line) => fundingLineRow(line, "policy"))}
              </ul>
            </section>
          )}

          {competitiveLines.length > 0 && (
            <section className={policyLines.length > 0 ? "mt-5" : "mt-4"}>
              <h3 className="text-sm font-semibold text-coral">
                {lang === "bn" ? "প্রতিযোগিতামূলক অ্যাওয়ার্ড" : "Competitive awards"}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {lang === "bn"
                  ? "জিততেই হবে — কখনোই নিশ্চিত অর্থ হিসেবে গোনা হয় না।"
                  : "Must be WON — never counted as guaranteed funds."}
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {competitiveLines.map((line) => fundingLineRow(line, "competitive"))}
              </ul>
            </section>
          )}

          {policyLines.length === 0 && competitiveLines.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {lang === "bn" ? "এই রুটের জন্য কোনো ডকুমেন্টেড ফান্ডিং নেই।" : "No documented funding for this route."}
            </p>
          )}

          <Separator className="my-4" />
          <div className="flex flex-col gap-1.5 text-sm">
            {worksheet.policyAnnualBdt !== undefined && (
              <p className="flex flex-wrap items-baseline gap-2">
                <span>
                  {lang === "bn" ? "নীতি প্রতিশ্রুতি" : "Policy promise"}
                  {` (${t("funding.perYear")})`}:
                </span>
                <span className="font-semibold tabular-nums text-leaf">
                  {moneyBdt(worksheet.policyAnnualBdt)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {lang === "bn" ? "যদি ভর্তি ও এইড অনুমোদিত হয়" : "if admitted & aid approved"}
                </span>
              </p>
            )}
            {worksheet.competitiveAnnualBdt !== undefined && (
              <p className="flex flex-wrap items-baseline gap-2">
                <span>
                  {lang === "bn" ? "প্রতিযোগিতামূলক" : "Competitive"}
                  {` (${t("funding.perYear")})`}:
                </span>
                <span className="font-semibold tabular-nums text-coral">
                  {moneyBdt(worksheet.competitiveAnnualBdt)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {lang === "bn"
                    ? "কেবল জিতলে — কোনো মোট থেকে বাদ দেওয়া হয় না"
                    : "only if won — never subtracted from any total"}
                </span>
              </p>
            )}
            <p className="text-xs text-muted-foreground">{t("funding.competitiveNote")}</p>
          </div>
        </CardContent>
      </Card>

      {/* 5. Funding timeline (schematic) */}
      <Card className="mb-6 border-border/70 bg-card">
        <CardContent className="p-5">
          <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
            <CalendarClock className="h-4 w-4 text-leaf" aria-hidden="true" />
            {lang === "bn" ? "ফান্ডিং টাইমলাইন" : "Funding timeline"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {lang === "bn"
              ? "ছবিটি কাঠামোগত — কেবল ইনটেক অ্যাংকরটি আপনার প্রোফাইল থেকে (আনুমানিক)। অ্যাওয়ার্ড কখন ছাড়া হয় তা অজানা থাকলে অজানাই থাকে।"
              : "The picture is schematic — only the intake anchor comes from your profile (approx). Award disbursement dates stay unknown when unknown."}
          </p>

          <svg
            viewBox="0 0 800 140"
            className="mt-4 h-auto w-full"
            role="img"
            aria-label={
              lang === "bn"
                ? "টাইমলাইন: আজ থেকে ভর্তি ও দুই বছর — শুরুর নগদ, বার্ষিক খরচ, নীতি ফান্ডিং ও প্রতিযোগিতামূলক অ্যাওয়ার্ড চিহ্নসহ"
                : "Timeline: today to enrolment and two years — upfront cash, annual costs, policy funding and competitive award markers"
            }
          >
            {/* baseline with arrowhead */}
            <path d="M 60 74 H 726" className="stroke-border" strokeWidth={2} fill="none" />
            <path d="M 726 74 l -10 -5 v 10 z" className="fill-border" />

            {/* dashed sage band: policy funding could cover, from enrolment */}
            {drawPolicyBand && (
              <>
                <rect
                  x={xEnrol}
                  y={60}
                  width={Math.max(0, xYear2 - xEnrol)}
                  height={28}
                  rx={6}
                  className="fill-secondary"
                  fillOpacity={0.75}
                />
                <rect
                  x={xEnrol}
                  y={60}
                  width={Math.max(0, xYear2 - xEnrol)}
                  height={28}
                  rx={6}
                  className="fill-none stroke-leaf"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                />
                <text x={bandMid} y={106} textAnchor="middle" fontSize={11} className="fill-leaf">
                  {lang === "bn" ? "ভর্তি ও এইড অনুমোদিত হলে" : "if admitted & aid approved"}
                </text>
              </>
            )}

            {/* time ticks + labels */}
            {[
              { x: 60, label: lang === "bn" ? "আজ" : "Today", anchor: "start" as const },
              {
                x: xEnrol,
                label: lang === "bn" ? "ভর্তি (আনুমানিক)" : "Enrolment (approx)",
                anchor: "middle" as const,
              },
              { x: xYear1, label: lang === "bn" ? "১ বছর শেষ" : "Year 1 end", anchor: "middle" as const },
              { x: xYear2, label: lang === "bn" ? "২ বছর শেষ" : "Year 2 end", anchor: "end" as const },
            ].map((tick) => (
              <g key={tick.label}>
                <path d={`M ${tick.x} 70 v 8`} className="stroke-border" strokeWidth={2} />
                <text
                  x={tick.x}
                  y={126}
                  textAnchor={tick.anchor}
                  fontSize={11}
                  className="fill-muted-foreground"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* upfront cash need: coral circle at Today+ */}
            <g>
              <circle cx={86} cy={58} r={7} className="fill-coral" />
              <text x={86} y={40} textAnchor="middle" fontSize={11} className="fill-coral font-semibold">
                {upfrontMarkerLabel ?? unknownText}
              </text>
            </g>

            {/* competitive award: dashed coral "?" at enrolment (if won) */}
            {drawCompetitive && (
              <g>
                <path
                  d={`M ${xEnrol} 52 V 70`}
                  className="stroke-coral"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
                <circle
                  cx={xEnrol}
                  cy={44}
                  r={8}
                  className="fill-none stroke-coral"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
                <text x={xEnrol} y={48} textAnchor="middle" fontSize={11} className="fill-coral font-semibold">
                  ?
                </text>
                <text x={xEnrol + 14} y={48} fontSize={10} className="fill-coral">
                  {lang === "bn" ? "জিতলে" : "if won"}
                </text>
              </g>
            )}

            {/* annual cost: leaf squares at each year */}
            {[
              { x: xYear1, label: annualMarkerLabel },
              { x: xYear2, label: annualMarkerLabel },
            ].map((marker, idx) => (
              <g key={idx}>
                <rect x={marker.x - 5} y={69} width={10} height={10} className="fill-leaf" />
                <text
                  x={marker.x}
                  y={58}
                  textAnchor="middle"
                  fontSize={11}
                  className="fill-leaf font-semibold"
                >
                  {marker.label ?? unknownText}
                </text>
              </g>
            ))}
          </svg>

          {/* honest text fallback — same facts, visible small text */}
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
            <li>
              {lang === "bn" ? "আজ: শুরুর নগদ প্রয়োজন " : "Today: upfront cash needed "}
              {worksheet.upfrontNeededBdt !== undefined
                ? moneyBdt(worksheet.upfrontNeededBdt)
                : unknownText}
              {worksheet.upfrontNeededBdt === undefined &&
                worksheet.knownCostSubtotalBdt !== undefined &&
                ` (${lang === "bn" ? "ডকুমেন্টেড অংশ " : "known part "}${moneyBdt(
                  worksheet.knownCostSubtotalBdt,
                )} ${t("funding.perYear")})`}
              .
            </li>
            <li>
              {enrolLabel}
              {": "}
              {drawPolicyBand
                ? worksheet.policyAnnualBdt !== undefined
                  ? `${lang === "bn" ? "নীতি ফান্ডিং শুরু হতে পারে " : "policy funding could start covering "}${moneyBdt(
                      worksheet.policyAnnualBdt,
                    )} ${t("funding.perYear")} — ${
                      lang === "bn" ? "ভর্তি ও এইড অনুমোদিত হলে" : "if admitted & aid approved"
                    }`
                  : `${lang === "bn" ? "নীতি ফান্ডিং সম্ভব — " : "policy funding possible — "}${
                      lang === "bn" ? "পরিমাণ অজানা" : "amount unknown"
                    }`
                : lang === "bn"
                  ? "কোনো ডকুমেন্টেড নীতি ফান্ডিং নেই"
                  : "no documented policy funding"}
              .
            </li>
            {drawCompetitive && (
              <li>
                {lang === "bn" ? "প্রতিযোগিতামূলক অ্যাওয়ার্ড " : "Competitive awards "}
                {worksheet.competitiveAnnualBdt !== undefined
                  ? moneyBdt(worksheet.competitiveAnnualBdt)
                  : unknownText}
                {` (${lang === "bn" ? "প্রতি বছর" : "per year"}) — ${
                  lang === "bn" ? "জিতলে; ছাড়ার তারিখ অজানা" : "if won; disbursement date unknown"
                }.`}
              </li>
            )}
            <li>
              {lang === "bn" ? "বার্ষিক খরচ (১ ও ২ বছর শেষে): " : "Annual cost (Year 1 and Year 2 end): "}
              {annualExact ? moneyBdt(annualKnownSum) : unknownText}
              {!annualExact &&
                worksheet.knownCostSubtotalBdt !== undefined &&
                ` (${lang === "bn" ? "ডকুমেন্টেড অংশ " : "known part "}${moneyBdt(
                  worksheet.knownCostSubtotalBdt,
                )})`}
              .
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* 6. Contribution context */}
      <Card className="mb-6 border-border/70 bg-card">
        <CardContent className="p-5">
          <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
            <HandCoins className="h-4 w-4 text-leaf" aria-hidden="true" />
            {lang === "bn" ? "পরিবারের অবদান ও ঘাটতি" : "Family contribution & gap"}
          </h2>
          <div className="mt-3 flex flex-col gap-1.5 text-sm">
            <p className="flex flex-wrap items-baseline gap-2">
              <span>{t("onboarding.money.contribution")}:</span>
              <span className="font-semibold tabular-nums">
                {contribution.contributionBdt !== undefined
                  ? moneyBdt(contribution.contributionBdt)
                  : lang === "bn"
                    ? "লেখা নেই"
                    : "not recorded"}
              </span>
            </p>
            <p className="flex flex-wrap items-baseline gap-2">
              <span>{t("funding.uncovered")}:</span>
              <span className="font-semibold tabular-nums">
                {worksheet.uncoveredAnnualBdt !== undefined
                  ? moneyBdt(worksheet.uncoveredAnnualBdt)
                  : unknownText}
              </span>
              {worksheet.uncoveredAnnualBdt === undefined && (
                <span className="text-xs text-muted-foreground">
                  {lang === "bn" ? "কিছু খরচ/হার অজানা থাকায়" : "some costs or rates are still unknown"}
                </span>
              )}
            </p>
            {contribution.gapBdt !== undefined && (
              <p className="flex flex-wrap items-baseline gap-2">
                <span>{lang === "bn" ? "বছরে ঘাটতি" : "Gap per year"}:</span>
                <span
                  className={`font-semibold tabular-nums ${
                    contribution.gapBdt > 0 ? "text-coral" : "text-leaf"
                  }`}
                >
                  {moneyBdt(contribution.gapBdt)}
                </span>
              </p>
            )}
          </div>
          <div className="mt-3 rounded-lg bg-accent p-3 text-xs leading-relaxed text-foreground/75">
            <p>{contribution.note}</p>
            {bnNote && <p className="mt-1.5">{bnNote}</p>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("onboarding.money.note")}</p>
        </CardContent>
      </Card>
    </main>
  );
}
