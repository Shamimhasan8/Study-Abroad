"use client";

/**
 * Explore — the public catalogue. Guests browse freely; every record
 * shows its kind, cycle status, and honest review state.
 */
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Compass, Bookmark, Scale, Eye, MapPin, CircleHelp } from "lucide-react";
import { deadlineLabel, nextDeadlineDisplay, deadlineExpired, parseISODate } from "@/lib/dates";
import type { Opportunity, CostItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type CatalogueResponse = {
  opportunities: Opportunity[];
  guides: { code: string; nameEn: string; nameBn: string }[];
};

/** Sort keys — client-side only, deliberately NOT part of exploreFilters
 *  so URLs / deep links keep the server's default order. */
type SortKey = "recommended" | "deadline" | "title" | "funding";

/** The country codes the destination filter actually accepts — a guide
 *  badge may only set the filter when its code is in this set. */
const COUNTRY_FILTER_CODES = ["US", "DE", "JP", "EU"];

/**
 * Deadline sort key: the earliest NON-expired closeDate (milliseconds).
 * null when every dated round has closed or none are dated — those records
 * sort after all live deadlines, and the stable sort keeps server order
 * among them (never a fabricated "next" date).
 */
const nextLiveDeadline = (deadlines: Opportunity["deadlines"]): number | null => {
  let earliest: number | null = null;
  for (const d of deadlines) {
    if (!d.closeDate || deadlineExpired(d.closeDate)) continue; // closed rounds never anchor a "soonest" sort
    const t = parseISODate(d.closeDate)?.getTime();
    if (t === undefined) continue;
    if (earliest === null || t < earliest) earliest = t;
  }
  return earliest;
};

/** Funding-coverage sort rank: policy funding first, competitive second,
 *  no listed funding last. */
const fundingRank = (o: Opportunity): number =>
  o.funding.length === 0 ? 2 : o.funding.some((f) => f.status !== "competitive") ? 0 : 1;

/** Compact period word for the card facts row (bilingual inline). */
const periodShortLabel = (period: CostItem["period"], lang: "en" | "bn"): string =>
  period === "annual" ? (lang === "bn" ? "বছর" : "yr") :
  period === "semester" ? (lang === "bn" ? "সেমিস্টার" : "semester") :
  period === "monthly" ? (lang === "bn" ? "মাস" : "mo") :
  period === "one_time" ? (lang === "bn" ? "একবার" : "once") :
  (lang === "bn" ? "মোট" : "total");

export function ExploreView() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { navigate, shortlist, toggleShortlist, compareSlugs, toggleCompare, profile, user } = useAppStore();
  const { query, country, level, cycle } = useAppStore((s) => s.exploreFilters);
  const setExploreFilters = useAppStore((s) => s.setExploreFilters);

  const [data, setData] = useState<CatalogueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Sort preference — component state only, never in exploreFilters.
  const [sortBy, setSortBy] = useState<SortKey>("recommended");

  // Pre-fill the destination filter once from onboarding preferences.
  // Degree level is NOT pre-filled: exact-level filtering would hide
  // combined master/PhD records from master's-seekers.
  useEffect(() => {
    if (profile?.countryPrefs?.length) {
      if (useAppStore.getState().exploreFilters.country === "all") {
        setExploreFilters({ country: profile.countryPrefs[0] });
      }
    }
     
  }, [profile?.countryPrefs]);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/catalogue");
      const json = await res.json();
      if (json.ok) setData(json.data);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    // Level inclusion mirrors the API: master's/PhD include master_phd records.
    const levelInclusion: Record<string, string[]> = {
      bachelor: ["bachelor"],
      master: ["master", "master_phd"],
      phd: ["phd", "master_phd"],
      master_phd: ["master_phd"],
    };
    const list = data.opportunities.filter((o) => {
      if (country !== "all" && o.country !== country) return false;
      if (level !== "all" && !(levelInclusion[level] ?? [level]).includes(o.level)) return false;
      if (cycle !== "all" && o.cycleStatus !== cycle) return false;
      if (query.trim()) {
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        const matches = words.every((w) =>
          o.title.toLowerCase().includes(w) ||
          o.description.toLowerCase().includes(w) ||
          (o.institution ?? "").toLowerCase().includes(w) ||
          o.subjectAreas.some((s) => s.toLowerCase().includes(w)),
        );
        if (!matches) return false;
      }
      return true;
    });
    // Client-side sort layered onto the filtered list. "recommended" keeps
    // the server order (country, then title); the others re-order in place.
    if (sortBy === "deadline") {
      return [...list].sort((a, b) => {
        const ta = nextLiveDeadline(a.deadlines);
        const tb = nextLiveDeadline(b.deadlines);
        if (ta === null && tb === null) return 0;
        if (ta === null) return 1; // no live round sorts after every dated one
        if (tb === null) return -1;
        return ta - tb;
      });
    }
    if (sortBy === "title") return [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === "funding") return [...list].sort((a, b) => fundingRank(a) - fundingRank(b));
    return list;
  }, [data, country, level, cycle, query, sortBy]);

  const cycleLabel = (status: Opportunity["cycleStatus"]) =>
    t(
      status === "open" ? "explore.cycle.open" :
      status === "opens_later" ? "explore.cycle.opensLater" :
      status === "closed" ? "explore.cycle.closed" :
      status === "in_progress" ? "explore.cycle.inProgress" :
      status === "rolling" ? "explore.cycle.rolling" : "explore.cycle.unknown"
    );

  const cycleTone = (status: Opportunity["cycleStatus"]) =>
    status === "open" ? "border-leaf/50 bg-secondary text-secondary-foreground" :
    status === "closed" ? "border-muted bg-muted text-muted-foreground" :
    status === "in_progress" ? "border-sunflower/60 bg-accent text-accent-foreground" :
    "border-border bg-card text-muted-foreground";

  const levelLabel = (l: Opportunity["level"]) =>
    t(l === "bachelor" ? "explore.badge.bachelor" : l === "master" ? "explore.badge.master" : l === "phd" ? "explore.badge.phd" : "explore.badge.master_phd");

  // Sort option labels — new copy, bilingual inline (not in the catalogues).
  const sortLabels: Record<SortKey, string> = {
    recommended: lang === "bn" ? "সুপারিশকৃত: দেশ, তারপর শিরোনাম" : "Recommended: country, then title",
    deadline: lang === "bn" ? "ডেডলাইন: শীঘ্রতম আগে" : "Deadline: soonest first",
    title: lang === "bn" ? "শিরোনাম অক্ষরানুক্রমে" : "Title A–Z",
    funding: lang === "bn" ? "ফান্ডিং কভারেজ" : "Funding coverage",
  };

  const openDetail = (slug: string) => {
    navigate("detail", slug);
  };

  // Shortlist sync: guests keep it locally; signed-in users persist via API
  // with rollback — the UI never stays ahead of a failed server write.
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

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 font-display text-[26px] font-bold tracking-tight sm:text-3xl">
          <Compass className="h-6 w-6 text-leaf" aria-hidden="true" />
          {t("explore.title")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("explore.subtitle")}</p>
      </header>

      {/* Filters */}
      <section aria-label="Filters" className="mb-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          value={query}
          onChange={(e) => setExploreFilters({ query: e.target.value })}
          placeholder={t("explore.search")}
          className="bg-card lg:col-span-2"
          aria-label={t("explore.search")}
        />
        <Select value={country} onValueChange={(v) => setExploreFilters({ country: v })}>
          <SelectTrigger className="bg-card" aria-label={t("explore.filter.destination")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("explore.filter.destination")}: {t("common.all")}</SelectItem>
            <SelectItem value="US">United States</SelectItem>
            <SelectItem value="DE">Germany</SelectItem>
            <SelectItem value="JP">Japan</SelectItem>
            <SelectItem value="EU">Europe (Erasmus)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={level} onValueChange={(v) => setExploreFilters({ level: v })}>
          <SelectTrigger className="bg-card" aria-label={t("explore.filter.degree")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("explore.filter.degree")}: {t("common.all")}</SelectItem>
            <SelectItem value="bachelor">{levelLabel("bachelor")}</SelectItem>
            <SelectItem value="master">{levelLabel("master")}</SelectItem>
            <SelectItem value="phd">{levelLabel("phd")}</SelectItem>
            <SelectItem value="master_phd">{levelLabel("master_phd")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={cycle} onValueChange={(v) => setExploreFilters({ cycle: v })}>
          <SelectTrigger className="bg-card" aria-label={t("explore.filter.cycle")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("explore.filter.cycle")}: {t("common.all")}</SelectItem>
            <SelectItem value="open">{cycleLabel("open")}</SelectItem>
            <SelectItem value="in_progress">{cycleLabel("in_progress")}</SelectItem>
            <SelectItem value="opens_later">{cycleLabel("opens_later")}</SelectItem>
            <SelectItem value="closed">{cycleLabel("closed")}</SelectItem>
            <SelectItem value="rolling">{cycleLabel("rolling")}</SelectItem>
          </SelectContent>
        </Select>
      </section>

      {/* Destinations guide strip — real catalogue coverage, not a marketing
          list. A badge sets the country filter only when its code exists in
          the filter's option set; other codes render inert. */}
      {data && data.guides.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {lang === "bn" ? "গন্তব্য গাইড:" : "Destination guides:"}
          </span>
          {data.guides.map((g) => {
            const selectable = COUNTRY_FILTER_CODES.includes(g.code);
            const active = country === g.code;
            const name = lang === "bn" && g.nameBn ? g.nameBn : g.nameEn;
            return selectable ? (
              <Badge
                key={g.code}
                asChild
                variant="outline"
                className={cn(
                  "cursor-pointer bg-card",
                  active
                    ? "border-leaf/60 bg-secondary/70 text-secondary-foreground"
                    : "text-foreground/80 hover:border-leaf/50",
                )}
              >
                <button type="button" onClick={() => setExploreFilters({ country: g.code })} aria-pressed={active}>
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {name}
                </button>
              </Badge>
            ) : (
              <Badge key={g.code} variant="outline" className="bg-card text-muted-foreground">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {name}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Active filter chips + clear */}
      {(country !== "all" || level !== "all" || cycle !== "all" || query.trim()) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {query.trim() && (
            <button
              onClick={() => setExploreFilters({ query: "" })}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground/80 transition-colors hover:border-coral/60 hover:text-coral"
            >
              “{query.trim().slice(0, 24)}” ✕
              <span className="sr-only"> {t("explore.clearFilters")}</span>
            </button>
          )}
          {country !== "all" && (
            <button
              onClick={() => setExploreFilters({ country: "all" })}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground/80 transition-colors hover:border-coral/60 hover:text-coral"
            >
              {country === "US" ? "United States" : country === "DE" ? "Germany" : country === "JP" ? "Japan" : "Europe"} ✕
              <span className="sr-only"> {t("explore.clearFilters")}</span>
            </button>
          )}
          {level !== "all" && (
            <button
              onClick={() => setExploreFilters({ level: "all" })}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground/80 transition-colors hover:border-coral/60 hover:text-coral"
            >
              {levelLabel(level as Opportunity["level"])} ✕
              <span className="sr-only"> {t("explore.clearFilters")}</span>
            </button>
          )}
          {cycle !== "all" && (
            <button
              onClick={() => setExploreFilters({ cycle: "all" })}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground/80 transition-colors hover:border-coral/60 hover:text-coral"
            >
              {cycleLabel(cycle as Opportunity["cycleStatus"])} ✕
              <span className="sr-only"> {t("explore.clearFilters")}</span>
            </button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExploreFilters({ query: "", country: "all", level: "all", cycle: "all" })}
          >
            {t("explore.clearFilters")}
          </Button>
        </div>
      )}

      {/* Count only renders on settled data — never a confident zero while
          a request is pending or the service failed (that is not "0 results"). */}
      {!loading && !error && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="text-sm font-medium text-muted-foreground" role="status">
            {t("explore.results", { count: filtered.length })}
          </p>
          {/* Sort — client-side only, so deep links keep the default order. */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger size="sm" className="bg-card" aria-label={lang === "bn" ? "ফলাফল সাজান" : "Sort results"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recommended">{sortLabels.recommended}</SelectItem>
              <SelectItem value="deadline">{sortLabels.deadline}</SelectItem>
              <SelectItem value="title">{sortLabels.title}</SelectItem>
              <SelectItem value="funding">{sortLabels.funding}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Compare tray */}
      {compareSlugs.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-sunflower/50 bg-accent p-3">
          <Scale className="h-4 w-4 text-foreground/70" aria-hidden="true" />
          <span className="text-sm text-foreground/80">{t("explore.compareHint")}</span>
          <Button size="sm" className="ml-auto" onClick={() => navigate("compare")}>
            {t("compare.title")} ({compareSlugs.length})
          </Button>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : error ? (
        <Card className="border-destructive/40 bg-card">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="text-sm text-muted-foreground">{t("common.error")}</p>
            <Button variant="outline" size="sm" onClick={load}>{t("common.retry")}</Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="bg-card">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t("explore.noResults")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((o) => {
            const shortlisted = shortlist.includes(o.slug);
            const comparing = compareSlugs.includes(o.slug);
            // Next UPCOMING round — not the first array entry (that showed an
            // expired Early Action while a live Regular Action existed).
            const next = nextDeadlineDisplay(o.deadlines);
            // Compact money facts: documented values surfaced, unknowns
            // labelled unknown — same honesty rule as the detail worksheet.
            const tuition = o.costs.find((c) => c.kind === "tuition");
            const fee = o.costs.find((c) => c.kind === "fee");
            const fundingLevel =
              o.funding.length === 0 ? "none" :
              o.funding.some((f) => f.kind === "full_cost" || f.kind === "full_tuition") ? "full" : "partial";
            return (
              <Card key={o.slug} className="flex flex-col border-border/70 bg-card transition-shadow hover:shadow-sm">
                <CardContent className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="border-leaf/40 bg-secondary/70 text-secondary-foreground">
                      {levelLabel(o.level)}
                    </Badge>
                    <Badge variant="outline" className={cycleTone(o.cycleStatus)}>
                      {cycleLabel(o.cycleStatus)}
                    </Badge>
                    <Badge variant="outline" className="text-muted-foreground">
                      {t(o.kind === "funding_scheme" ? "explore.kind.scheme" : "explore.kind.programme")}
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">{o.countryLabel}</span>
                  </div>

                  <h2 className="text-base font-semibold leading-snug">{o.title}</h2>
                  <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{o.description}</p>

                  {/* Compact facts row — documented money facts up front;
                      unknowns stay labelled unknown instead of guessed. */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {tuition && tuition.amount !== undefined ? (
                      <span>
                        {lang === "bn" ? "টিউশন" : "Tuition"}: {tuition.currency} {tuition.amount.toLocaleString()}/{periodShortLabel(tuition.period, lang)}
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1"
                        title={lang === "bn" ? "অজানা থাকা সৎ — কখনো আন্দাজ করা হয় না" : "Unknown is honest — never guessed"}
                      >
                        {lang === "bn" ? "টিউশন: নথিভুক্ত নয়" : "Tuition: not documented"}
                        <CircleHelp className="h-3 w-3 text-muted-foreground/70" aria-hidden="true" />
                      </span>
                    )}
                    {fee &&
                      (fee.amount !== undefined ? (
                        <span>
                          {lang === "bn" ? "আবেদন ফি" : "Apply fee"}: {fee.currency} {fee.amount.toLocaleString()}
                        </span>
                      ) : (
                        <span>{lang === "bn" ? "আবেদন ফি: সোর্স দেখুন" : "Apply fee: see source"}</span>
                      ))}
                    <span>
                      {fundingLevel === "full"
                        ? lang === "bn" ? "সম্পূর্ণ ফান্ডিং নথিভুক্ত" : "Full funding documented"
                        : fundingLevel === "partial"
                          ? lang === "bn" ? "আংশিক ফান্ডিং" : "Partial funding"
                          : lang === "bn" ? "তালিকাভুক্ত ফান্ডিং নেই" : "No listed funding"}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {next?.event.closeDate
                        ? next.expired
                          ? t("explore.roundClosed", { date: deadlineLabel(next.event.precision, next.event.closeDate, lang) })
                          : deadlineLabel(next.event.precision, next.event.closeDate, lang)
                        : t("detail.unknownField")}
                    </span>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                    <Button size="sm" onClick={() => openDetail(o.slug)} className="gap-1.5">
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("common.viewDetails")}
                    </Button>
                    <Button
                      size="sm"
                      variant={shortlisted ? "secondary" : "outline"}
                      onClick={() => onToggleShortlist(o.slug)}
                      aria-pressed={shortlisted}
                      className="gap-1.5"
                    >
                      <Bookmark className={cn("h-3.5 w-3.5", shortlisted && "fill-current")} aria-hidden="true" />
                      {shortlisted ? t("explore.shortlisted") : t("explore.shortlist")}
                    </Button>
                    <Button
                      size="sm"
                      variant={comparing ? "secondary" : "outline"}
                      onClick={() => toggleCompare(o.slug)}
                      aria-pressed={comparing}
                      disabled={!comparing && compareSlugs.length >= 3}
                      title={compareSlugs.length >= 3 && !comparing ? t("explore.compareFull") : undefined}
                      className="gap-1.5"
                    >
                      <Scale className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("explore.compare")}
                    </Button>
                    {o.reviewState === "baseline_review" && (
                      <span className="ml-auto text-[11px] leading-tight text-muted-foreground/70">
                        {t("detail.retrieved")}: {o.retrievedAt}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
