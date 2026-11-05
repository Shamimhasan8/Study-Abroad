"use client";

/**
 * Workspace home — the student's daily surface (Gate 2 of the 04 contract).
 *
 * Every summary derives from actual state: today's primary task, two
 * supporting actions, a visual phase map (with an equivalent accessible
 * list), upcoming real dates, a blocker summary, the selected target, and
 * the shared replan confirmation gate. Plan generation for the chosen
 * target happens here; the preview/confirm flow runs on the SINGLE replan
 * contract (src/lib/planning/replan.ts).
 */
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useI18n, localizeDigits } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiPost } from "@/lib/api-client";
import { parsePlanGenerateOk } from "@/lib/planning/replan";
import { PHASE_LABELS, phaseOfTask } from "@/lib/planning/engine";
import { deadlineExpired, deadlineLabel, todayISO } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MilestonePath, PaperPlaneFlight } from "@/components/uraan/illustrations";
import { ScenarioDrawer } from "@/components/uraan/workspace/scenario-drawer";
import type { EvaluationSummary, NotificationItem, Opportunity } from "@/lib/types";
import {
  Map, Target, CalendarClock, ClipboardList, Loader2, CircleCheck, CircleX,
  CircleHelp, ShieldQuestion, SlidersHorizontal, ArrowRight, AlertTriangle,
  Sun, SunMedium, Moon, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

function greeting(lang: "en" | "bn"): { icon: typeof Sun; text: string } {
  const hour = new Date().getHours();
  if (hour < 5) return { icon: Moon, text: lang === "bn" ? "শুভ রাত" : "Good night" };
  if (hour < 12) return { icon: Sun, text: lang === "bn" ? "শুভ সকাল" : "Good morning" };
  if (hour < 17) return { icon: SunMedium, text: lang === "bn" ? "শুভ দুপুর" : "Good afternoon" };
  return { icon: Moon, text: lang === "bn" ? "শুভ সন্ধ্যা" : "Good evening" };
}

export function WorkspaceView() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const {
    navigate, profile, plan, goalSlug, setPlan, setEvaluation, evaluations,
    user, replanConfirmation, setReplanConfirmation, setStats,
  } = useAppStore();
  const prefersReduced = useReducedMotion();
  const reduceMotion = useAppStore((s) => s.reduceMotion) || !!prefersReduced;

  const [goalOpportunity, setGoalOpportunity] = useState<Opportunity | null>(null);
  const [generating, setGenerating] = useState(false);
  const [fly, setFly] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);

  const hello = greeting(lang);

  // Recent source-change notifications (real ones, signed-in only).
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    void (async () => {
      try {
        const res = await fetch("/api/notifications");
        const json = await res.json();
        if (json.ok) setNotifications(json.data.notifications ?? []);
      } catch {
        /* offline — show nothing rather than stale data */
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!goalSlug) {
      setGoalOpportunity(null);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(`/api/catalogue/${goalSlug}`);
        const json = await res.json();
        setGoalOpportunity(json.ok ? json.data.opportunity : null);
      } catch {
        setGoalOpportunity(null);
      }
    })();
  }, [goalSlug]);

  // ---------- Replan: the single contract, gate rendered from the store ----------

  const generate = async (opts: { confirm?: { token: string } } = {}) => {
    if (!goalSlug) return;
    setGenerating(true);
    try {
      const body: Record<string, unknown> = { slug: goalSlug };
      if (!user && profile) body.profile = profile;
      if (opts.confirm) {
        body.confirmReplace = true;
        body.previewToken = opts.confirm.token;
      }
      const res = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      const ok = res.ok && json?.ok ? parsePlanGenerateOk(json.data) : null;
      if (ok) {
        if (ok.kind === "confirmation") {
          setReplanConfirmation(ok);
        } else {
          setPlan(ok.plan);
          setReplanConfirmation(null);
          const evRes = await fetch("/api/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body.confirm ? { slug: goalSlug } : body),
          });
          const evJson = await evRes.json();
          if (evJson.ok) setEvaluation(goalSlug, evJson.data.evaluation as EvaluationSummary);
          setFly(true);
          setTimeout(() => setFly(false), 1400);
        }
      } else if (res.status === 409 || json?.error === "stale_preview" || json?.error === "preview_hash_mismatch") {
        setReplanConfirmation(null);
        toast({ title: t("plan.previewStale"), variant: "destructive" });
        void generate();
      } else {
        toast({
          title: json?.error === "needs_profile" ? t("journey.needsProfile") : t("journey.generateFailed"),
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: t("journey.generateFailed"), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // ---------- Derived summaries (never hardcoded) ----------

  const tasks = plan?.tasks ?? [];
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const openTasks = tasks.filter((task) => task.status === "todo" || task.status === "in_progress");
  const sortedOpen = [...openTasks].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const primaryTask = sortedOpen[0];
  const supporting = sortedOpen.slice(1, 3);
  const upcoming = sortedOpen.filter((task) => task.dueDate).slice(0, 5);
  const today = todayISO();
  const overdue = openTasks.filter((task) => task.dueDate && task.dueDate < today);
  const evaluation = goalSlug ? evaluations[goalSlug] : undefined;
  const gapResults = evaluation?.results.filter(
    (r) => r.result === "not_met" || r.result === "needs_information" || r.result === "needs_institution_confirmation",
  ) ?? [];
  const currentPhase = primaryTask ? phaseOfTask(primaryTask.dueDate) : undefined;

  const phaseData = useMemo(
    () =>
      [0, 1, 2, 3, 4].map((idx) => ({
        idx,
        label: PHASE_LABELS[lang][idx],
        openCount: openTasks.filter((task) => phaseOfTask(task.dueDate) === idx).length,
        isCurrent: currentPhase === idx,
        cleared: currentPhase !== undefined && idx < currentPhase,
      })),
    [openTasks, currentPhase, lang],
  );

  const phaseTasks = selectedPhase === null ? [] : openTasks.filter((task) => phaseOfTask(task.dueDate) === selectedPhase);

  // ---------- Empty state ----------

  if (!profile?.onboardingCompleted && !plan && !goalSlug) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 text-center sm:px-6">
        <MilestonePath width={260} height={110} className="mx-auto" aria-hidden="true" />
        <h1 className="mt-6 font-display text-[26px] font-bold tracking-tight sm:text-3xl">{t("workspace.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("journey.noGoalBody")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={() => navigate("onboarding")}>{t("home.ctaPrimary")}</Button>
          <Button variant="outline" onClick={() => navigate("explore")}>{t("journey.setGoal")}</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      {/* Greeting header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <hello.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {hello.text}
            <span aria-hidden="true">·</span>
            {new Date().toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-[26px] font-bold tracking-tight sm:text-3xl">
            <Map className="h-6 w-6 text-leaf" aria-hidden="true" />
            {t("workspace.title")}
            {fly && <PaperPlaneFlight width={34} height={34} />}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setScenarioOpen(true)} className="gap-1.5">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {lang === "bn" ? "সিনারিও দেখুন" : "What-if preview"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("explore")} className="gap-1.5">
            <Target className="h-4 w-4" aria-hidden="true" />
            {t("journey.setGoal")}
          </Button>
        </div>
      </header>

      {/* Replan confirmation gate — the SINGLE contract, shared with the scenario drawer */}
      {replanConfirmation && (
        <Card className="mb-6 border-sunflower/60 bg-accent" role="region" aria-label={t("plan.replanPreview")}>
          <CardContent className="p-5">
            <h2 className="text-base font-semibold">{t("plan.replanPreview")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("plan.replanBody")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("plan.previewPreserved", {
                completed: localizeDigits(replanConfirmation.preserved.completed, lang),
                edited: localizeDigits(replanConfirmation.preserved.edited, lang),
              })}
            </p>
            <ul className="mt-3 max-h-64 overflow-y-auto uraan-scroll flex flex-col gap-1.5 text-sm">
              {replanConfirmation.preview.tasks.slice(0, 12).map((task) => (
                <li key={task.id} className="flex items-center gap-2">
                  <span className={task.status === "done" ? "text-leaf" : "text-muted-foreground"}>
                    {task.status === "done" ? "✓" : "•"}
                  </span>
                  <span className={task.userEdited ? "font-semibold" : ""}>
                    {lang === "bn" && task.titleBn ? task.titleBn : task.title}
                  </span>
                  {task.userEdited && <Badge variant="outline" className="text-[10px]">edited</Badge>}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReplanConfirmation(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={() => generate({ confirm: { token: replanConfirmation.previewToken } })}
                disabled={generating}
              >
                {generating && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {t("common.confirm")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's primary task */}
      {primaryTask ? (
        <Card className="mb-6 border-leaf/30 bg-card shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-leaf">
              {lang === "bn" ? "আজকের প্রধান কাজ" : "Today's primary task"}
            </p>
            <h2 className="mt-2 font-display text-xl font-semibold leading-snug sm:text-2xl">
              {lang === "bn" && primaryTask.titleBn ? primaryTask.titleBn : primaryTask.title}
            </h2>
            <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
              {lang === "bn" && primaryTask.purposeBn ? primaryTask.purposeBn : primaryTask.purpose}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className={primaryTask.dateBasis === "official" ? "border-leaf/50 bg-secondary" : "text-muted-foreground"}>
                {primaryTask.dueDate} · {primaryTask.dateBasis === "official" ? t("plan.officialBasis") : t("plan.estimatedBasis")}
              </Badge>
              {primaryTask.effortHours ? (
                <span>{t("plan.effort", { hours: localizeDigits(Math.round(primaryTask.effortHours), lang) })}</span>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => navigate("task", undefined, primaryTask.id)} className="gap-1.5">
                {lang === "bn" ? "কাজটি খুলুন" : "Open this task"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  if (user) {
                    const result = await apiPost("/api/plan/task", { taskId: primaryTask.id, status: "done" });
                    if (result.ok) {
                      useAppStore.getState().patchTask(primaryTask.id, { status: "done" });
                      setFly(true);
                      setTimeout(() => setFly(false), 1400);
                    } else {
                      toast({ title: t("common.error"), description: t("journey.taskRetry"), variant: "destructive" });
                    }
                    return;
                  }
                  useAppStore.getState().patchTask(primaryTask.id, { status: "done" });
                  setFly(true);
                  setTimeout(() => setFly(false), 1400);
                }}
                className="gap-1.5"
              >
                <CircleCheck className="h-4 w-4" aria-hidden="true" />
                {t("plan.complete")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6 border-border/70 bg-card">
          <CardContent className="flex flex-col items-start gap-3 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-leaf" aria-hidden="true" />
              <p className="font-medium">
                {plan
                  ? lang === "bn" ? "সব খোলা কাজ শেষ — কাল আবার দেখুন বা রিপ্ল্যান করুন।" : "All open work is done — revisit tomorrow or replan."
                  : t("plan.emptyBody")}
              </p>
            </div>
            {plan && (
              <Button variant="outline" size="sm" onClick={() => generate()} disabled={generating} className="gap-1.5">
                {generating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {t("plan.regenerate")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Two supporting actions */}
      {supporting.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {supporting.map((task) => (
            <button
              key={task.id}
              onClick={() => navigate("task", undefined, task.id)}
              className="group flex items-start gap-3 rounded-xl border border-border/70 bg-card p-4 text-left transition-colors hover:border-leaf/40 hover:bg-secondary/40 focus-visible:outline-2"
            >
              <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-leaf" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {lang === "bn" && task.titleBn ? task.titleBn : task.title}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {task.dueDate ?? "—"}
                  {task.effortHours ? ` · ${t("plan.effort", { hours: localizeDigits(Math.round(task.effortHours), lang) })}` : ""}
                </span>
              </span>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60 group-hover:text-leaf" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {/* Phase map — visual journey with an equivalent accessible list */}
      <Card className="mb-6 border-border/70 bg-card">
        <CardContent className="p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold tracking-tight">
            {lang === "bn" ? "প্রস্তুতির পথ" : "Your preparation path"}
          </h2>
          <div className="relative">
            <div className="absolute left-0 right-0 top-[13px] h-0.5 bg-border" aria-hidden="true" />
            <ol className="relative flex items-start justify-between" role="list">
              {phaseData.map((phase) => (
                <li key={phase.idx} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
                  <button
                    onClick={() => setSelectedPhase(selectedPhase === phase.idx ? null : phase.idx)}
                    aria-pressed={selectedPhase === phase.idx}
                    aria-label={`${phase.label} — ${phase.openCount} open`}
                    className={cn(
                      "relative flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-all focus-visible:outline-2",
                      phase.isCurrent
                        ? "border-coral bg-coral text-white shadow-[0_0_0_4px_rgba(217,109,81,0.2)]"
                        : phase.cleared
                          ? "border-leaf bg-leaf text-white"
                          : phase.openCount > 0
                            ? "border-leaf/50 bg-secondary text-leaf"
                            : "border-border bg-card text-muted-foreground/50",
                      !reduceMotion && phase.isCurrent && "scale-110",
                    )}
                  >
                    {phase.cleared ? <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> : localizeDigits(phase.openCount, lang)}
                    {phase.isCurrent && (
                      <motion.span
                        className="absolute -inset-1 rounded-full border border-coral/40"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.4, 0.9, 0.4] }}
                        transition={reduceMotion ? { duration: 0 } : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                  <span
                    className={cn(
                      "max-w-[72px] truncate text-[10px] font-medium leading-tight sm:max-w-none sm:text-xs",
                      phase.isCurrent ? "text-coral" : phase.cleared ? "text-leaf" : "text-muted-foreground",
                    )}
                  >
                    {phase.label}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          {/* Equivalent accessible summary (screen-reader linear form) */}
          <p className="sr-only" role="status">
            {phaseData
              .map((p) => `${p.label}: ${localizeDigits(p.openCount, lang)} open${p.isCurrent ? " (current)" : ""}`)
              .join(". ")}
          </p>
          {phaseTasks.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1.5 border-t border-border/70 pt-4">
              {phaseTasks.map((task) => (
                <li key={task.id}>
                  <button
                    onClick={() => navigate("task", undefined, task.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-secondary/50 focus-visible:outline-2"
                  >
                    <span className="min-w-0 truncate">{lang === "bn" && task.titleBn ? task.titleBn : task.title}</span>
                    <Badge variant="outline" className="shrink-0 text-muted-foreground">{task.dueDate ?? "—"}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selectedPhase !== null && phaseTasks.length === 0 && (
            <p className="mt-4 border-t border-border/70 pt-4 text-sm text-muted-foreground">
              {lang === "bn" ? "এই ধাপে এখন কোনো খোলা কাজ নেই।" : "No open work in this phase right now."}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Goal card */}
        <Card className="border-border/70 bg-card">
          <CardContent className="p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-base font-semibold tracking-tight">
              <Target className="h-4 w-4 text-leaf" aria-hidden="true" />
              {lang === "bn" ? "বর্তমান লক্ষ্য" : "Current goal"}
            </h2>
            <h3 className="text-lg font-semibold leading-snug">
              {goalOpportunity
                ? (lang === "bn" && goalOpportunity.titleBn ? goalOpportunity.titleBn : goalOpportunity.title)
                : t("journey.noGoal")}
            </h3>
            {goalOpportunity && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="border-leaf/40 bg-secondary/70">{goalOpportunity.countryLabel}</Badge>
                <span>{goalOpportunity.deadlineNote.split(".")[0]}.</span>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => navigate("detail", goalOpportunity.slug)}>
                  {t("common.viewDetails")}
                </Button>
              </div>
            )}
            {plan && (
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium">{t("journey.progress")}</span>
                  <span className="text-muted-foreground">
                    {t("journey.tasksDone", { done: localizeDigits(doneCount, lang), total: localizeDigits(tasks.length, lang) })}
                  </span>
                </div>
                <Progress value={tasks.length ? (doneCount / tasks.length) * 100 : 0} aria-label={t("journey.progress")} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("plan.horizon")}: {t("plan.months", { n: localizeDigits(plan.horizonMonths, lang) })}
                </p>
                {plan.infeasible && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-coral/10 p-2 text-xs font-medium text-coral">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {t("plan.infeasible")}
                  </p>
                )}
                {!plan.infeasible && plan.feasibilityNote && (
                  <p className="mt-2 rounded-lg bg-accent p-2 text-xs leading-relaxed text-foreground/75">{plan.feasibilityNote}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{t("plan.progressSaved")}</p>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {goalSlug && (!plan || plan.goalSlug !== goalSlug) && (
                <Button onClick={() => generate()} disabled={generating} className="gap-1.5">
                  {generating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {plan ? t("plan.replan") : t("plan.generate")}
                </Button>
              )}
              {plan && (
                <Button variant="outline" onClick={() => generate()} disabled={generating} className="gap-1.5">
                  {generating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {t("plan.regenerate")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming dates */}
        <Card className="border-border/70 bg-card">
          <CardContent className="p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-base font-semibold tracking-tight">
              <CalendarClock className="h-4 w-4 text-leaf" aria-hidden="true" />
              {t("journey.upcoming")}
            </h2>
            {upcoming.length === 0 && goalOpportunity ? (
              <div className="flex flex-col gap-2 text-sm">
                <p className="text-muted-foreground">{goalOpportunity.deadlineNote.split(".")[0]}.</p>
                {goalOpportunity.deadlines.filter((d) => d.closeDate).map((d) => (
                  <p key={d.id} className="text-xs text-muted-foreground">
                    {d.official ? t("cal.official") : t("cal.suggested")}: {deadlineLabel(d.precision, d.closeDate!, lang)}
                    {deadlineExpired(d.closeDate!) ? ` — ${t("detail.roundExpired")}` : ""}
                  </p>
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("cal.noDates")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {upcoming.map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-2.5 text-sm">
                    <button
                      onClick={() => navigate("task", undefined, task.id)}
                      className="min-w-0 truncate text-left hover:text-leaf focus-visible:outline-2"
                    >
                      {lang === "bn" && task.titleBn ? task.titleBn : task.title}
                    </button>
                    <Badge variant="outline" className={task.dateBasis === "official" ? "border-leaf/50 bg-secondary" : "text-muted-foreground"}>
                      {task.dueDate}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => navigate("calendar")}>
              {t("cal.title")} →
            </Button>
          </CardContent>
        </Card>

        {/* Blocker summary */}
        <Card className="border-border/70 bg-card">
          <CardContent className="p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-base font-semibold tracking-tight">
              <AlertTriangle className="h-4 w-4 text-coral" aria-hidden="true" />
              {lang === "bn" ? "যা আটকে আছে" : "What's in the way"}
            </h2>
            <ul className="flex flex-col gap-2.5 text-sm">
              {overdue.length > 0 && (
                <li className="flex items-start gap-2">
                  <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                  <span>
                    {localizeDigits(overdue.length, lang)}{" "}
                    {lang === "bn" ? "টি কাজ মেয়াদোত্তীর্ণ — সময় সরিয়ে নতুন তারিখ দরকার।" : "task(s) past their date — reschedule or replan."}
                  </span>
                </li>
              )}
              {plan?.infeasible && (
                <li className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
                  <span>{t("plan.infeasible")}</span>
                </li>
              )}
              {gapResults.slice(0, 4).map((r) => (
                <li key={r.ruleId} className="flex items-start gap-2">
                  {r.result === "not_met" ? <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" /> :
                   r.result === "needs_information" ? <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-sunflower" aria-hidden="true" /> :
                   <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />}
                  <span className="leading-snug">{lang === "bn" && r.titleBn ? r.titleBn : r.title}</span>
                </li>
              ))}
              {overdue.length === 0 && !plan?.infeasible && gapResults.length === 0 && (
                <li className="text-sm text-muted-foreground">{t("detail.gapEmpty")}</li>
              )}
            </ul>
            {goalOpportunity && !evaluation && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("detail", goalSlug!)}>
                {t("detail.runMatch")}
              </Button>
            )}
            {evaluation && (
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => navigate("detail", goalSlug!)}>
                {lang === "bn" ? "সব শর্ত দেখুন" : "See all requirements"} →
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Recent changes */}
        <Card className="border-border/70 bg-card">
          <CardContent className="p-5">
            <h2 className="mb-3 text-base font-semibold tracking-tight">{t("journey.changes")}</h2>
            {!user ? (
              <p className="text-sm text-muted-foreground">
                {lang === "bn"
                  ? "কোনো সূত্র পরিবর্তন এখনো জানানো হয়নি। অ্যাকাউন্টে সাইন-ইন করলে প্রকাশিত পরিবর্তন এখানে দেখা যাবে।"
                  : "No source changes notified yet. Sign in to see published changes to your target here."}
              </p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {lang === "bn"
                  ? "কোনো সূত্র পরিবর্তন এখনো জানানো হয়নি। প্রকাশিত পরিবর্তন এখানে দেখা যাবে।"
                  : "No source changes notified yet. Published changes to your target will appear here."}
              </p>
            ) : (
              <ul className="max-h-48 overflow-y-auto uraan-scroll flex flex-col gap-2">
                {notifications.map((n) => (
                  <li key={n.id} className="rounded-lg border border-border/70 p-2.5">
                    <p className="text-sm font-medium leading-snug">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-muted-foreground/70">{n.createdAt.slice(0, 16).replace("T", " ")}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ScenarioDrawer open={scenarioOpen} onOpenChange={setScenarioOpen} />
    </main>
  );
}
