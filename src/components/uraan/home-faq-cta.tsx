"use client";

/**
 * FAQ + final CTA (implementation prompt §6.7) — the homepage's closing
 * narrative. Honest questions with honest answers (coverage limits, no
 * guarantees, guest persistence, source discipline) in an accessible
 * accordion; a calm closing band with the same primary action as the hero
 * (or a resume action for returning users) and a discoverable way to
 * replay the first-visit tour.
 */
import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { sectionEntrance } from "./motion";
import { restartTour } from "./first-visit-tour";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Compass, RotateCcw } from "lucide-react";

export function HomeFaqCta() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const profileDone = useAppStore((s) => Boolean(s.profile?.onboardingCompleted));
  const hasPlan = useAppStore((s) => Boolean(s.plan));
  const hasProgress = profileDone || hasPlan;
  const prefersReduced = useReducedMotion();
  const reduceMotion = useAppStore((s) => s.reduceMotion) || !!prefersReduced;
  const enter = sectionEntrance(reduceMotion);

  const faqs = [
    { q: t("home.faqQ1"), a: t("home.faqA1") },
    { q: t("home.faqQ2"), a: t("home.faqA2") },
    { q: t("home.faqQ3"), a: t("home.faqA3") },
    { q: t("home.faqQ4"), a: t("home.faqA4") },
    { q: t("home.faqQ5"), a: t("home.faqA5") },
  ];

  return (
    <>
      {/* ===================== FAQ ===================== */}
      <motion.section
        className="mt-14"
        aria-labelledby="faq-title"
        variants={enter}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
      >
        <h2 id="faq-title" className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">
          {t("home.faqTitle")}
        </h2>
        <Accordion type="single" collapsible className="mt-5 rounded-2xl border border-border bg-card px-5">
          {faqs.map((f, i) => (
            <AccordionItem key={f.q} value={`faq-${i}`} className="border-border/70 last:border-b-0">
              <AccordionTrigger className="py-4 text-left text-sm font-semibold hover:no-underline sm:text-base">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </motion.section>

      {/* ===================== Final CTA ===================== */}
      <motion.section
        className="mt-14"
        aria-labelledby="final-title"
        variants={enter}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
      >
        <div className="overflow-hidden rounded-3xl bg-[#173C35] px-6 py-10 text-center sm:px-10 sm:py-14">
          <h2
            id="final-title"
            className="font-display text-2xl font-bold tracking-tight text-[#F8F6F0] sm:text-[32px]"
          >
            {t("home.finalTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#F8F6F0]/80 sm:text-base">
            {t("home.finalBody")}
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              onClick={() => navigate(hasProgress ? "workspace" : "onboarding")}
              className="gap-2 bg-[#F8F6F0] text-[#173C35] hover:bg-[#E8EEE5]"
            >
              <Compass className="h-4 w-4" aria-hidden="true" />
              {hasProgress ? t("home.finalCtaResume") : t("home.finalCta")}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("explore")}
              className="border-[#F8F6F0]/40 bg-transparent text-[#F8F6F0] hover:bg-[#F8F6F0]/10 hover:text-[#F8F6F0]"
            >
              {t("home.finalSecondary")}
            </Button>
          </div>
          <button
            onClick={restartTour}
            className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-[#F8F6F0]/70 underline-offset-4 transition-colors hover:text-[#F8F6F0] hover:underline focus-visible:outline-2"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {t("home.tourRestart")}
          </button>
        </div>
      </motion.section>
    </>
  );
}
