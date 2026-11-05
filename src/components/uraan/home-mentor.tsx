"use client";

/**
 * Mentor preview (implementation prompt §6.6).
 *
 * Shows the shape of a grounded mentor answer — question, direct
 * explanation, resolved evidence — with the mentor's availability labelled
 * ACCURATELY from the live capability probe: 'live mentor' when the model
 * is configured, an honest 'template mode' note when it is not. The example
 * is clearly labelled as a shape, not a stored conversation; the CTA opens
 * the workspace where the real mentor rail lives.
 */
import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { sectionEntrance } from "./motion";
import { Button } from "@/components/ui/button";
import { MentorMascot } from "./mentor/mascot";
import { ArrowRight, MessageCircleQuestion, BookCheck, Sparkles } from "lucide-react";

export function HomeMentor() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const capabilities = useAppStore((s) => s.capabilities);
  const prefersReduced = useReducedMotion();
  const reduceMotion = useAppStore((s) => s.reduceMotion) || !!prefersReduced;
  const enter = sectionEntrance(reduceMotion);

  // Unknown capability (probe pending) renders the conservative fallback
  // label — the homepage never claims a live model that may not exist.
  const liveMentor = capabilities?.liveMentor.available === true;

  return (
    <motion.section
      className="mt-14"
      aria-labelledby="mentor-title"
      variants={enter}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      <h2 id="mentor-title" className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">
        {t("home.mentorTitle")}
      </h2>

      <div className="mt-5 grid gap-4 lg:grid-cols-[9fr_11fr]">
        {/* Availability label + capabilities */}
        <div className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div>
            <span
              className={
                liveMentor
                  ? "inline-flex items-center gap-1.5 rounded-full border border-leaf/40 bg-secondary px-3 py-1 text-xs font-semibold text-leaf"
                  : "inline-flex items-center gap-1.5 rounded-full border border-coral/40 bg-accent px-3 py-1 text-xs font-semibold text-foreground/75"
              }
            >
              <span className={`h-2 w-2 rounded-full ${liveMentor ? "bg-leaf" : "bg-coral"}`} aria-hidden="true" />
              {liveMentor ? t("home.mentorAvailable") : t("home.mentorFallback")}
            </span>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("home.mentorActions")}</p>
          </div>
          <Button onClick={() => navigate("workspace")} className="w-fit gap-1.5">
            {t("home.mentorCta")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Example answer shape — question bubble, grounded answer, citation */}
        <figure className="rounded-2xl border border-border bg-gradient-to-br from-secondary/70 to-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <MentorMascot state="idle" size={44} />
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 rounded-xl rounded-tl-sm bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground">
                <MessageCircleQuestion className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t("home.mentorExampleQ")}
              </p>
              <blockquote className="mt-3 rounded-xl rounded-tl-sm border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground/90">
                {t("home.mentorExampleA")}
                <footer className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/70 pt-2.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <BookCheck className="h-3.5 w-3.5 text-leaf" aria-hidden="true" />
                    {t("home.mentorCite")}
                  </span>
                </footer>
              </blockquote>
              <figcaption className="mt-2.5 inline-flex items-center gap-1 text-[11px] leading-relaxed text-muted-foreground/90">
                <Sparkles className="h-3 w-3 shrink-0 text-sunflower" aria-hidden="true" />
                {t("home.mentorNote")}
              </figcaption>
            </div>
          </div>
        </figure>
      </div>
    </motion.section>
  );
}
