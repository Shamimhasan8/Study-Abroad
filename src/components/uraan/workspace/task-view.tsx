"use client";

/**
 * TaskView — the guided work screen for ONE task of the active plan (Gate 2e).
 *
 * Design intent: a student completes USEFUL WORK here rather than merely
 * checking a box — working notes with debounced autosave, per-category
 * completion criteria as honest guidance (never stored state), evidence and
 * tool hand-offs into the Prepare workspace, and a persist-first completion
 * flow identical to the journey view.
 *
 * Draft-safety contract:
 * - Notes autosave 800ms after typing stops. Guests persist locally through
 *   patchTask; signed-in users POST /api/plan/task FIRST and patch the store
 *   only after the server confirms.
 * - Every keystroke mirrors the draft to localStorage
 *   (`uraan.taskDraft.<taskId>`); the key is cleared once the draft is
 *   durably saved. On mount a LONGER local draft beats the stored notes and
 *   is restored with an honest notice — so a reload during an outage (or a
 *   navigation before the debounce fired) can never silently destroy typed
 *   work. A failed server save never reverts the textarea; it raises an
 *   inline banner with a real Retry action instead.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useI18n, localizeDigits } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import { useAppStore, type PrepareTab } from "@/lib/store";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { deadlineLabel } from "@/lib/dates";
import type { PlanTask, TaskCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ToastAction } from "@/components/ui/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PaperPlaneFlight } from "@/components/uraan/illustrations";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CircleCheck,
  CircleHelp,
  ClipboardCheck,
  Lightbulb,
  Loader2,
  Paperclip,
  Undo2,
  Wrench,
} from "lucide-react";

// ---------- Static guidance (never stored state) ----------

/** Mirrors the server-side taskPatchSchema notes cap. */
const NOTES_MAX = 1000;
const AUTOSAVE_DEBOUNCE_MS = 800;
const SAVED_FADE_MS = 1500;

/**
 * Category badge colours — sage, coral, leaf-green, sunflower… Decorative
 * identity only: the label text (plan.task.*) always carries the meaning.
 */
const CATEGORY_BADGE: Record<TaskCategory, string> = {
  language: "border-transparent bg-secondary text-secondary-foreground",
  tests: "border-coral/30 bg-coral/10 text-coral",
  academic: "border-leaf/30 bg-leaf/10 text-leaf",
  experience: "border-leaf/25 bg-leaf/10 text-leaf",
  writing: "border-sunflower/50 bg-sunflower/20 text-foreground/80",
  recommenders: "border-deep/20 bg-deep/10 text-deep",
  funding: "border-sunflower/60 bg-sunflower/25 text-foreground/85",
  documents: "border-border bg-secondary/70 text-secondary-foreground",
  research: "border-leaf/30 bg-leaf/15 text-leaf",
  logistics: "border-coral/25 bg-coral/15 text-coral",
};

const CATEGORY_LABEL_KEY: Record<TaskCategory, TranslationKey> = {
  language: "plan.task.language",
  tests: "plan.task.tests",
  academic: "plan.task.academic",
  experience: "plan.task.experience",
  writing: "plan.task.writing",
  recommenders: "plan.task.recommenders",
  funding: "plan.task.funding",
  documents: "plan.task.documents",
  research: "plan.task.research",
  logistics: "plan.task.logistics",
};

/** Category → Prepare tool routing for the "Open related tool" hand-off. */
const CATEGORY_TOOL: Record<TaskCategory, PrepareTab> = {
  language: "language",
  tests: "language",
  writing: "writing",
  recommenders: "recommenders",
  research: "research",
  academic: "experience",
  experience: "experience",
  documents: "documents",
  funding: "documents", // no funding tab exists — documents is the evidence home
  logistics: "documents", // no dedicated logistics tool; documents holds sources
};

/**
 * Completion criteria — static per-category guidance rendered as a
 * checklist. These describe what "done" means for honest work; they are NOT
 * stored or tracked anywhere.
 */
const CRITERIA: Record<TaskCategory, { en: string[]; bn: string[] }> = {
  language: {
    en: [
      "Named the exact test and target score for my route",
      "Booked or scheduled a practice or diagnostic session",
      "Logged at least one study session with minutes",
    ],
    bn: [
      "আমার রুটের জন্য সঠিক পরীক্ষা ও লক্ষ্য স্কোর লিখেছি",
      "একটি প্র্যাকটিস বা ডায়াগনস্টিক সেশন বুক বা নির্ধারণ করেছি",
      "মিনিটসহ অন্তত একটি স্টাডি সেশন লগ করেছি",
    ],
  },
  tests: {
    en: [
      "Written my target score for each required test",
      "Noted the registration date and fee",
      "Chosen at least one prep book or course",
    ],
    bn: [
      "প্রতিটি প্রয়োজনীয় টেস্টের লক্ষ্য স্কোর লিখেছি",
      "রেজিস্ট্রেশনের তারিখ ও ফি নোট করেছি",
      "অন্তত একটি প্রস্তুতির বই বা কোর্স বেছে নিয়েছি",
    ],
  },
  academic: {
    en: [
      "Listed every transcript or credential I need",
      "Copied each credential's exact official name",
      "Noted who issues each document and how long it takes",
    ],
    bn: [
      "আমার প্রয়োজনীয় প্রতিটি ট্রান্সক্রিপ্ট বা সনদের তালিকা করেছি",
      "প্রতিটি সনদের সরকারি নাম হুবহু লিখেছি",
      "কে কোন ডকুমেন্ট দেয় এবং কত সময় লাগে তা নোট করেছি",
    ],
  },
  experience: {
    en: [
      "Chosen one activity or project to document",
      "Written what I actually did, in my own words",
      "Added a reflection on what I learned",
    ],
    bn: [
      "নথিভুক্ত করার জন্য একটি কার্যক্রম বা প্রজেক্ট বেছে নিয়েছি",
      "আমি আসলে কী করেছি তা নিজের ভাষায় লিখেছি",
      "কী শিখেছি তার একটি রিফ্লেকশন যোগ করেছি",
    ],
  },
  writing: {
    en: [
      "Captured the exact essay or SOP prompt",
      "Written an outline before drafting",
      "Drafted at least 400 words",
    ],
    bn: [
      "প্রবন্ধ বা SOP-এর সঠিক প্রম্পট সংগ্রহ করেছি",
      "খসড়া লেখার আগে একটি আউটলাইন লিখেছি",
      "অন্তত ৪০০ শব্দের খসড়া লিখেছি",
    ],
  },
  recommenders: {
    en: [
      "Shortlisted two or three possible recommenders",
      "Noted each person's role and my relationship to them",
      "Started a draft of the request message",
    ],
    bn: [
      "দুই বা তিনজন সম্ভাব্য রেকমেন্ডার বেছে নিয়েছি",
      "প্রত্যেকের ভূমিকা ও আমার সাথে তাঁর সম্পর্ক নোট করেছি",
      "অনুরোধ বার্তার একটি খসড়া শুরু করেছি",
    ],
  },
  funding: {
    en: [
      "Listed the cost lines for my target",
      "Read at least one funding source in full",
      "Noted what the funding does and does not cover",
    ],
    bn: [
      "আমার লক্ষ্যের খরচের খাতগুলো তালিকা করেছি",
      "অন্তত একটি ফান্ডিং সূত্র পুরোপুরি পড়েছি",
      "কোন ফান্ডিং কী কভার করে আর কী করে না তা নোট করেছি",
    ],
  },
  documents: {
    en: [
      "Identified the exact document type required",
      "Noted the office or website that issues it",
      "Checked whether a certified or attested copy is needed",
    ],
    bn: [
      "প্রয়োজনীয় ডকুমেন্টের সঠিক ধরন চিহ্নিত করেছি",
      "কোন অফিস বা ওয়েবসাইট এটি দেয় তা নোট করেছি",
      "সার্টিফাইড বা অ্যাটেস্টেড কপি লাগবে কি না যাচাই করেছি",
    ],
  },
  research: {
    en: [
      "Logged at least two papers or articles",
      "Written a one-line takeaway for each",
      "Noted which faculty or research group they connect to",
    ],
    bn: [
      "অন্তত দুটি পেপার বা নিবন্ধ লগ করেছি",
      "প্রতিটির জন্য এক লাইনের টেকঅওয়ে লিখেছি",
      "এগুলো কোন ফ্যাকাল্টি বা রিসার্চ গ্রুপের সাথে যুক্ত তা নোট করেছি",
    ],
  },
  logistics: {
    en: [
      "Opened the official page for this question",
      "Recorded the answer with the date I checked",
      "Noted whom to contact if the answer is unclear",
    ],
    bn: [
      "এই প্রশ্নের সরকারি পেজ খুলে দেখেছি",
      "যাচাই করার তারিখসহ উত্তর লিখে রেখেছি",
      "উত্তর অস্পষ্ট হলে কার সাথে যোগাযোগ করব তা নোট করেছি",
    ],
  },
};

// ---------- Screen ----------

export function TaskView() {
  const { lang } = useI18n();
  const activeTaskId = useAppStore((s) => s.activeTaskId);
  const plan = useAppStore((s) => s.plan);
  const navigate = useAppStore((s) => s.navigate);

  const task = plan?.tasks.find((x) => x.id === activeTaskId);

  // Honest empty state: deep link, regenerated plan, or stale task id.
  if (!task) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 text-center sm:px-6">
        <CircleHelp className="mx-auto h-10 w-10 text-muted-foreground/70" aria-hidden="true" />
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
          {lang === "bn"
            ? "এই কাজটি আর আপনার পরিকল্পনার অংশ নয়"
            : "This task is no longer part of your plan"}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {lang === "bn"
            ? "সম্ভবত পরিকল্পনাটি নতুন করে তৈরি হয়েছে — বর্তমান পরিকল্পনা দেখতে ওয়ার্কস্পেসে ফিরে যান।"
            : "Your plan may have been regenerated — head back to the workspace to see the current one."}
        </p>
        <Button className="mt-6 h-11 gap-1.5" onClick={() => navigate("workspace")}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {lang === "bn" ? "ওয়ার্কস্পেসে ফিরে যান" : "Back to workspace"}
        </Button>
      </main>
    );
  }

  // Keying by task id resets all work-area state when the student jumps to
  // another task (e.g. the "Next" button) — no notes bleed between tasks.
  return <TaskScreen key={task.id} task={task} />;
}

export default TaskView;

function TaskScreen({ task }: { task: PlanTask }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const user = useAppStore((s) => s.user);
  const plan = useAppStore((s) => s.plan);
  const navigate = useAppStore((s) => s.navigate);
  const patchTask = useAppStore((s) => s.patchTask);
  const setPrepareTab = useAppStore((s) => s.setPrepareTab);

  const notesId = useId();
  const draftKey = `uraan.taskDraft.${task.id}`;

  const [notes, setNotes] = useState(task.notes ?? "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [saveError, setSaveError] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [fly, setFly] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  /** Last value known to be durably persisted (store + server). */
  const savedNotesRef = useRef(task.notes ?? "");
  /** Monotonic sequence — a stale save response can never clobber a newer one. */
  const saveSeqRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const writeDraft = (value: string) => {
    try {
      window.localStorage.setItem(draftKey, value);
    } catch {
      /* storage unavailable (private mode) — in-memory draft still works */
    }
  };
  const clearDraft = () => {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  };

  /** "Saved ✓" lingers briefly, then fades — no constant spinners. */
  const scheduleSavedFade = useCallback(() => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => setSaveStatus("idle"), SAVED_FADE_MS);
  }, []);

  const performSave = useCallback(
    async (value: string, opts?: { force?: boolean }) => {
      // A stale debounce timer (already superseded by a flush inside
      // completeTask) must not re-send identical notes.
      if (!opts?.force && value === savedNotesRef.current) return;
      writeDraft(value);
      const seq = ++saveSeqRef.current;
      setSaveError(false);
      setSaveStatus("saving");
      if (!user) {
        // Guest: the local plan IS the durable store for this browser.
        patchTask(task.id, { notes: value, userEdited: true });
        savedNotesRef.current = value;
        clearDraft();
        setSaveStatus("saved");
        scheduleSavedFade();
        setRestoredDraft(false);
        return;
      }
      const result = await apiPost("/api/plan/task", {
        taskId: task.id,
        notes: value,
        userEdited: true,
      });
      if (seq !== saveSeqRef.current) return; // a newer save superseded this one
      if (result.ok) {
        patchTask(task.id, { notes: value, userEdited: true });
        savedNotesRef.current = value;
        clearDraft();
        setSaveStatus("saved");
        scheduleSavedFade();
        setRestoredDraft(false);
      } else {
        // Keep the draft in the textarea (never revert). The localStorage
        // mirror written above preserves it across reloads during the outage.
        setSaveStatus("idle");
        setSaveError(true);
      }
    },
    [user, task.id, patchTask, scheduleSavedFade],
  );

  // Draft recovery on mount: a LONGER local draft (typed during an outage or
  // before the debounce fired) beats the stored notes — restore it honestly.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw !== null && raw.length > (task.notes ?? "").length) {
        setNotes(raw);
        setRestoredDraft(true);
      }
    } catch {
      /* storage unavailable — keep the stored notes */
    }
    // Mount-only by design: task identity is pinned by the keyed remount,
    // so this runs exactly once per task screen.
  }, []);

  // Debounced autosave — fires 800ms after typing stops.
  useEffect(() => {
    if (notes === savedNotesRef.current) return;
    const timer = setTimeout(() => void performSave(notes), AUTOSAVE_DEBOUNCE_MS);
    saveTimerRef.current = timer;
    return () => clearTimeout(timer);
  }, [notes, performSave]);

  // Clear pending timers on unmount (navigation before the debounce fires
  // relies on the localStorage draft, which restore-on-mount recovers).
  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    },
    [],
  );

  const onNotesChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setNotes(value);
    writeDraft(value); // reload-safe even before the debounced save fires
  };

  const completeTask = async () => {
    // Cancel any pending autosave; pending notes ride along in the SAME
    // server patch so nothing typed in the final seconds is lost.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveSeqRef.current += 1; // supersede any in-flight notes-only save
    const pendingNotes = notes !== savedNotesRef.current ? notes : null;
    const patch: { status: "done"; notes?: string; userEdited?: boolean } = { status: "done" };
    if (pendingNotes !== null) {
      patch.notes = pendingNotes;
      patch.userEdited = true;
    }
    setBusy(true);
    try {
      if (user) {
        // Signed-in: persist first, celebrate only after the server confirms.
        const result = await apiPost("/api/plan/task", { taskId: task.id, ...patch });
        if (!result.ok) {
          // The seq bump above superseded any in-flight notes save — its
          // response will early-return, so reset the status line here.
          setSaveStatus("idle");
          toast({
            title: t("common.error"),
            description: t("journey.taskRetry"),
            variant: "destructive",
            action: (
              <ToastAction altText={t("common.retry")} onClick={() => void completeTask()}>
                {t("common.retry")}
              </ToastAction>
            ),
          });
          return;
        }
      }
      patchTask(task.id, patch);
      if (pendingNotes !== null) {
        savedNotesRef.current = pendingNotes;
        clearDraft();
      }
      setSaveError(false);
      setSaveStatus("idle");
      setFly(true);
      setTimeout(() => setFly(false), 1400);
    } finally {
      setBusy(false);
    }
  };

  const undoTask = async () => {
    setBusy(true);
    try {
      if (user) {
        const result = await apiPost("/api/plan/task", { taskId: task.id, status: "todo" });
        if (!result.ok) {
          toast({
            title: t("common.error"),
            description: t("journey.taskRetry"),
            variant: "destructive",
            action: (
              <ToastAction altText={t("common.retry")} onClick={() => void undoTask()}>
                {t("common.retry")}
              </ToastAction>
            ),
          });
          return;
        }
      }
      patchTask(task.id, { status: "todo" });
    } finally {
      setBusy(false);
    }
  };

  /** Marking done with empty notes nudges (never blocks) toward a note. */
  const requestComplete = () => {
    if (!notes.trim()) {
      setConfirmOpen(true);
      return;
    }
    void completeTask();
  };

  const nextTask = useMemo(() => {
    const open = (plan?.tasks ?? []).filter(
      (x) => x.id !== task.id && (x.status === "todo" || x.status === "in_progress"),
    );
    return open.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))[0];
  }, [plan, task.id]);

  const criteria = CRITERIA[task.category][lang];
  const statusLine =
    saveStatus === "saving"
      ? t("common.saving")
      : saveStatus === "saved"
        ? t("common.saved")
        : "";
  const nextTitle =
    nextTask && lang === "bn" && nextTask.titleBn ? nextTask.titleBn : nextTask?.title;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      {/* Breadcrumb row */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-11 gap-1.5 px-2.5 sm:h-8"
          onClick={() => navigate("workspace")}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("common.back")}
        </Button>
        <Badge variant="outline" className={CATEGORY_BADGE[task.category]}>
          {t(CATEGORY_LABEL_KEY[task.category])}
        </Badge>
      </div>

      {/* Header */}
      <header className="mb-6">
        <h1 className="flex items-start gap-2 font-display text-[26px] font-bold tracking-tight sm:text-3xl">
          <span className="min-w-0">
            {lang === "bn" && task.titleBn ? task.titleBn : task.title}
          </span>
          {fly && <PaperPlaneFlight width={30} height={30} className="mt-1 shrink-0" />}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          {task.dueDate && (
            <span className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 text-leaf" aria-hidden="true" />
              {lang === "bn" ? "শেষ তারিখ" : "Due"} {deadlineLabel("date", task.dueDate, lang)}
            </span>
          )}
          {task.dueDate && (
            <Badge
              variant="outline"
              className={
                task.dateBasis === "official"
                  ? "border-leaf/50 bg-leaf/10 text-leaf"
                  : "text-muted-foreground"
              }
            >
              {task.dateBasis === "official" ? t("plan.officialBasis") : t("plan.estimatedBasis")}
            </Badge>
          )}
          {task.effortHours
            ? t("plan.effort", { hours: localizeDigits(Math.round(task.effortHours), lang) })
            : null}
          {task.status === "done" && (
            <Badge variant="outline" className="gap-1 border-leaf/40 bg-leaf/10 text-leaf">
              <CircleCheck className="h-3 w-3" aria-hidden="true" />
              {t("plan.completed")}
            </Badge>
          )}
          {task.status === "in_progress" && (
            <Badge variant="outline" className="border-sunflower/50 bg-sunflower/20 text-foreground/80">
              {lang === "bn" ? "চলমান" : "In progress"}
            </Badge>
          )}
        </div>
      </header>

      {/* Why this matters */}
      <Card className="mb-6 border-border/70 bg-accent">
        <CardContent className="p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
            <Lightbulb className="h-4 w-4 text-sunflower" aria-hidden="true" />
            {lang === "bn" ? "কেন এটি গুরুত্বপূর্ণ" : "Why this matters"}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">
            {lang === "bn" && task.purposeBn ? task.purposeBn : task.purpose}
          </p>
        </CardContent>
      </Card>

      {/* Work area — the core of the screen */}
      <Card className="mb-6 border-border/70 bg-card">
        <CardContent className="p-5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={notesId} className="text-sm font-semibold tracking-tight">
              {lang === "bn" ? "আপনার কাজের নোট" : "Your working notes"}
            </label>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {localizeDigits(notes.length, lang)} / {localizeDigits(NOTES_MAX, lang)}
            </span>
          </div>
          <Textarea
            id={notesId}
            ref={textareaRef}
            value={notes}
            onChange={onNotesChange}
            maxLength={NOTES_MAX}
            className="mt-2 min-h-[160px]"
            placeholder={
              lang === "bn"
                ? "কী করলেন, কী পেলেন, কোথায় আটকে আছেন — ভবিষ্যতের আপনি এটাই পড়বেন।"
                : "What you did, what you found, where you're stuck — future-you will read this."
            }
          />

          {restoredDraft && (
            <p
              role="status"
              className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <CircleCheck className="h-3.5 w-3.5 shrink-0 text-leaf" aria-hidden="true" />
              {lang === "bn"
                ? "এই ডিভাইস থেকে একটি অসংরক্ষিত খসড়া ফিরিয়ে আনা হয়েছে"
                : "Restored an unsaved draft from this device"}
            </p>
          )}

          {saveError && (
            <div
              role="status"
              className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-sunflower/60 bg-accent px-3 py-2.5 text-sm"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-sunflower" aria-hidden="true" />
              <span className="min-w-0 flex-1 leading-snug">
                {lang === "bn"
                  ? "স্থানীয়ভাবে সংরক্ষিত — সার্ভারে পৌঁছানো যায়নি। আপনার খসড়া এখানে নিরাপদ আছে।"
                  : "Saved locally — couldn't reach the server. Your draft is safe here."}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => void performSave(notes, { force: true })}
              >
                {t("common.retry")}
              </Button>
            </div>
          )}

          <p
            aria-live="polite"
            className="mt-1.5 flex h-4 items-center justify-end gap-1 text-xs text-muted-foreground"
          >
            {saveStatus === "saved" && (
              <>
                <Check className="h-3.5 w-3.5 text-leaf" aria-hidden="true" />
                {statusLine}
              </>
            )}
            {saveStatus === "saving" && statusLine}
          </p>
        </CardContent>
      </Card>

      {/* Completion criteria — guidance, never stored state */}
      <Card className="mb-6 border-border/70 bg-card">
        <CardContent className="p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
            <ClipboardCheck className="h-4 w-4 text-leaf" aria-hidden="true" />
            {lang === "bn" ? "সম্পন্নের মানদণ্ড" : "Completion criteria"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {lang === "bn"
              ? "আপনার কাজ পরিচালনার জন্য একটি চেকলিস্ট"
              : "A checklist to guide your work"}
          </p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {criteria.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf/70" aria-hidden="true" />
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Evidence & related tools */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="h-11 gap-1.5 sm:h-8"
          onClick={() => {
            setPrepareTab("documents");
            navigate("prepare");
          }}
        >
          <Paperclip className="h-4 w-4" aria-hidden="true" />
          {lang === "bn" ? "প্রমাণ সংযুক্ত করুন" : "Attach evidence"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-11 gap-1.5 sm:h-8"
          onClick={() => {
            setPrepareTab(CATEGORY_TOOL[task.category]);
            navigate("prepare");
          }}
        >
          <Wrench className="h-4 w-4" aria-hidden="true" />
          {lang === "bn" ? "সম্পর্কিত টুল খুলুন" : "Open related tool"}
        </Button>
      </div>

      {/* Next step */}
      <Card className="mb-6 border-border/70 bg-card">
        <CardContent className="p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
            <ArrowRight className="h-4 w-4 text-leaf" aria-hidden="true" />
            {lang === "bn" ? "পরবর্তী ধাপ" : "Next step"}
          </h2>
          {nextTask ? (
            <Button
              variant="outline"
              className="mt-3 h-11 w-full max-w-full justify-start gap-1.5 sm:w-auto"
              onClick={() => navigate("task", undefined, nextTask.id)}
            >
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">
                {lang === "bn" ? "পরবর্তী:" : "Next:"} {nextTitle}
              </span>
            </Button>
          ) : (
            <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-leaf/10 p-3.5">
              <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-leaf" aria-hidden="true" />
              <p className="text-sm leading-relaxed">
                {lang === "bn"
                  ? "সব খোলা কাজ শেষ। আগামীকাল আবার দেখুন বা নতুন করে পরিকল্পনা করুন।"
                  : "All open work is done. Revisit tomorrow or replan."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completion */}
      {task.status === "done" ? (
        <Button
          variant="outline"
          size="lg"
          className="h-11 w-full gap-1.5 sm:w-auto"
          onClick={() => void undoTask()}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Undo2 className="h-4 w-4" aria-hidden="true" />
          )}
          {t("plan.undo")}
        </Button>
      ) : (
        <Button
          size="lg"
          className="h-11 w-full gap-1.5 sm:w-auto"
          onClick={requestComplete}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CircleCheck className="h-4 w-4" aria-hidden="true" />
          )}
          {t("plan.complete")}
        </Button>
      )}

      {/* Empty-notes nudge — gentle, never a hard block */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lang === "bn" ? "নোট ছাড়াই সম্পন্ন করবেন?" : "Mark done without a note?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "bn"
                ? "নোট ছাড়া ভবিষ্যতের আপনি জানতে পারবেন না কী করা হয়েছিল। একটি নোট যোগ করবেন?"
                : "Without a note, future-you won't know what was done. Add one?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                // Focus lands back on the notes textarea once the dialog closes.
                window.setTimeout(() => textareaRef.current?.focus(), 80);
              }}
            >
              {lang === "bn" ? "নোট যোগ করুন" : "Add note"}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => void completeTask()}>
              {lang === "bn" ? "তবুও সম্পন্ন করুন" : "Mark done anyway"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
