"use client";

/**
 * My Journey — current goal, top 3 next actions, requirement gaps,
 * upcoming dates, and honest progress. Plan generation for the chosen
 * target happens here (guests persist locally, users server-side).
 */
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { MilestonePath, PaperPlaneFlight } from "./illustrations";
import { PHASE_LABELS, phaseOfTask } from "@/lib/planning/engine";
import { deadlineLabel } from "@/lib/dates";
import type { EvaluationSummary, Opportunity } from "@/lib/types";
import {
  Map, Target, CalendarClock, ClipboardList, Sparkles, Loader2, CircleCheck, CircleX, CircleHelp, ShieldQuestion,
} from "lucide-react";

export function JourneyView() {
  const { t, lang } = useI18n();
  const {
    navigate, profile, plan, goalSlug, setPlan, setEvaluation, evaluations, user, patchTask,
  } = useAppStore();

  const [goalOpportunity, setGoalOpportunity] = useState<Opportunity | null>(null);
  const [generating, setGenerating] = useState(false);
  const [explainBusy, setExplainBusy] = useState(false);
  const [explanation, setExplanation] = useState<{ text: string; aiGenerated: boolean } | null>(null);
  const [fly, setFly] = useState(false);
  const [preview, setPreview] = useState<{ requiresConfirmation: boolean; plan: typeof plan } | null>(null);

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

  const generate = async (confirmReplace = false) => {
    if (!goalSlug) return;
    setGenerating(true);
    try {
      const body: Record<string, unknown> = { slug: goalSlug, confirmReplace };
      if (!user && profile) body.profile = profile;
      const res = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.ok) {
        if (json.data.requiresConfirmation) {
          setPreview(json.data);
        } else {
          setPlan(json.data.plan);
          setPreview(null);
          // evaluate for gap display too
          const evRes = await fetch("/api/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const evJson = await evRes.json();
          if (evJson.ok) setEvaluation(goalSlug, evJson.data.evaluation as EvaluationSummary);
          setFly(true);
          setTimeout(() => setFly(false), 1400);
        }
      }
    } catch {
      /* network error — keep prior plan */
    } finally {
      setGenerating(false);
    }
  };

  const explain = async () => {
    if (!goalSlug) return;
    setExplainBusy(true);
    try {
      const body: Record<string, unknown> = { slug: goalSlug, lang };
      if (!user && profile) body.profile = profile;
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.ok) setExplanation({ text: json.data.explanation, aiGenerated: json.data.aiGenerated });
      else setExplanation({ text: t("journey.aiUnavailable"), aiGenerated: false });
    } catch {
      setExplanation({ text: t("journey.aiUnavailable"), aiGenerated: false });
    } finally {
      setExplainBusy(false);
    }
  };

  const evaluation = goalSlug ? evaluations[goalSlug] : undefined;

  const tasks = plan?.tasks ?? [];
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const openTasks = tasks.filter((task) => task.status === "todo" || task.status === "in_progress");
  const nextActions = [...openTasks]
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 3);
  const upcoming = [...openTasks]
    .filter((task) => task.dueDate)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 5);
  const currentPhase = nextActions[0] ? PHASE_LABELS[lang][phaseOfTask(nextActions[0].dueDate)] : undefined;

  const completeTask = async (taskId: string) => {
    patchTask(taskId, { status: "done" });
    if (user) {
      void fetch("/api/plan/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status: "done" }),
      }).catch(() => undefined);
    }
    setFly(true);
    setTimeout(() => setFly(false), 1400);
  };

  if (!profile?.onboardingCompleted && !plan && !goalSlug) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 text-center sm:px-6">
        <MilestonePath width={260} height={110} className="mx-auto" aria-hidden="true" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight">{t("journey.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("journey.noGoalBody")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={() => navigate("onboarding")}>{t("home.ctaPrimary")}</Button>
          <Button variant="outline" onClick={() => navigate("explore")}>{t("journey.setGoal")}</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Map className="h-6 w-6 text-leaf" aria-hidden="true" />
          {t("journey.title")}
          {fly && <PaperPlaneFlight width={34} height={34} />}
        </h1>
        <Button variant="outline" size="sm" onClick={() => navigate("explore")}>
          <Target className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {t("journey.setGoal")}
        </Button>
      </header>

      {/* Goal card */}
      <Card className="mb-6 border-border/70 bg-card">
        <CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {lang === "bn" ? "বর্তমান লক্ষ্য" : "Current goal"}
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {goalOpportunity
              ? (lang === "bn" && goalOpportunity.titleBn ? goalOpportunity.titleBn : goalOpportunity.title)
              : t("journey.noGoal")}
          </h2>
          {goalOpportunity && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="border-leaf/40 bg-secondary/70">{goalOpportunity.countryLabel}</Badge>
              <span>
                {goalOpportunity.deadlineNote.split(".")[0]}.
              </span>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => navigate("detail", goalOpportunity.slug)}>
                {t("common.viewDetails")}
              </Button>
            </div>
          )}
          {plan && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium">{t("journey.progress")}</span>
                <span className="text-muted-foreground">{t("journey.tasksDone", { done: doneCount, total: tasks.length })}</span>
              </div>
              <Progress value={tasks.length ? (doneCount / tasks.length) * 100 : 0} aria-label={t("journey.progress")} />
              {currentPhase && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("journey.phase")}: <span className="font-semibold text-foreground/80">{currentPhase}</span>
                  {plan.infeasible && (
                    <span className="ml-2 font-semibold text-coral">⚠ {t("plan.infeasible")}</span>
                  )}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{t("plan.progressSaved")}</p>
            </div>
          )}
          {goalSlug && (!plan || plan.goalSlug !== goalSlug) && (
            <Button onClick={() => generate()} disabled={generating} className="mt-4 gap-1.5">
              {generating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {plan ? t("plan.replan") : t("plan.generate")}
            </Button>
          )}
          {plan && (
            <Button variant="outline" onClick={() => generate()} disabled={generating} className="mt-4 ml-2 gap-1.5">
              {generating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("plan.regenerate")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Regeneration preview gate */}
      {preview?.requiresConfirmation && preview.plan && (
        <Card className="mb-6 border-sunflower/60 bg-accent">
          <CardContent className="p-5">
            <h2 className="text-base font-semibold">{t("plan.replanPreview")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("plan.replanBody")}</p>
            <ul className="mt-3 max-h-64 overflow-y-auto uraan-scroll flex flex-col gap-1.5 text-sm">
              {preview.plan.tasks.slice(0, 12).map((task) => (
                <li key={task.id} className="flex items-center gap-2">
                  <span className={task.status === "done" ? "text-leaf" : "text-muted-foreground"}>
                    {task.status === "done" ? "✓" : "•"}
                  </span>
                  <span className={task.userEdited ? "font-semibold" : ""}>{task.title}</span>
                  {task.userEdited && <Badge variant="outline" className="text-[10px]">edited</Badge>}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPreview(null)}>{t("common.cancel")}</Button>
              <Button size="sm" onClick={() => generate(true)}>{t("common.confirm")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Next actions */}
        <Card className="border-border/70 bg-card">
          <CardContent className="p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-base font-semibold tracking-tight">
              <ClipboardList className="h-4 w-4 text-leaf" aria-hidden="true" />
              {t("journey.nextActions")}
            </h2>
            {nextActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{plan ? t("common.empty") : t("plan.emptyBody")}</p>
            ) : (
              <ol className="flex flex-col gap-2.5">
                {nextActions.map((task, idx) => (
                  <li key={task.id} className="flex items-start gap-3 rounded-lg border border-border/70 p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{lang === "bn" && task.titleBn ? task.titleBn : task.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {task.dueDate ? `${task.dueDate} · ${task.dateBasis === "official" ? t("plan.officialBasis") : t("plan.estimatedBasis")}` : ""}
                        {task.effortHours ? ` · ${t("plan.effort", { hours: String(Math.round(task.effortHours)) })}` : ""}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 gap-1"
                        onClick={() => completeTask(task.id)}
                      >
                        <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("plan.complete")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {plan && (
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => navigate("calendar")}>
                {t("plan.all")} →
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Gaps */}
        <Card className="border-border/70 bg-card">
          <CardContent className="p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-base font-semibold tracking-tight">
              <ClipboardList className="h-4 w-4 text-coral" aria-hidden="true" />
              {t("journey.gaps")}
            </h2>
            {!evaluation ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted-foreground">{goalOpportunity ? t("detail.runMatch") : t("journey.noGoalBody")}</p>
                {goalOpportunity && (
                  <Button variant="outline" size="sm" onClick={() => navigate("detail", goalSlug!)}>
                    {t("detail.runMatch")}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <ul className="max-h-64 overflow-y-auto uraan-scroll flex flex-col gap-2">
                  {evaluation.results
                    .filter((r) => r.result === "not_met" || r.result === "needs_information" || r.result === "needs_institution_confirmation")
                    .slice(0, 8)
                    .map((r) => (
                      <li key={r.ruleId} className="flex items-start gap-2 text-sm">
                        {r.result === "not_met" ? <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" /> :
                         r.result === "needs_information" ? <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-sunflower" aria-hidden="true" /> :
                         <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />}
                        <span className="leading-snug">
                          {lang === "bn" && r.titleBn ? r.titleBn : r.title}
                        </span>
                      </li>
                    ))}
                  {evaluation.results.filter((r) => r.result === "not_met" || r.result === "needs_information" || r.result === "needs_institution_confirmation").length === 0 && (
                    <li className="text-sm text-muted-foreground">{t("detail.gapEmpty")}</li>
                  )}
                </ul>
                <Separator className="my-3" />
                <Button variant="outline" size="sm" onClick={explain} disabled={explainBusy} className="gap-1.5">
                  {explainBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                  {explainBusy ? t("journey.aiExplaining") : t("journey.aiExplain")}
                </Button>
                {explanation && (
                  <div className="mt-3 rounded-lg bg-accent p-4 text-sm leading-relaxed whitespace-pre-line">
                    {!explanation.aiGenerated && (
                      <p className="mb-2 text-xs font-semibold text-coral">{t("journey.aiTemplateNote")}</p>
                    )}
                    {explanation.text}
                  </div>
                )}
              </>
            )}
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
                  </p>
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("cal.noDates")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {upcoming.map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-2.5 text-sm">
                    <span className="min-w-0 truncate">{lang === "bn" && task.titleBn ? task.titleBn : task.title}</span>
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

        {/* Recent changes */}
        <Card className="border-border/70 bg-card">
          <CardContent className="p-5">
            <h2 className="mb-3 text-base font-semibold tracking-tight">{t("journey.changes")}</h2>
            <p className="text-sm text-muted-foreground">
              {lang === "bn"
                ? "কোনো সূত্র পরিবর্তন এখনো জানানো হয়নি। প্রকাশিত পরিবর্তন এখানে দেখা যাবে।"
                : "No source changes notified yet. Published changes to your target will appear here."}
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
