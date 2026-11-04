"use client";

/**
 * Sources & coverage — methodology, freshness rules, the source registry,
 * and the honest error-report path.
 */
import { useEffect, useState } from "react";
import { useI18n, useCoverageLine } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookCheck, ExternalLink, ShieldQuestion } from "lucide-react";

interface Guide {
  code: string;
  nameEn: string;
  nameBn: string;
  contentEn: string;
  contentBn: string;
  sources: { key: string; url: string; title: string; publisher: string; retrievedAt: string }[];
}

export function SourcesView() {
  const { t, lang } = useI18n();
  const coverageBody = useCoverageLine("sources.coverageBody", "home.coverageZero");
  const [guides, setGuides] = useState<Guide[] | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/catalogue");
        const json = await res.json();
        if (json.ok) setGuides(json.data.guides);
      } catch {
        setGuides([]);
      }
    })();
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 font-display text-[26px] font-bold tracking-tight sm:text-3xl">
          <BookCheck className="h-6 w-6 text-leaf" aria-hidden="true" />
          {t("sources.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("sources.subtitle")}</p>
      </header>

      <div className="flex flex-col gap-5">
        <Card className="border-border/70 bg-card">
          <CardContent className="p-5">
            <h2 className="mb-2 text-base font-semibold tracking-tight">{t("sources.methodTitle")}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("sources.methodBody")}</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card">
          <CardContent className="p-5">
            <h2 className="mb-2 text-base font-semibold tracking-tight">{t("sources.coverageTitle")}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{coverageBody}</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card">
          <CardContent className="p-5">
            <h2 className="mb-2 text-base font-semibold tracking-tight">{t("sources.freshnessTitle")}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("sources.freshnessBody")}</p>
          </CardContent>
        </Card>

        <Card className="border-coral/40 bg-accent">
          <CardContent className="p-5">
            <h2 className="mb-2 flex items-center gap-1.5 text-base font-semibold tracking-tight">
              <ShieldQuestion className="h-4 w-4 text-coral" aria-hidden="true" />
              {t("sources.reportTitle")}
            </h2>
            <p className="mb-3 text-sm leading-relaxed text-foreground/75">{t("sources.reportBody")}</p>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a
                href="https://github.com/Shamimhasan8/Study-Abroad/issues"
                target="_blank"
                rel="noopener noreferrer"
              >
                {lang === "bn" ? "ইস্যু খুলুন" : "Open an issue"}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Country guides */}
        <section aria-labelledby="guides-title">
          <h2 id="guides-title" className="mb-3 text-lg font-semibold tracking-tight">
            {lang === "bn" ? "দেশভিত্তিক গাইড" : "Country guides"}
          </h2>
          {!guides ? (
            <Skeleton className="h-32 rounded-xl" />
          ) : (
            <Accordion type="single" collapsible className="rounded-xl border border-border/70 bg-card px-4">
              {guides.map((guide) => (
                <AccordionItem key={guide.code} value={guide.code}>
                  <AccordionTrigger className="text-base font-semibold">
                    {lang === "bn" ? guide.nameBn : guide.nameEn}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {(lang === "bn" ? guide.contentBn : guide.contentEn).replace(/\*\*/g, "")}
                    </div>
                    <ul className="mt-4 flex flex-col gap-2">
                      {guide.sources.map((s) => (
                        <li key={s.key} className="text-xs">
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium underline decoration-leaf/40 underline-offset-4 hover:decoration-leaf"
                          >
                            {s.title} <ExternalLink className="inline h-3 w-3" aria-hidden="true" />
                          </a>
                          <span className="ml-1 text-muted-foreground">({s.publisher})</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </section>

        {/* Registry link */}
        <Card className="border-border/70 bg-card">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <p className="text-sm text-muted-foreground">{t("sources.viewRegistry")}</p>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a
                href="https://github.com/Shamimhasan8/Study-Abroad/blob/main/docs/SOURCE_REGISTRY.md"
                target="_blank"
                rel="noopener noreferrer"
              >
                docs/SOURCE_REGISTRY.md
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </Button>
          </CardContent>
        </Card>

        <Badge variant="outline" className="self-start text-muted-foreground">
          {t("sources.outsideCoverage")}: {lang === "bn" ? "রাশিয়া-নির্দিষ্ট পথ, ভিসা নীতি, UK/কানাডা/অস্ট্রেলিয়া গাইড" : "Russia-specific routes, visa policy, UK/Canada/Australia guides"}
        </Badge>
      </div>
    </main>
  );
}
