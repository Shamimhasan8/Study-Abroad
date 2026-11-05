"use client";

/**
 * Home view — Checkpoint 1 of the 06 implementation prompt.
 *
 * A visibly redesigned homepage: warm editorial hero built around a dominant
 * campus illustration, a degree selector that steers both the illustrative
 * preview and the onboarding route, a real search entry into Explore, honest
 * coverage/save information, degree-specific starting routes, an honest
 * journey example, and how-it-works — each section animated through the
 * shared motion system with reduced-motion equivalents.
 */
import { useState, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useI18n, useCoverageLine } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeroVisual } from "./hero-visual";
import { HomeDemo } from "./home-demo";
import { HomeOpportunities } from "./home-opportunities";
import { HomeFunding } from "./home-funding";
import { HomeMentor } from "./home-mentor";
import { HomeFaqCta } from "./home-faq-cta";
import { FirstVisitTour } from "./first-visit-tour";
import {
  StudentReading,
  BookStack,
  MilestonePath,
} from "./illustrations";
import { sectionEntrance, staggerList, listItem, EASE } from "./motion";
import type { DegreeLevel } from "@/lib/types";
import {
  Compass,
  Route,
  GraduationCap,
  BookmarkCheck,
  CircleCheck,
  Search,
  ShieldCheck,
  Plane,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DEGREES: Exclude<DegreeLevel, "undecided">[] = ["bachelor", "master", "phd"];

export function HomeView() {
  const { t, lang } = useI18n();
  const coverageNote = useCoverageLine("home.coverageNote", "home.coverageZero");
  const { navigate, profile, plan, patchProfile, setExploreFilters, capabilities } = useAppStore();
  const prefersReduced = useReducedMotion();
  const reduceMotion = useAppStore((s) => s.reduceMotion) || !!prefersReduced;

  const hasProgress = Boolean(profile?.onboardingCompleted || plan);
  // Capabilities unknown (probe pending/failed) → conservative copy; known
  // unavailable → the honest “still being set up” sentence.
  const syncKnown = capabilities != null;
  const accountSyncOff = capabilities?.accountSync.available === false;
  const [degree, setDegree] = useState<Exclude<DegreeLevel, "undecided"> | "undecided">(
    profile?.degreeLevel && profile.degreeLevel !== "undecided" ? profile.degreeLevel : "undecided",
  );
  const [search, setSearch] = useState("");

  /** Start onboarding with the chosen degree pre-selected (new visitors only:
   * returning users resume their saved profile instead — a homepage card must
   * never silently rewrite a completed profile). */
  const startPlan = () => {
    if (!hasProgress && degree !== "undecided") patchProfile({ degreeLevel: degree });
    navigate(hasProgress ? "workspace" : "onboarding");
  };

  /** Real search entry: the query + chosen degree level land in the Explore
   * filters, so results are actually filtered — never a decorative box. */
  const runSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const q = search.trim();
    if (!q && degree === "undecided") {
      navigate("explore");
      return;
    }
    setExploreFilters({
      ...(q ? { query: q } : {}),
      ...(degree !== "undecided" ? { level: degree } : {}),
    });
    navigate("explore");
  };

  const onDegreeKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (degree === "undecided" && (event.key === "ArrowRight" || event.key === "ArrowDown")) {
      event.preventDefault();
      setDegree("bachelor");
      return;
    }
    const idx = DEGREES.indexOf(degree as Exclude<DegreeLevel, "undecided">);
    if (idx === -1) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setDegree(DEGREES[(idx + 1) % DEGREES.length]);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setDegree(DEGREES[(idx - 1 + DEGREES.length) % DEGREES.length]);
    }
  };

  const steps = [
    { icon: StudentReading, title: t("home.step1Title"), body: t("home.step1Body") },
    { icon: BookStack, title: t("home.step2Title"), body: t("home.step2Body") },
    { icon: Route, title: t("home.step3Title"), body: t("home.step3Body") },
  ];

  const degreePaths = [
    { level: "bachelor" as const, icon: GraduationCap },
    { level: "master" as const, icon: BookmarkCheck },
    { level: "phd" as const, icon: CircleCheck },
  ];

  const enter = sectionEntrance(reduceMotion);
  const list = staggerList(reduceMotion);
  const item = listItem(reduceMotion);

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 sm:px-6 sm:py-12">
      {/* ===================== Hero ===================== */}
      <section
        className="grid items-center gap-10 lg:grid-cols-[11fr_9fr] lg:gap-12"
        aria-labelledby="hero-title"
      >
        <motion.div variants={enter} initial="hidden" animate="visible">
          <p className="inline-flex items-center gap-2 rounded-full border border-leaf/25 bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-leaf">
            <Plane className="h-3.5 w-3.5" aria-hidden="true" />
            {t("home.heroEyebrow")}
          </p>
          <h1
            id="hero-title"
            className="mt-4 font-display text-[34px] font-bold leading-[1.12] tracking-tight sm:text-5xl lg:text-[54px]"
          >
            {t("home.heroTitle")}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("home.heroSubtitle")}
          </p>

          <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
            <Button size="lg" id="hero-primary-cta" onClick={startPlan} className="gap-2">
              <Compass className="h-4 w-4" aria-hidden="true" />
              {hasProgress ? t("home.ctaResume") : t("home.ctaPrimary")}
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("explore")}>
              {t("home.ctaSecondary")}
            </Button>
          </div>

          {hasProgress ? (
            <p className="mt-4 text-sm text-muted-foreground">{t("home.resumeHint")}</p>
          ) : (
            /* Degree selector — steers the illustrative preview AND the
               onboarding route; isolated from saved data until CTA. */
            <div className="mt-6">
              <p id="degree-group-label" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("home.degreeLabel")}
              </p>
              <div
                role="radiogroup"
                aria-labelledby="degree-group-label"
                onKeyDown={onDegreeKey}
                className="mt-2 grid w-full max-w-md grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1 sm:inline-flex sm:max-w-none"
              >
                {DEGREES.map((level) => {
                  const selected = degree === level;
                  return (
                    <button
                      key={level}
                      role="radio"
                      aria-checked={selected}
                      tabIndex={selected ? 0 : degree === "undecided" && level === "bachelor" ? 0 : -1}
                      onClick={() => setDegree(level)}
                      className={cn(
                        "rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:px-3.5 sm:text-sm",
                        "hover:bg-secondary focus-visible:bg-secondary",
                        selected ? "bg-primary text-primary-foreground hover:bg-primary" : "text-foreground/80",
                      )}
                    >
                      {t(
                        level === "bachelor"
                          ? "onboarding.degree.bachelor"
                          : level === "master"
                            ? "onboarding.degree.master"
                            : "onboarding.degree.phd",
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search by subject / destination — opens real filtered results */}
          <form onSubmit={runSearch} className="mt-5 flex max-w-xl gap-2" role="search" aria-label={t("home.searchLabel")}>
            <label htmlFor="home-search" className="sr-only">
              {t("home.searchLabel")}
            </label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                id="home-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("home.searchPlaceholder")}
                className="h-11 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm shadow-none outline-none transition-colors placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
              />
            </div>
            <Button type="submit" variant="secondary" className="h-11 px-4 font-semibold">
              {t("home.searchCta")}
            </Button>
          </form>

          {/* Honest coverage + save information */}
          <div className="mt-5 flex flex-col gap-2">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf" aria-hidden="true" />
              <span>
                {syncKnown && accountSyncOff ? t("home.saveInfoSyncOff") : t("home.saveInfoGuest")}
              </span>
            </p>
            <Badge variant="outline" className="w-fit max-w-full whitespace-normal break-words border-leaf/40 bg-secondary px-3 py-1.5 text-xs font-normal leading-relaxed text-foreground/80">
              {coverageNote}
            </Badge>
          </div>
        </motion.div>

        {/* Dominant visual + preparation preview */}
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.32, ease: EASE, delay: 0.08 }}
          className="lg:justify-self-end"
        >
          <HeroVisual
            exampleDegree={(degree === "undecided" ? "master" : degree) as Exclude<DegreeLevel, "undecided">}
          />
        </motion.div>
      </section>

      {/* ===================== Degree-path choices ===================== */}
      <motion.section
        className="mt-14 sm:mt-16"
        aria-labelledby="paths-title"
        variants={enter}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
      >
        <h2 id="paths-title" className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">
          {t("home.pathsTitle")}
        </h2>
        <motion.div variants={list} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} className="mt-5 grid gap-4 sm:grid-cols-3">
          {degreePaths.map(({ level, icon: Icon }) => (
            <motion.button
              key={level}
              variants={item}
              onClick={() => {
                if (!hasProgress) {
                  patchProfile({ degreeLevel: level });
                  navigate("onboarding");
                } else {
                  // Returning users: filter Explore by this level instead of
                  // silently rewriting a completed profile.
                  setExploreFilters({ level });
                  navigate("explore");
                }
              }}
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
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(`home.pathsBody.${level}`)}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-leaf">
                {t("home.pathsCta")}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </motion.button>
          ))}
        </motion.div>
      </motion.section>

      {/* ===================== Requirement → task → evidence (interactive) ===================== */}
      <HomeDemo />

      {/* ===================== Supported opportunities (live) ===================== */}
      <HomeOpportunities />

      {/* ===================== Funding explainer ===================== */}
      <HomeFunding />

      {/* ===================== Mentor preview ===================== */}
      <HomeMentor />

      {/* ===================== FAQ + final CTA ===================== */}
      <HomeFaqCta />

      {/* ===================== How it works ===================== */}
      <motion.section
        className="mt-14"
        aria-labelledby="how-title"
        variants={enter}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
      >
        <h2 id="how-title" className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">
          {t("home.howTitle")}
        </h2>
        <motion.div variants={list} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Illustration, title, body }, idx) => (
            <motion.div key={title} variants={item}>
              <Card className="h-full border-border/70 bg-card">
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
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* ===================== Milestone strip ===================== */}
      <section className="mt-12 flex justify-center" aria-hidden="true">
        <MilestonePath width={280} height={118} />
      </section>

      {/* Optional first-visit tour — never restarts uninvited */}
      <FirstVisitTour />
    </main>
  );
}
