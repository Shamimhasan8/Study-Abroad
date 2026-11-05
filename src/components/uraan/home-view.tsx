"use client";

/**
 * Home view — one strong outcome headline, a composed hero illustration,
 * an honestly-labelled journey example, degree-path choices, live coverage,
 * and how the preparation process works.
 */
import { useI18n, useCoverageLine } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  HeroScene,
  StudentReading,
  BookStack,
  MilestonePath,
} from "./illustrations";
import { Compass, Route, GraduationCap, BookmarkCheck, CircleCheck } from "lucide-react";

export function HomeView() {
  const { t, lang } = useI18n();
  const coverageNote = useCoverageLine("home.coverageNote", "home.coverageZero");
  const { navigate, profile, plan } = useAppStore();

  const hasProgress = Boolean(profile?.onboardingCompleted || plan);

  const steps = [
    {
      icon: StudentReading,
      title: t("home.step1Title"),
      body: t("home.step1Body"),
    },
    {
      icon: BookStack,
      title: t("home.step2Title"),
      body: t("home.step2Body"),
    },
    {
      icon: Route,
      title: t("home.step3Title"),
      body: t("home.step3Body"),
    },
  ];

  const degreePaths = [
    { level: "bachelor" as const, icon: GraduationCap },
    { level: "master" as const, icon: BookmarkCheck },
    { level: "phd" as const, icon: CircleCheck },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      {/* Hero — display typography + composed illustration */}
      <section className="grid items-center gap-10 lg:grid-cols-[7fr_5fr]" aria-labelledby="hero-title">
        <div className="uraan-fade-up">
          <h1
            id="hero-title"
            className="font-display text-[34px] font-bold leading-[1.12] tracking-tight sm:text-5xl lg:text-[56px]"
          >
            {t("home.heroTitle")}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("home.heroSubtitle")}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              size="lg"
              onClick={() => navigate(hasProgress ? "workspace" : "onboarding")}
              className="gap-2"
            >
              <Compass className="h-4 w-4" aria-hidden="true" />
              {hasProgress ? t("nav.journey") : t("home.ctaPrimary")}
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("explore")}>
              {t("home.ctaSecondary")}
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{t("home.guestStart")}</p>
        </div>
        <div className="flex justify-center lg:justify-end" aria-hidden="true">
          <HeroScene width={520} height={390} className="h-auto w-full max-w-[520px]" />
        </div>
      </section>

      {/* Coverage note — derived from live data */}
      <section aria-label={t("sources.coverageTitle")} className="mt-10">
        <Badge variant="outline" className="max-w-full whitespace-normal break-words border-leaf/40 bg-secondary px-3 py-1.5 text-xs font-normal leading-relaxed text-foreground/80">
          {coverageNote}
        </Badge>
      </section>

      {/* Journey example — honest, clearly labelled, no invented students */}
      <section className="mt-12" aria-labelledby="example-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="example-title" className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">
            {t("home.exampleTitle")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("home.exampleLabel")}</p>
        </div>
        <Card className="mt-5 border-border bg-card">
          <CardContent className="p-5 sm:p-6">
            <ol className="grid gap-4 sm:grid-cols-3">
              {([
                { title: t("home.exampleStep1Title"), body: t("home.exampleStep1Body") },
                { title: t("home.exampleStep2Title"), body: t("home.exampleStep2Body") },
                { title: t("home.exampleStep3Title"), body: t("home.exampleStep3Body") },
              ]).map((step, n) => (
                <li key={n} className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-leaf" aria-hidden="true">
                    {n + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold leading-snug">{step.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 border-t border-border/70 pt-4 text-xs leading-relaxed text-muted-foreground">
              {t("home.exampleNote")}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Degree-path choices */}
      <section className="mt-12" aria-labelledby="paths-title">
        <h2 id="paths-title" className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">
          {t("home.pathsTitle")}
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {degreePaths.map(({ level, icon: Icon }) => (
            <button
              key={level}
              onClick={() => navigate("onboarding")}
              className="group rounded-xl border border-border bg-card p-5 text-left shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:border-leaf/50 hover:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-leaf transition-colors group-hover:bg-leaf group-hover:text-white">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-base font-semibold">
                  {t(level === "bachelor" ? "onboarding.degree.bachelor" : level === "master" ? "onboarding.degree.master" : "onboarding.degree.phd")}
                </h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t(`home.pathsBody.${level}`)}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-leaf">
                {t("home.pathsCta")}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mt-14" aria-labelledby="how-title">
        <h2 id="how-title" className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">
          {t("home.howTitle")}
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Illustration, title, body }, idx) => (
            <Card key={title} className="border-border/70 bg-card">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <Illustration width={idx === 0 ? 130 : 110} height={idx === 0 ? 112 : 96} aria-hidden="true" />
                  <span className="font-display text-3xl font-bold text-leaf/25" aria-hidden="true">
                    {idx + 1}
                  </span>
                </div>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Milestone strip */}
      <section className="mt-12 flex justify-center" aria-hidden="true">
        <MilestonePath width={280} height={118} />
      </section>
    </main>
  );
}
