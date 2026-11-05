"use client";

/**
 * Hero visual — the homepage's dominant right-hand composition:
 *
 * 1. The campus illustration (pre-optimized responsive <picture>, never
 *    next/image: the standalone build ships no sharp optimizer — see
 *    next.config.ts) with a stable aspect box so it can never shift layout.
 * 2. A small original plane/path animation layered over the photo corner —
 *    one short introduction on load, no constant motion (prompt §7). It
 *    collapses to a static path when the in-app reduce-motion setting or the
 *    OS prefers-reduced-motion is active.
 * 3. A preparation preview card on a white working surface:
 *    - returning users see their REAL next plan task (operates on actual
 *      state, links into the task screen);
 *    - new visitors see an explicitly-labelled illustrative example driven
 *    only by local state — isolated from saved data (prompt §6).
 */
import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { EASE, DUR_STEP, DUR_DATA } from "./motion";
import { CircleCheck, CircleDashed, LoaderCircle, ArrowRight } from "lucide-react";
import type { DegreeLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One original dashed flight path + paper plane, drawn once. Decorative. */
function PlanePathIntro({ reduce }: { reduce: boolean }) {
  return (
    <svg
      viewBox="0 0 220 90"
      className="pointer-events-none absolute -top-3 left-4 h-16 w-40 sm:-top-4 sm:left-6 sm:h-20 sm:w-52"
      aria-hidden="true"
      focusable="false"
    >
      <motion.path
        d="M8 74C52 70 96 52 128 30c14-10 30-16 48-18"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="2 9"
        initial={reduce ? { pathLength: 1, opacity: 0.9 } : { pathLength: 0, opacity: 0.9 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 1.1, ease: EASE, delay: 0.15 }}
        style={{ filter: "drop-shadow(0 1px 2px rgba(23,60,53,0.35))" }}
      />
      <motion.g
        initial={reduce ? { x: 168, y: 16, rotate: -12, opacity: 1 } : { x: 4, y: 72, rotate: -32, opacity: 0 }}
        animate={{ x: 168, y: 16, rotate: -12, opacity: 1 }}
        transition={
          reduce
            ? { duration: 0 }
            : { duration: 1.1, ease: EASE, delay: 0.15, opacity: { duration: 0.2, delay: 0.2 } }
        }
      >
        <path d="M0 0 26 7 7 18Z" fill="#D96D51" />
        <path d="M7 7.5 26 7 7 18Z" fill="#173C35" opacity="0.85" />
      </motion.g>
    </svg>
  );
}

type PreviewRow = {
  title: string;
  state: "done" | "in_progress" | "todo";
};

const STATE_ICON = {
  done: CircleCheck,
  in_progress: LoaderCircle,
  todo: CircleDashed,
} as const;

function PreviewRows({ rows }: { rows: PreviewRow[] }) {
  const { t } = useI18n();
  return (
    <ul className="mt-3 space-y-2">
      {rows.map((row) => {
        const Icon = STATE_ICON[row.state];
        return (
          <li key={row.title} className="flex items-start gap-2.5">
            <Icon
              aria-hidden="true"
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                row.state === "done" && "text-leaf",
                row.state === "in_progress" && "animate-[spin_5s_linear_infinite] text-coral",
                row.state === "todo" && "text-muted-foreground/70",
              )}
            />
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm leading-snug",
                  row.state === "done" ? "text-muted-foreground line-through decoration-leaf/50" : "text-foreground/90",
                  row.state === "in_progress" && "font-medium",
                )}
              >
                {row.title}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground/80">
                {row.state === "done" ? t("home.previewDone") : row.state === "in_progress" ? t("home.previewInProgress") : t("home.previewTodo")}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Real next task from the user's active plan (or null). */
function nextRealTask() {
  const plan = useAppStore.getState().plan;
  if (!plan) return null;
  const open = plan.tasks
    .filter((task) => task.status === "todo" || task.status === "in_progress")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return open[0] ?? null;
}

export function HeroVisual({ exampleDegree }: { exampleDegree: Exclude<DegreeLevel, "undecided"> }) {
  const { t, lang } = useI18n();
  const prefersReduced = useReducedMotion();
  const reduceMotion = useAppStore((s) => s.reduceMotion) || !!prefersReduced;
  const plan = useAppStore((s) => s.plan);
  const navigate = useAppStore((s) => s.navigate);

  const nextTask = plan ? nextRealTask() : null;

  // Illustrative example rows — parsed from one i18n string per degree so
  // translators control full sentence order. Purely local: nothing here
  // touches the persisted profile/plan.
  const exampleTitles = t(`home.previewTasks.${exampleDegree}`).split("|");

  return (
    <div className="relative">
      {/* Dominant campus illustration with intentional crop — slightly
          taller than the 7:4 master so the subjects lift above the
          preview card's overlap zone */}
      <figure className="relative overflow-hidden rounded-2xl border border-border bg-secondary shadow-sm">
        <div className="aspect-[16/10] w-full sm:aspect-[7/4]">
          <picture>
            <source
              type="image/webp"
              srcSet="/images/hero-campus-640.webp 640w, /images/hero-campus-1024.webp 1024w, /images/hero-campus-1344.webp 1344w"
              sizes="(min-width: 1024px) 46vw, 100vw"
            />
            <img
              src="/images/hero-campus-1024.jpg"
              srcSet="/images/hero-campus-640.jpg 640w, /images/hero-campus-1024.jpg 1024w, /images/hero-campus-1344.jpg 1344w"
              sizes="(min-width: 1024px) 46vw, 100vw"
              alt={t("home.heroImageAlt")}
              width={1344}
              height={768}
              fetchPriority="high"
              decoding="async"
              className="h-full w-full object-cover object-[50%_42%]"
            />
          </picture>
        </div>
        {/* Warm depth wash so white overlays stay readable */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#173C35]/45 via-[#173C35]/10 to-transparent"
        />
        {/* Short plane/path introduction */}
        <PlanePathIntro reduce={reduceMotion} />
        <figcaption className="absolute bottom-2.5 right-3 rounded-full bg-[#173C35]/55 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
          {t("home.heroImageNote")}
        </figcaption>
      </figure>

      {/* Preparation preview — a white working surface overlapping the photo */}
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0.12 : DUR_STEP, ease: EASE, delay: 0.18 }}
        className="relative z-10 -mt-8 sm:-mt-10 lg:-mt-10 lg:ml-8"
      >
        <div className="rounded-2xl border border-border bg-card p-4 shadow-md sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-leaf">
              {nextTask ? t("home.previewRealLabel") : t("home.previewExampleLabel")}
            </p>
          </div>

          {nextTask ? (
            <div className="mt-2">
              <p className="text-sm font-medium leading-snug sm:text-base">
                {lang === "bn" && nextTask.titleBn ? nextTask.titleBn : nextTask.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {nextTask.dueDate
                  ? `${t("cal.taskDue")}: ${new Date(nextTask.dueDate).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                  : nextTask.purpose}
              </p>
              <button
                onClick={() => navigate("task", undefined, nextTask.id)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2"
              >
                {t("home.previewOpenTask")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <motion.div
              key={exampleDegree}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0.1 : DUR_DATA, ease: EASE }}
            >
              <PreviewRows
                rows={[
                  { title: exampleTitles[0] ?? "", state: "done" },
                  { title: exampleTitles[1] ?? "", state: "in_progress" },
                  { title: exampleTitles[2] ?? "", state: "todo" },
                ]}
              />
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
