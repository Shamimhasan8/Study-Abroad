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
import { Compass, Bookmark, Scale, Eye } from "lucide-react";
import { deadlineLabel } from "@/lib/dates";
import type { Opportunity } from "@/lib/types";
import { cn } from "@/lib/utils";

type CatalogueResponse = {
  opportunities: Opportunity[];
  guides: { code: string; nameEn: string; nameBn: string }[];
};

export function ExploreView() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { navigate, shortlist, toggleShortlist, compareSlugs, toggleCompare, profile, user } = useAppStore();
  const { query, country, level, cycle } = useAppStore((s) => s.exploreFilters);
  const setExploreFilters = useAppStore((s) => s.setExploreFilters);

  const [data, setData] = useState<CatalogueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Pre-fill the destination filter once from onboarding preferences.
  // Degree level is NOT pre-filled: exact-level filtering would hide
  // combined master/PhD records from master's-seekers.
  useEffect(() => {
    if (profile?.countryPrefs?.length) {
      if (useAppStore.getState().exploreFilters.country === "all") {
        setExploreFilters({ country: profile.countryPrefs[0] });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return data.opportunities.filter((o) => {
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
  }, [data, country, level, cycle, query]);

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
        <p className="mb-4 text-sm font-medium text-muted-foreground" role="status">
          {t("explore.results", { count: filtered.length })}
        </p>
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
            const close = o.deadlines.find((d) => d.closeDate);
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

                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {close?.closeDate ? deadlineLabel(close.precision, close.closeDate, lang) : t("detail.unknownField")}
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
