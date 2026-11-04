"use client";

/**
 * Writing workspace — drafts stay the student's own work. Debounced autosave
 * with a visible "Saved" indicator, restorable version history, and AI
 * feedback that flags unsupported claims. When the target programme prohibits
 * AI assistance, feedback is disabled for that draft — never silently sent.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import type { DraftKind, DraftVersion, WritingDraft } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Plus,
  Trash2,
  PenLine,
  History,
  RotateCcw,
  Sparkles,
  Check,
  Lightbulb,
} from "lucide-react";
import { BookStack } from "../illustrations";
import { GuestNotice, apiFetch, apiSend, countWords, formatDateTime } from "./shared";

type AiPolicy = WritingDraft["aiPolicy"];

interface DraftFeedback {
  strengths: string[];
  issues: string[];
  suggestions: string[];
  unsupportedClaims: string[];
  aiGenerated: boolean;
}

const KINDS: DraftKind[] = ["essay", "sop", "research"];
const AI_POLICIES: AiPolicy[] = ["unknown", "allowed", "prohibited"];

const BRAINSTORM: Record<DraftKind, { en: string[]; bn: string[] }> = {
  essay: {
    en: [
      "What is a challenge you have faced, and what did you actually do about it?",
      "Which experience changed how you see the world?",
      "What do you want to build or contribute next?",
    ],
    bn: [
      "আপনি কোন চ্যালেঞ্জের মুখোমুখি হয়েছেন, আর নিজে কী করেছেন?",
      "কোন অভিজ্ঞতা আপনার দৃষ্টিভঙ্গি বদলে দিয়েছে?",
      "এরপর আপনি কী বানাতে বা অবদান রাখতে চান?",
    ],
  },
  sop: {
    en: [
      "Why this field — what sparked the interest, concretely?",
      "What work you have done proves your readiness?",
      "What do you want to do after the programme?",
    ],
    bn: [
      "কেন এই বিষয় — নির্দিষ্ট করে আগ্রহের সূচনা কী?",
      "প্রস্তুতির প্রমাণ হিসেবে আপনি কী কাজ করেছেন?",
      "প্রোগ্রাম শেষে কী করতে চান?",
    ],
  },
  research: {
    en: [
      "What problems do you want training to attack?",
      "What have you read that shaped your questions?",
      "Which methods do you want to learn, and why?",
    ],
    bn: [
      "কোন সমস্যা আক্রমণ করার প্রশিক্ষণ চান?",
      "কী পড়েছেন যা আপনার প্রশ্নগুলো গড়েছে?",
      "কোন পদ্ধতি শিখতে চান, আর কেন?",
    ],
  },
};

export function WritingTab() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const user = useAppStore((s) => s.user);

  const [drafts, setDrafts] = useState<WritingDraft[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editorText, setEditorText] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKind, setNewKind] = useState<DraftKind>("essay");
  const [newTitle, setNewTitle] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newWordLimit, setNewWordLimit] = useState("");
  const [newAiPolicy, setNewAiPolicy] = useState<AiPolicy>("unknown");
  const [creating, setCreating] = useState(false);

  const [feedback, setFeedback] = useState<DraftFeedback | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackBlocked, setFeedbackBlocked] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef<WritingDraft | null>(null);
  const editorRef = useRef("");

  const active = useMemo(
    () => (drafts ?? []).find((d) => d.id === activeId) ?? null,
    [drafts, activeId],
  );

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    editorRef.current = editorText;
  }, [editorText]);

  // Load server drafts (guests keep a local, non-persistent list).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user) {
        if (cancelled) return;
        setDrafts((ds) => (ds === null ? [] : ds));
        return;
      }
      setDrafts(null);
      try {
        const data = await apiFetch<{ drafts: WritingDraft[] }>("/api/writing");
        if (cancelled) return;
        setDrafts(data.drafts);
        const first = data.drafts[0] ?? null;
        setActiveId(first ? first.id : null);
        setEditorText(first ? first.currentContent : "");
      } catch {
        if (cancelled) return;
        setDrafts([]);
        toast({ title: t("common.error"), variant: "destructive" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, t, toast]);

  // Clear the debounce timer on unmount — no state updates after teardown.
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const isLocal = (draft: WritingDraft) => draft.id.startsWith("local-");

  /** Save the active draft's content immediately (server path only). */
  const saveNow = useCallback(
    async (content: string) => {
      const draft = activeRef.current;
      if (!user || !draft || isLocal(draft)) return;
      if (content === draft.currentContent) return;
      setSaveState("saving");
      try {
        const data = await apiSend<{ draft: WritingDraft }>("/api/writing", "POST", {
          id: draft.id,
          kind: draft.kind,
          title: draft.title,
          institutionPrompt: draft.institutionPrompt,
          wordLimit: draft.wordLimit,
          aiPolicy: draft.aiPolicy,
          content,
        });
        setDrafts((ds) => (ds ?? []).map((d) => (d.id === data.draft.id ? data.draft : d)));
        setSaveState("saved");
      } catch {
        setSaveState("idle");
        toast({ title: t("common.error"), variant: "destructive" });
      }
    },
    [user, t, toast],
  );

  /** Debounced autosave — ~1.2s after the last keystroke. */
  const scheduleSave = useCallback(
    (content: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        void saveNow(content);
      }, 1200);
    },
    [saveNow],
  );

  const onEditorChange = (value: string) => {
    setEditorText(value);
    setSaveState("idle");
    if (user && active && !isLocal(active)) scheduleSave(value);
  };

  const selectDraft = (draft: WritingDraft) => {
    if (draft.id === activeId) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      void saveNow(editorRef.current);
    }
    setActiveId(draft.id);
    setEditorText(draft.currentContent);
    setFeedback(null);
    setFeedbackBlocked(false);
    setSaveState("idle");
  };

  const resetDialogForm = () => {
    setNewKind("essay");
    setNewTitle("");
    setNewPrompt("");
    setNewWordLimit("");
    setNewAiPolicy("unknown");
  };

  const createDraft = async () => {
    if (!newTitle.trim() || creating) return;
    const wordLimit = newWordLimit.trim() ? Number(newWordLimit) : undefined;
    if (
      wordLimit !== undefined &&
      (!Number.isInteger(wordLimit) || wordLimit < 50 || wordLimit > 5000)
    ) {
      toast({ title: t("error.validation"), variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      if (user) {
        const data = await apiSend<{ draft: WritingDraft }>("/api/writing", "POST", {
          kind: newKind,
          title: newTitle.trim(),
          institutionPrompt: newPrompt.trim() || undefined,
          wordLimit,
          aiPolicy: newAiPolicy,
          content: "",
        });
        setDrafts((ds) => [data.draft, ...(ds ?? [])]);
        setActiveId(data.draft.id);
        setEditorText("");
        toast({ title: t("common.saved") });
      } else {
        const now = new Date().toISOString();
        const local: WritingDraft = {
          id: `local-${Date.now().toString(36)}`,
          kind: newKind,
          title: newTitle.trim(),
          institutionPrompt: newPrompt.trim() || undefined,
          wordLimit,
          aiPolicy: newAiPolicy,
          currentContent: "",
          versions: [],
          createdAt: now,
          updatedAt: now,
        };
        setDrafts((ds) => [local, ...(ds ?? [])]);
        setActiveId(local.id);
        setEditorText("");
      }
      setFeedback(null);
      setFeedbackBlocked(false);
      setDialogOpen(false);
      resetDialogForm();
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const deleteDraft = async (draft: WritingDraft) => {
    const remaining = (drafts ?? []).filter((d) => d.id !== draft.id);
    if (isLocal(draft)) {
      setDrafts(remaining);
      if (activeId === draft.id) {
        setActiveId(remaining[0]?.id ?? null);
        setEditorText(remaining[0]?.currentContent ?? "");
        setFeedback(null);
      }
      return;
    }
    try {
      await apiFetch<{ deleted: boolean }>(`/api/writing?id=${encodeURIComponent(draft.id)}`, {
        method: "DELETE",
      });
      setDrafts(remaining);
      if (activeId === draft.id) {
        setActiveId(remaining[0]?.id ?? null);
        setEditorText(remaining[0]?.currentContent ?? "");
        setFeedback(null);
        setFeedbackBlocked(false);
      }
      toast({ title: t("docs.deleted") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  /** Replace the textarea with an older version and persist it right away. */
  const restoreVersion = (version: DraftVersion) => {
    setEditorText(version.content);
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (user && active && !isLocal(active)) void saveNow(version.content);
  };

  const requestFeedback = async () => {
    const draft = activeRef.current;
    if (!user || !draft || isLocal(draft) || feedbackBusy) return;
    setFeedbackBusy(true);
    try {
      // Flush pending edits so the server reviews the latest content.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        await saveNow(editorRef.current);
      }
      const data = await apiSend<{ feedback: DraftFeedback }>("/api/ai/draft-feedback", "POST", {
        draftId: draft.id,
        lang,
      });
      setFeedback(data.feedback);
      setFeedbackBlocked(false);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "ai_policy_prohibited" || code === "empty_draft") {
        setFeedbackBlocked(true);
      } else {
        toast({ title: t("common.error"), variant: "destructive" });
      }
    } finally {
      setFeedbackBusy(false);
    }
  };

  const words = countWords(editorText);
  const overBy = active?.wordLimit ? Math.max(0, words - active.wordLimit) : 0;
  const feedbackDisabled =
    !user || !active || isLocal(active) || active.aiPolicy === "prohibited" || feedbackBusy;

  const brainstormQuestions = BRAINSTORM[active?.kind ?? "essay"][lang === "bn" ? "bn" : "en"];

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="write-title">
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle id="write-title" className="flex items-center gap-2 text-base font-semibold tracking-tight">
                  <PenLine className="h-4 w-4 text-leaf" aria-hidden="true" />
                  {t("write.title")}
                </CardTitle>
                <CardDescription className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {t("write.subtitle")}
                </CardDescription>
              </div>
              <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("write.newDraft")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!user && <GuestNotice />}

            {user && drafts === null && (
              <div className="flex flex-col gap-2" aria-label={t("common.loading")}>
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-48 w-full" />
              </div>
            )}

            {drafts !== null && drafts.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <BookStack width={150} height={128} aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
                <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                  {lang === "bn"
                    ? "প্রথম ড্রাফট শুরু করুন — এসে, স্টেটমেন্ট অফ পারপজ, বা রিসার্চ স্টেটমেন্ট।"
                    : "Start your first draft — a personal essay, statement of purpose, or research statement."}
                </p>
              </div>
            )}

            {drafts !== null && drafts.length > 0 && (
              <ul
                className="uraan-scroll flex max-h-96 flex-wrap gap-2 overflow-y-auto pr-1"
                aria-label={t("write.versions")}
              >
                {drafts.map((draft) => (
                  <li key={draft.id}>
                    <div
                      className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 transition-colors ${
                        draft.id === activeId
                          ? "border-leaf/50 bg-secondary"
                          : "border-border/70 bg-card hover:bg-secondary/60"
                      }`}
                    >
                      <button
                        onClick={() => selectDraft(draft)}
                        aria-current={draft.id === activeId ? "true" : undefined}
                        className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm font-medium"
                      >
                        <Badge variant="outline" className="border-border/70 text-[10px] font-medium">
                          {t(`write.kind.${draft.kind}`)}
                        </Badge>
                        <span className="max-w-40 truncate">{draft.title}</span>
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            aria-label={`${t("common.delete")} — ${draft.title}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("common.delete")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {lang === "bn"
                                ? `“${draft.title}” — এই ড্রাফট ও এর সব ভার্সন মুছে যাবে।`
                                : `Delete “${draft.title}” and all of its versions?`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void deleteDraft(draft)}>
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {active && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          {/* Editor */}
          <section aria-label={t("write.editor")}>
            <Card className="border-border/70 bg-card">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{t(`write.kind.${active.kind}`)}</Badge>
                  <CardTitle className="text-base font-semibold tracking-tight">
                    {active.title}
                  </CardTitle>
                  {active.wordLimit && (
                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                      {t("write.wordLimit")}: {active.wordLimit}
                    </Badge>
                  )}
                </div>
                {active.institutionPrompt && (
                  <blockquote className="mt-2 rounded-lg border border-border/70 bg-secondary/60 px-4 py-3 text-sm leading-relaxed text-foreground/85">
                    {active.institutionPrompt}
                  </blockquote>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="write-editor">{t("write.editor")}</Label>
                    {/* Save indicator */}
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                      {saveState === "saving" && (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                          {t("common.saving")}
                        </>
                      )}
                      {saveState === "saved" && (
                        <>
                          <Check className="h-3 w-3 text-leaf" aria-hidden="true" />
                          {t("common.saved")}
                        </>
                      )}
                      {saveState === "idle" && user && !isLocal(active) && t("write.autosave")}
                    </span>
                  </div>
                  <Textarea
                    id="write-editor"
                    rows={14}
                    value={editorText}
                    onChange={(e) => onEditorChange(e.target.value)}
                    className="bg-card leading-relaxed"
                    aria-describedby="write-word-count"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p id="write-word-count" className="text-sm text-muted-foreground">
                    {t("write.wordCount", { count: words })}
                    {overBy > 0 && (
                      <span className="ml-2 font-medium text-destructive">
                        {t("write.overLimit", { count: overBy })}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => void requestFeedback()}
                      disabled={feedbackDisabled}
                      className="gap-1.5"
                    >
                      {feedbackBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                      )}
                      {t("write.getFeedback")}
                    </Button>
                  </div>
                </div>

                {active.aiPolicy === "prohibited" && (
                  <p className="rounded-lg border border-coral/50 bg-accent px-3 py-2 text-xs leading-relaxed text-foreground/80">
                    {t("write.aiPolicy.prohibited")}
                  </p>
                )}
                {!user && (
                  <p className="text-xs text-muted-foreground">
                    {lang === "bn"
                      ? "অতিথি হিসেবে এই ড্রাফট সংরক্ষিত হয় না — কপি করে রাখুন।"
                      : "As a guest this draft is not saved — keep a copy of your text."}
                  </p>
                )}

                {feedbackBlocked && !feedback && (
                  <p className="rounded-lg border border-coral/50 bg-accent px-3 py-2 text-xs leading-relaxed text-foreground/80">
                    {t("write.aiPolicy.prohibited")}
                  </p>
                )}

                {feedback && (
                  <Card className="border-border/70 bg-secondary/40" aria-live="polite">
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-sm font-semibold tracking-tight">
                          {t("write.feedbackTitle")}
                        </CardTitle>
                        {!feedback.aiGenerated && (
                          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                            {lang === "bn" ? "টেমপ্লেট ফিডব্যাক" : "Template feedback"}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                        {t("write.feedbackNote")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      {feedback.strengths.length > 0 && (
                        <FeedbackList
                          title={lang === "bn" ? "ভালো দিক" : "Strengths"}
                          items={feedback.strengths}
                        />
                      )}
                      {feedback.issues.length > 0 && (
                        <FeedbackList
                          title={lang === "bn" ? "সমস্যা" : "Issues"}
                          items={feedback.issues}
                        />
                      )}
                      {feedback.suggestions.length > 0 && (
                        <FeedbackList
                          title={lang === "bn" ? "পরামর্শ" : "Suggestions"}
                          items={feedback.suggestions}
                        />
                      )}
                      {feedback.unsupportedClaims.length > 0 && (
                        <FeedbackList
                          title={lang === "bn" ? "যাচাই দরকার এমন দাবি" : "Claims to verify"}
                          items={feedback.unsupportedClaims}
                        />
                      )}
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Sidebar: version history + brainstorming */}
          <div className="flex flex-col gap-6">
            {user && !isLocal(active) && (
              <section aria-labelledby="write-versions-title">
                <Card className="border-border/70 bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle id="write-versions-title" className="flex items-center gap-2 text-base font-semibold tracking-tight">
                      <History className="h-4 w-4 text-leaf" aria-hidden="true" />
                      {t("write.versions")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {active.versions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
                    ) : (
                      <ul className="uraan-scroll flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
                        {active.versions.map((version) => (
                          <li
                            key={version.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-secondary/40 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(version.createdAt, lang)}
                              </p>
                              <p className="truncate text-sm">
                                {t("write.wordCount", { count: version.wordCount })}
                                {version.note && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    {version.note}
                                  </span>
                                )}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => restoreVersion(version)}
                              className="gap-1.5"
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                              {t("write.restore")}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </section>
            )}

            <section aria-labelledby="write-brainstorm-title">
              <Card className="border-border/70 bg-card">
                <CardHeader className="pb-3">
                  <CardTitle id="write-brainstorm-title" className="flex items-center gap-2 text-base font-semibold tracking-tight">
                    <Lightbulb className="h-4 w-4 text-sunflower" aria-hidden="true" />
                    {t("write.brainstorm")}
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                    {t("write.brainstormHint")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Separator className="mb-3" />
                  <ul className="flex flex-col gap-2">
                    {brainstormQuestions.map((question) => (
                      <li
                        key={question}
                        className="rounded-lg border border-border/70 bg-secondary/40 px-3 py-2 text-sm leading-relaxed text-foreground/80"
                      >
                        {question}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      )}

      {/* New draft dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("write.newDraft")}</DialogTitle>
            <DialogDescription>{t("write.subtitle")}</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void createDraft();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="draft-kind">{t("write.kind")}</Label>
              <Select value={newKind} onValueChange={(v) => setNewKind(v as DraftKind)}>
                <SelectTrigger id="draft-kind" className="bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(`write.kind.${k}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="draft-title">{lang === "bn" ? "শিরোনাম" : "Title"}</Label>
              <Input
                id="draft-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                maxLength={200}
                className="bg-card"
                aria-required="true"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="draft-prompt">{t("write.prompt")}</Label>
              <Textarea
                id="draft-prompt"
                rows={3}
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                maxLength={1000}
                className="bg-card"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="draft-word-limit">{t("write.wordLimit")}</Label>
              <Input
                id="draft-word-limit"
                type="number"
                min={50}
                max={5000}
                inputMode="numeric"
                value={newWordLimit}
                onChange={(e) => setNewWordLimit(e.target.value)}
                className="bg-card"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="draft-ai-policy">{t("write.aiPolicy")}</Label>
              <Select value={newAiPolicy} onValueChange={(v) => setNewAiPolicy(v as AiPolicy)}>
                <SelectTrigger id="draft-ai-policy" className="bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_POLICIES.map((policy) => (
                    <SelectItem key={policy} value={policy}>
                      {policy === "unknown"
                        ? t("write.aiPolicy.unknown")
                        : policy === "allowed"
                          ? lang === "bn"
                            ? "অনুমোদিত — AI ফিডব্যাক চালু"
                            : "Allowed — AI feedback available"
                          : lang === "bn"
                            ? "নিষিদ্ধ"
                            : "Prohibited"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={!newTitle.trim() || creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {t("common.add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-1 flex flex-col gap-1 text-sm leading-relaxed text-muted-foreground">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
