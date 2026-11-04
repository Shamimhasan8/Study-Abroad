"use client";

/**
 * Compare — up to three opportunities with equivalent fields and visible
 * unknowns (em dash), per the product contract.
 */
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Scale, X, ExternalLink } from "lucide-react";
import { deadlineLabel } from "@/lib/dates";
import { formatForeign } from "@/lib/money";
import type { Opportunity } from "@/lib/types";

export function CompareView() {
  const { t, lang } = useI18n();
  const { compareSlugs, toggleCompare, clearCompare, navigate } = useAppStore();
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (compareSlugs.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      const results = await Promise.all(
        compareSlugs.map(async (slug) => {
          try {
            const res = await fetch(`/api/catalogue/${slug}`);
            const json = await res.json();
            return json.ok ? (json.data.opportunity as Opportunity) : null;
          } catch {
            return null;
          }
        }),
      );
      setItems(results.filter((o): o is Opportunity => o !== null));
      setLoading(false);
    })();
  }, [compareSlugs]);

  const dash = t("compare.unknown");

  const row = (label: string, render: (o: Opportunity) => React.ReactNode) => (
    <tr className="border-t border-border/70">
      <th scope="row" className="p-3 text-left text-xs font-semibold text-muted-foreground align-top">
        {label}
      </th>
      {items.map((o) => (
        <td key={o.slug} className="p-3 text-sm align-top">
          {render(o)}
        </td>
      ))}
    </tr>
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Scale className="h-6 w-6 text-leaf" aria-hidden="true" />
          {t("compare.title")}
        </h1>
        {items.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearCompare}>
            {t("explore.clearFilters")}
          </Button>
        )}
      </header>

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : items.length === 0 ? (
        <Card className="bg-card">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">{t("compare.empty")}</p>
            <Button className="mt-4" onClick={() => navigate("explore")}>{t("nav.explore")}</Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-x-auto border-border/70 bg-card">
          <CardContent className="p-0">
            <table className="w-full min-w-[560px] border-collapse">
              <caption className="sr-only">{t("compare.title")}</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-36 p-3 text-left text-xs font-semibold text-muted-foreground">
                    {t("compare.title")}
                  </th>
                  {items.map((o) => (
                    <th key={o.slug} scope="col" className="p-3 text-left align-top">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-snug">{o.title}</p>
                          <p className="mt-0.5 text-xs font-normal text-muted-foreground">{o.countryLabel}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => toggleCompare(o.slug)}
                          aria-label={t("compare.remove")}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {row(t("explore.filter.degree"), (o) => t(
                  o.level === "bachelor" ? "explore.badge.bachelor" :
                  o.level === "master" ? "explore.badge.master" :
                  o.level === "phd" ? "explore.badge.phd" : "explore.badge.master_phd"
                ))}
                {row(t("explore.kind.scheme") + "/" + t("explore.kind.programme"), (o) =>
                  t(o.kind === "funding_scheme" ? "explore.kind.scheme" : "explore.kind.programme")
                )}
                {row(t("detail.funding"), (o) => (
                  <div className="flex flex-col gap-1">
                    <span>{o.fundingType}</span>
                    {o.funding.map((f) => (
                      <span key={f.id} className="text-xs text-muted-foreground">
                        {f.label}
                        {f.amount !== undefined ? ` (${formatForeign(f.amount, f.currency)}/${f.period === "monthly" ? (lang === "bn" ? "মাস" : "mo") : f.period === "annual" ? (lang === "bn" ? "বছর" : "yr") : f.period})` : ""}
                        {!f.guaranteed ? " ⚠" : ""}
                      </span>
                    ))}
                    {o.funding.length === 0 && <span className="text-xs text-muted-foreground">{dash}</span>}
                  </div>
                ))}
                {row(t("detail.dates"), (o) => {
                  const close = o.deadlines.find((d) => d.closeDate);
                  return (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">{o.deadlineNote.split(".")[0]}.</span>
                      {close?.closeDate && (
                        <Badge variant="outline" className={close.official ? "border-leaf/50 bg-secondary" : "text-muted-foreground"}>
                          {deadlineLabel(close.precision, close.closeDate, lang)}
                        </Badge>
                      )}
                      {!close && <span className="text-xs text-muted-foreground">{dash}</span>}
                    </div>
                  );
                })}
                {row(t("detail.requirements"), (o) => (
                  <ul className="list-disc pl-4 text-xs text-muted-foreground">
                    {o.requirements.slice(0, 4).map((r) => (
                      <li key={r.id}>{lang === "bn" && r.titleBn ? r.titleBn : r.title}</li>
                    ))}
                  </ul>
                ))}
                {row(t("funding.costs"), (o) => (
                  <ul className="flex flex-col gap-1 text-xs">
                    {o.costs.map((c) => (
                      <li key={c.id}>
                        {c.label}:{" "}
                        {c.amount !== undefined ? `${formatForeign(c.amount, c.currency)} ${c.period}` : dash}
                        {c.estimate ? " ~" : ""}
                      </li>
                    ))}
                    {o.costs.length === 0 && <li className="text-muted-foreground">{dash}</li>}
                  </ul>
                ))}
                {row(t("detail.reviewState"), (o) => (
                  <Badge variant="outline" className="text-muted-foreground">{o.reviewState}</Badge>
                ))}
                {row("", (o) => (
                  <Button size="sm" variant="outline" onClick={() => navigate("detail", o.slug)}>
                    {t("common.viewDetails")}
                  </Button>
                ))}
                {row(t("detail.apply"), (o) => (
                  <a
                    href={o.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-leaf underline underline-offset-4"
                  >
                    {t("detail.apply")} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
