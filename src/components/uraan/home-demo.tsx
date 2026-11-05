"use client";

/**
 * Requirement → task → evidence demonstration (implementation prompt §6.3).
 *
 * An interactive four-step walkthrough of the product's core loop, built on
 * a REAL documented requirement (MIT first-year admission/testing policy,
 * verified 2026-11-04 in the catalogue seeds). Radix Tabs give the stepper
 * full keyboard operability; each panel animates through the shared motion
 * system with a reduced-motion equivalent. The walkthrough is read-only —
 * it never touches saved state; the CTA starts the user's own journey.
 */
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { contentSwap, EASE, DUR_STEP } from "./motion";
import {
  ScrollText,
  CircleHelp,
  CalendarClock,
  FolderCheck,
  ArrowRight,
  Lock,
  BadgeCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { value: "requirement", key: "home.demoTab1", icon: ScrollText },
  { value: "gap", key: "home.demoTab2", icon: CircleHelp },
  { value: "task", key: "home.demoTab3", icon: CalendarClock },
  { value: "evidence", key: "home.demoTab4", icon: FolderCheck },
] as const;

/** Small labelled fact chip used across the panels. */
function Meta({ icon: Icon, children }: { icon: typeof Lock; children: React.ReactNode }) {
  return (
    <p className="mt-3 inline-flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-leaf" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function HomeDemo() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const profileDone = useAppStore((s) => Boolean(s.profile?.onboardingCompleted));
  const hasPlan = useAppStore((s) => Boolean(s.plan));
  const hasProgress = profileDone || hasPlan;
  const prefersReduced = useReducedMotion();
  const reduceMotion = useAppStore((s) => s.reduceMotion) || !!prefersReduced;
  const [step, setStep] = useState(0);
  const swap = contentSwap(reduceMotion);

  const panel = (title: string, body: string, children?: React.ReactNode) => (
    <div>
      <h3 className="font-display text-lg font-semibold tracking-tight sm:text-xl">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/85 sm:text-base">{body}</p>
      {children}
    </div>
  );

  return (
    <section aria-labelledby="demo-title" className="mt-14">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="demo-title" className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">
          {t("home.demoTitle")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("home.demoLabel")}</p>
      </div>

      <Tabs value={STEPS[step].value} onValueChange={(v) => setStep(STEPS.findIndex((s) => s.value === v))} className="mt-5">
        <TabsList
          aria-label={t("home.demoTitle")}
          className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1 sm:grid-cols-4"
        >
          {STEPS.map(({ value, key, icon: Icon }, idx) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                "gap-2 rounded-lg px-3 py-2.5 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:text-sm",
                idx < step && "text-leaf",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  idx < step ? "bg-leaf/15 text-leaf" : "bg-secondary",
                )}
              >
                {idx < step ? <BadgeCheck className="h-3.5 w-3.5" /> : idx + 1}
              </span>
              <span className="hidden items-center gap-1.5 sm:inline-flex">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {t(key)}
              </span>
              <span className="sm:hidden">{t(key)}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="relative mt-4 min-h-[210px] rounded-2xl border border-border bg-card p-5 sm:p-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} variants={swap} initial="hidden" animate="visible" exit="exit">
              {step === 0 &&
                panel(t("home.demoReqTitle"), t("home.demoReqBody"), <Meta icon={ScrollText}>{t("home.demoReqSource")}</Meta>)}
              {step === 1 &&
                panel(
                  t("home.demoGapTitle"),
                  t("home.demoGapBody"),
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-coral/40 bg-accent px-2.5 py-1 text-xs font-medium text-foreground/80">
                    <span className="h-2 w-2 rounded-full bg-coral" aria-hidden="true" />
                    {t("home.demoGapState")}
                  </span>,
                )}
              {step === 2 &&
                panel(
                  t("home.demoTaskTitle"),
                  t("home.demoTaskBody"),
                  <div className="mt-3 flex flex-col gap-1.5">
                    <Meta icon={CalendarClock}>{t("home.demoTaskDue")}</Meta>
                    <Meta icon={BadgeCheck}>{t("home.demoTaskMeta")}</Meta>
                  </div>,
                )}
              {step === 3 &&
                panel(
                  t("home.demoEvidenceTitle"),
                  t("home.demoEvidenceBody"),
                  <Meta icon={Lock}>{t("home.demoEvidenceNote")}</Meta>,
                )}
            </motion.div>
          </AnimatePresence>

          {/* Step navigation */}
          <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-4">
            <Button
              variant="ghost"
              size="sm"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="gap-1"
            >
              {t("nav.back")}
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground" aria-hidden="true">
              {step + 1} / {STEPS.length}
            </span>
            {step < STEPS.length - 1 ? (
              <Button variant="secondary" size="sm" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} className="gap-1">
                {t("home.demoNext")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => navigate(hasProgress ? "workspace" : "onboarding")} className="gap-1">
                {t("home.demoTryCta")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </Tabs>
    </section>
  );
}
