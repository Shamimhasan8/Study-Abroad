"use client";

/** Home view — one-sentence outcome, dual CTAs, honest coverage. */
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  StudentReading,
  BookStack,
  MilestonePath,
  LandscapeScene,
} from "./illustrations";
import { Compass, Route } from "lucide-react";

export function HomeView() {
  const { t } = useI18n();
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

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      {/* Hero */}
      <section className="grid items-center gap-8 md:grid-cols-2" aria-labelledby="hero-title">
        <div className="uraan-fade-up">
          <h1 id="hero-title" className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {t("home.heroTitle")}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            {t("home.heroSubtitle")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              size="lg"
              onClick={() => navigate(hasProgress ? "journey" : "onboarding")}
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
        <div className="hidden justify-center md:flex" aria-hidden="true">
          <LandscapeScene width={340} height={150} className="uraan-bob" />
        </div>
      </section>

      {/* Coverage note */}
      <section aria-label={t("sources.coverageTitle")} className="mt-8">
        <Badge variant="outline" className="max-w-full whitespace-normal break-words border-leaf/40 bg-accent px-3 py-1.5 text-xs font-normal leading-relaxed text-foreground/80">
          {t("home.coverageNote")}
        </Badge>
      </section>

      {/* How it works */}
      <section className="mt-12" aria-labelledby="how-title">
        <h2 id="how-title" className="text-2xl font-semibold tracking-tight">
          {t("home.howTitle")}
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Illustration, title, body }, idx) => (
            <Card key={title} className="border-border/70 bg-card">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <Illustration width={idx === 0 ? 130 : 110} height={idx === 0 ? 112 : 96} aria-hidden="true" />
                  <span className="text-3xl font-bold text-leaf/25" aria-hidden="true">
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
      <section className="mt-10 flex justify-center" aria-hidden="true">
        <MilestonePath width={280} height={118} />
      </section>
    </main>
  );
}
