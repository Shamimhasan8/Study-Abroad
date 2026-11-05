"use client";

/**
 * Supported-opportunities preview (implementation prompt §6.4).
 *
 * A few REAL opportunities from the live catalogue (/api/catalogue), each
 * shown with relevant facts — level, country, funding type, deadline note —
 * and honest unknowns (unverified costs stay visibly unknown). Cards link
 * into the real detail view; a footer link opens Explore with the full
 * count. Loading, failure (with retry), and genuine zero each render their
 * own honest state — never a fake list.
 */
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useI18n, localizeDigits } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { sectionEntrance, staggerList, listItem } from "./motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Opportunity } from "@/lib/types";
import { ArrowRight, CircleHelp, Landmark, CalendarDays, Compass } from "lucide-react";

type LoadState = "loading" | "ok" | "error";

/** Stable, interesting mix: one per covered country (US/DE/JP order), then fill. */
function pickPreview(opportunities: Opportunity[], count: number): Opportunity[] {
  if (opportunities.length <= count) return opportunities;
  const byCountry = new Map<string, Opportunity>();
  for (const o of opportunities) {
    if (!byCountry.has(o.country) && byCountry.size < count) byCountry.set(o.country, o);
  }
  const picked = [...byCountry.values()];
  for (const o of opportunities) {
    if (picked.length >= count) break;
    if (!picked.includes(o)) picked.push(o);
  }
  return picked.slice(0, count);
}

export function HomeOpportunities() {
  const { t, lang } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const prefersReduced = useReducedMotion();
  const reduceMotion = useAppStore((s) => s.reduceMotion) || !!prefersReduced;
  const [state, setState] = useState<LoadState>("loading");
  const [items, setItems] = useState<Opportunity[]>([]);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/catalogue");
        const json = await res.json();
        if (cancelled) return;
        if (res.ok && json?.ok) {
          const all: Opportunity[] = Array.isArray(json.data?.opportunities) ? json.data.opportunities : [];
          setItems(all);
          setTotal(all.length);
          setState("ok");
        } else {
          setState("error");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const enter = sectionEntrance(reduceMotion);
  const list = staggerList(reduceMotion);
  const item = listItem(reduceMotion);

  const cycleLabel = (status: Opportunity["cycleStatus"]) =>
    status === "open"
      ? t("explore.cycle.open")
      : status === "opens_later"
        ? t("explore.cycle.opensLater")
        : status === "closed"
          ? t("explore.cycle.closed")
          : status === "in_progress"
            ? t("explore.cycle.inProgress")
            : status === "rolling"
              ? t("explore.cycle.rolling")
              : t("explore.cycle.unknown");

  const levelLabel = (level: Opportunity["level"]) =>
    level === "master_phd"
      ? t("home.oppLevel.master_phd")
      : t(
          level === "bachelor"
            ? "onboarding.degree.bachelor"
            : level === "master"
              ? "onboarding.degree.master"
              : "onboarding.degree.phd",
        );

  return (
    <section className="mt-14" aria-labelledby="opp-title">
      <motion.div variants={enter} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="opp-title" className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">
            {t("home.oppTitle")}
          </h2>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleHelp className="h-3.5 w-3.5 text-leaf" aria-hidden="true" />
            {t("home.oppLabel")}
          </p>
        </div>
      </motion.div>

      {state === "loading" && (
        <div className="mt-5 grid gap-4 sm:grid-cols-3" aria-busy="true" aria-label={t("home.oppLoading")}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-3 h-5 w-full max-w-[240px]" />
              <Skeleton className="mt-2 h-4 w-32" />
              <Skeleton className="mt-4 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {state === "error" && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-6 text-center" role="alert">
          <p className="text-sm text-muted-foreground">{t("home.oppUnavailable")}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => { setState("loading"); setReloadKey((k) => k + 1); }}>
            {t("home.oppRetry")}
          </Button>
        </div>
      )}

      {state === "ok" && items.length === 0 && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">{t("home.oppEmpty")}</p>
        </div>
      )}

      {state === "ok" && items.length > 0 && (
        <>
          <motion.div
            variants={list}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="mt-5 grid gap-4 sm:grid-cols-3"
          >
            {pickPreview(items, 3).map((o) => {
              const hasUnknownCosts = o.costs.some((c) => c.amount === undefined);
              return (
                <motion.article
                  key={o.slug}
                  variants={item}
                  className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-leaf/50 hover:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                      {levelLabel(o.level)}
                    </span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {o.countryLabel}
                    </span>
                  </div>
                  <h3 className="mt-2.5 text-sm font-semibold leading-snug">{lang === "bn" && o.titleBn ? o.titleBn : o.title}</h3>

                  <dl className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-start gap-1.5">
                      <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-leaf" aria-hidden="true" />
                      <div>
                        <dt className="sr-only">{t("home.oppFunding")}</dt>
                        <dd>{o.fundingType}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-leaf" aria-hidden="true" />
                      <div>
                        <dt className="sr-only">{t("home.oppDeadline")}</dt>
                        <dd>
                          <span className="font-medium text-foreground/80">{cycleLabel(o.cycleStatus)}.</span> {o.deadlineNote}
                        </dd>
                      </div>
                    </div>
                  </dl>

                  {hasUnknownCosts && (
                    <p className="mt-2.5 inline-flex items-start gap-1.5 rounded-lg bg-muted px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      <CircleHelp className="mt-0.5 h-3 w-3 shrink-0 text-coral" aria-hidden="true" />
                      {t("home.oppUnknownCosts")}
                    </p>
                  )}

                  <button
                    onClick={() => navigate("detail", o.slug)}
                    className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-leaf focus-visible:outline-2"
                  >
                    {t("home.oppViewDetails")}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </button>
                </motion.article>
              );
            })}
          </motion.div>

          <div className="mt-5 text-center">
            <Button variant="outline" onClick={() => navigate("explore")} className="gap-1.5">
              <Compass className="h-4 w-4" aria-hidden="true" />
              {t("home.oppBrowseAll", { count: localizeDigits(total, lang) })}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
