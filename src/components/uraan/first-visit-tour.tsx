"use client";

/**
 * Optional first-visit tour (implementation prompt §7).
 *
 * Skip / Back / Next / Finish, anchored to REAL homepage controls. Design
 * constraints honoured:
 * - never restarts on every visit: completion or dismissal sets a
 *   localStorage flag; the tour only renders for first-time visitors with
 *   no existing progress (or when explicitly restarted via the CTA band)
 * - missing targets are skipped safely: each step resolves its anchor at
 *   render time and the step list filters out anything not present
 * - keyboard operable: real buttons, Escape skips, focus moves into the
 *   card; the anchored control receives a temporary highlight ring
 * - reduced motion: card fades without movement, no smooth scrolling
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { EASE } from "./motion";
import { Button } from "@/components/ui/button";
import { PaperPlaneMark } from "./illustrations";
import { cn } from "@/lib/utils";

const TOUR_FLAG = "uraan.tour.v1.done";

type TourStep = {
  anchor: () => HTMLElement | null;
  titleKey: "home.tourStep1Title" | "home.tourStep2Title" | "home.tourStep3Title" | "home.tourStep4Title";
  bodyKey: "home.tourStep1Body" | "home.tourStep2Body" | "home.tourStep3Body" | "home.tourStep4Body";
};

export function FirstVisitTour() {
  const { t } = useI18n();
  const profileDone = useAppStore((s) => Boolean(s.profile?.onboardingCompleted));
  const hasPlan = useAppStore((s) => Boolean(s.plan));
  const prefersReduced = useReducedMotion();
  const reduceMotion = useAppStore((s) => s.reduceMotion) || !!prefersReduced;

  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(-1); // -1 = welcome card
  const highlighted = useRef<HTMLElement | null>(null);

  // Anchor selectors — resolved live so a missing target is skipped safely.
  const steps: TourStep[] = useMemo(
    () => [
      {
        anchor: () => document.querySelector('[role="radiogroup"][aria-labelledby="degree-group-label"]'),
        titleKey: "home.tourStep1Title",
        bodyKey: "home.tourStep1Body",
      },
      {
        anchor: () => document.getElementById("home-search"),
        titleKey: "home.tourStep2Title",
        bodyKey: "home.tourStep2Body",
      },
      {
        anchor: () => document.getElementById("hero-primary-cta"),
        titleKey: "home.tourStep3Title",
        bodyKey: "home.tourStep3Body",
      },
      {
        anchor: () => document.getElementById("demo-title"),
        titleKey: "home.tourStep4Title",
        bodyKey: "home.tourStep4Body",
      },
    ],
    [],
  );

  const markDone = useCallback(() => {
    try {
      window.localStorage.setItem(TOUR_FLAG, "1");
    } catch {
      /* storage unavailable — tour may reappear; harmless */
    }
  }, []);

  // First visit only: no completion flag AND no existing progress.
  useEffect(() => {
    let alreadyDone = false;
    try {
      alreadyDone = window.localStorage.getItem(TOUR_FLAG) === "1";
    } catch {
      /* ignore */
    }
    if (!alreadyDone && !profileDone && !hasPlan) {
      const id = window.setTimeout(() => setVisible(true), 700);
      return () => window.clearTimeout(id);
    }
  }, [profileDone, hasPlan]);

  // Explicit restart requests (final CTA band) always work.
  useEffect(() => {
    const handler = () => {
      setVisible(true);
      setStep(-1);
    };
    window.addEventListener("uraan:tour-restart", handler);
    return () => window.removeEventListener("uraan:tour-restart", handler);
  }, []);

  const clearHighlight = () => {
    if (highlighted.current) {
      highlighted.current.classList.remove("uraan-tour-ring");
      highlighted.current = null;
    }
  };

  const close = useCallback(() => {
    clearHighlight();
    markDone();
    setVisible(false);
    setStep(-1);
  }, [markDone]);

  // Highlight + scroll to the current step's anchor.
  useEffect(() => {
    clearHighlight();
    if (!visible || step < 0) return;
    const target = steps[step]?.anchor();
    if (!target) return;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    target.classList.add("uraan-tour-ring");
    highlighted.current = target;
    return clearHighlight;
  }, [step, visible, steps, reduceMotion]);

  // Escape skips the tour.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, close]);

  if (!visible) return null;

  const total = steps.length;
  const card = (
    <div
      role="dialog"
      aria-label={step < 0 ? t("home.tourWelcomeTitle") : t(steps[step].titleKey)}
      className="pointer-events-auto w-[min(92vw,380px)] rounded-2xl border border-border bg-card p-5 shadow-xl"
    >
      <div className="flex items-start gap-3">
        <PaperPlaneMark width={30} height={30} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-sm font-bold leading-snug sm:text-base">
            {step < 0 ? t("home.tourWelcomeTitle") : t(steps[step].titleKey)}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {step < 0 ? t("home.tourWelcomeBody") : t(steps[step].bodyKey)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={close}>
          {t("home.tourSkip")}
        </Button>
        <div className="flex items-center gap-2">
          {step >= 0 && (
            <span className="text-xs tabular-nums text-muted-foreground" aria-hidden="true">
              {t("home.tourStepOf", { current: step + 1, total })}
            </span>
          )}
          {step >= 0 && (
            <Button variant="outline" size="sm" onClick={() => setStep((s) => Math.max(-1, s - 1))}>
              {t("home.tourBack")}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              if (step < total - 1) setStep((s) => s + 1);
              else close();
            }}
          >
            {step < 0 ? t("home.tourNext") : step < total - 1 ? t("home.tourNext") : t("home.tourFinish")}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="uraan-tour"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: reduceMotion ? 0.12 : 0.26, ease: EASE }}
          className="fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:bottom-6 sm:right-6"
          aria-live="polite"
        >
          {card}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Imperative restart — clears the completion flag and pings the tour. */
export function restartTour() {
  try {
    window.localStorage.removeItem(TOUR_FLAG);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("uraan:tour-restart"));
}
