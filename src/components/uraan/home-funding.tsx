"use client";

/**
 * Funding explainer (implementation prompt §6.5).
 *
 * Teaches the distinction the funding worksheet is built on: annually
 * recurring costs versus the cash that must exist BEFORE enrollment. The
 * three honesty rules mirror the deterministic funding engine (unknown ≠ 0,
 * competitive ≠ guaranteed, future stipend ≠ today's deposit). Static,
 * read-only teaching content — the CTA opens the real worksheet.
 */
import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { sectionEntrance, listItem, staggerList } from "./motion";
import { Button } from "@/components/ui/button";
import { Repeat, Wallet, ShieldCheck, ArrowRight } from "lucide-react";

export function HomeFunding() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const prefersReduced = useReducedMotion();
  const reduceMotion = useAppStore((s) => s.reduceMotion) || !!prefersReduced;
  const enter = sectionEntrance(reduceMotion);
  const list = staggerList(reduceMotion);
  const item = listItem(reduceMotion);

  return (
    <motion.section
      className="mt-14"
      aria-labelledby="fund-title"
      variants={enter}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="fund-title" className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">
          {t("home.fundTitle")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("home.fundLabel")}</p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* Recurring annual costs */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-leaf" aria-hidden="true">
              <Repeat className="h-5 w-5" />
            </span>
            <h3 className="text-base font-semibold">{t("home.fundAnnualTitle")}</h3>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("home.fundAnnualBody")}</p>
        </div>

        {/* Upfront cash before enrollment */}
        <div className="rounded-2xl border border-coral/35 bg-gradient-to-br from-accent to-card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-coral/15 text-coral" aria-hidden="true">
              <Wallet className="h-5 w-5" />
            </span>
            <h3 className="text-base font-semibold">{t("home.fundUpfrontTitle")}</h3>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("home.fundUpfrontBody")}</p>
        </div>
      </div>

      {/* The three honesty rules of the funding engine */}
      <motion.ul
        variants={list}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        className="mt-4 grid gap-2 sm:grid-cols-3"
      >
        {[t("home.fundRule1"), t("home.fundRule2"), t("home.fundRule3")].map((rule) => (
          <motion.li
            key={rule}
            variants={item}
            className="flex items-start gap-2 rounded-xl border border-border bg-secondary/50 px-3.5 py-3 text-sm leading-snug text-foreground/85"
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf" aria-hidden="true" />
            {rule}
          </motion.li>
        ))}
      </motion.ul>

      <div className="mt-5">
        <Button variant="outline" onClick={() => navigate("funding")} className="gap-1.5">
          {t("home.fundCta")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </motion.section>
  );
}
