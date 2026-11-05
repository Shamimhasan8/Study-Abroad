"use client";

/**
 * Contextual mentor rail — a grounded helper beside the study surfaces.
 * Every answer is labelled with its provenance (basis line) and every
 * proposed action is allowlisted and previewed; the mentor never edits the
 * plan directly. Provider outages degrade to an honestly-labelled template
 * answer (aiGenerated: false), never a faked success.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { MentorMascot } from "./mascot";
import type { MentorAction, MentorThreadMessage } from "@/lib/types";
import {
  ArrowRight,
  ArrowUpRight,
  BookCheck,
  Check,
  EyeOff,
  SendHorizontal,
  Trash2,
  X,
} from "lucide-react";

const ACTION_TYPES: readonly MentorAction["type"][] = [
  "open_requirement",
  "open_source",
  "start_task",
  "request_profile_field",
  "propose_task",
  "preview_replan",
];

const STARTERS: { en: string; bn: string }[] = [
  { en: "What should I do today?", bn: "আজ কী করা উচিত?" },
  { en: "Explain my gaps", bn: "আমার ফাঁকগুলো ব্যাখ্যা করুন" },
  { en: "Which documents do I need?", bn: "কোন কোন ডকুমেন্ট লাগবে?" },
];

interface MentorReply {
  content: string;
  basis: string;
  actions: MentorAction[];
  aiGenerated: boolean;
}

/** Boundary parse of the POST response — trust nothing unvalidated. */
function parseReplyData(data: unknown): MentorReply | null {
  if (typeof data !== "object" || data === null) return null;
  const reply = (data as { reply?: unknown }).reply;
  if (typeof reply !== "object" || reply === null) return null;
  const r = reply as Record<string, unknown>;
  if (typeof r.content !== "string" || !r.content.trim()) return null;
  const actions: MentorAction[] = [];
  if (Array.isArray(r.actions)) {
    for (const raw of r.actions.slice(0, 2)) {
      if (typeof raw !== "object" || raw === null) continue;
      const a = raw as Record<string, unknown>;
      if (typeof a.type !== "string") continue;
      if (!ACTION_TYPES.includes(a.type as MentorAction["type"])) continue;
      if (typeof a.label !== "string" || !a.label.trim()) continue;
      actions.push(a as MentorAction);
    }
  }
  return {
    content: r.content,
    basis: typeof r.basis === "string" ? r.basis : "",
    actions,
    aiGenerated: r.aiGenerated === true,
  };
}

function actionIcon(action: MentorAction) {
  return action.type === "open_source" ||
    action.type === "request_profile_field" ||
    action.type === "propose_task" ||
    action.type === "preview_replan" ? (
    <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden="true" />
  ) : (
    <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
  );
}

export function MentorRail() {
  const { t, lang } = useI18n();
  const { toast } = useToast();

  const view = useAppStore((s) => s.view);
  const detailSlug = useAppStore((s) => s.detailSlug);
  const activeTaskId = useAppStore((s) => s.activeTaskId);
  const user = useAppStore((s) => s.user);
  const capabilities = useAppStore((s) => s.capabilities);
  const mentorThread = useAppStore((s) => s.mentorThread);
  const goalSlug = useAppStore((s) => s.goalSlug);
  const plan = useAppStore((s) => s.plan);
  const profile = useAppStore((s) => s.profile);
  const evaluations = useAppStore((s) => s.evaluations);
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  const appendMentorMessage = useAppStore((s) => s.appendMentorMessage);
  const setMentorThread = useAppStore((s) => s.setMentorThread);
  const clearMentorThread = useAppStore((s) => s.clearMentorThread);
  const setMentorContext = useAppStore((s) => s.setMentorContext);
  const setMentorHidden = useAppStore((s) => s.setMentorHidden);
  const navigate = useAppStore((s) => s.navigate);

  const [input, setInput] = useState("");
  const [awaiting, setAwaiting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const prevUserId = useRef<string | null>(null);

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animateEntrance = !reduceMotion && !prefersReduced;

  const offline = capabilities?.liveMentor.available === false;
  const mascotState = awaiting ? "processing" : offline ? "unavailable" : "idle";
  const evaluation = goalSlug ? evaluations[goalSlug] : undefined;
  const targetName = plan?.goalTitle ?? goalSlug;

  // Track which surface the mentor is attached to.
  useEffect(() => {
    const refId =
      view === "detail" ? detailSlug ?? undefined : view === "task" ? activeTaskId ?? undefined : undefined;
    setMentorContext({ view, refId });
  }, [view, detailSlug, activeTaskId, setMentorContext]);

  // Signed-in students load their server history once per account; a
  // sign-out clears the visible thread so one owner's history can never
  // render for the next.
  useEffect(() => {
    const uid = user?.id ?? null;
    if (prevUserId.current !== null && uid === null) clearMentorThread();
    prevUserId.current = uid;
    if (!uid) return;
    let cancelled = false;
    setLoadingHistory(true);
    void (async () => {
      const result = await apiFetch<{ messages: MentorThreadMessage[] }>("/api/ai/mentor");
      if (cancelled) return;
      if (result.ok && Array.isArray(result.data?.messages)) {
        const messages = result.data.messages.filter(
          (m) =>
            m &&
            typeof m.id === "string" &&
            typeof m.content === "string" &&
            (m.role === "user" || m.role === "mentor"),
        );
        setMentorThread(messages);
      }
      if (!cancelled) setLoadingHistory(false);
    })();
    return () => {
      cancelled = true;
      setLoadingHistory(false);
    };
  }, [user?.id]);

  // Keep the newest message in view (real state only — no fake timers).
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mentorThread, awaiting, loadingHistory]);

  /** Honest client-side fallback when the POST itself fails — built ONLY
   * from store facts, never presented as a successful AI reply. */
  const buildOfflineReply = (): MentorThreadMessage => {
    const content =
      lang === "bn"
        ? [
            "এটি একটি টেমপ্লেট উত্তর — মেন্টর সেবায় এখন সংযোগ করা যাচ্ছে না।",
            evaluation
              ? `শর্ত যাচাই: ${evaluation.counts.met} মেটে · ${evaluation.counts.notMet} মেটেনি · ${
                  evaluation.counts.needsInfo + evaluation.counts.needsConfirm
                } নিশ্চিত করতে হবে।`
              : "এখনো কোনো লক্ষ্য যাচাই করা হয়নি — Explore থেকে একটি লক্ষ্য বেছে নিন।",
            "পরের পদক্ষেপ: বিস্তারিত পাতায় ফাঁকগুলো দেখুন এবং প্রোফাইলে অনুপস্থিত তথ্য যোগ করুন।",
          ].join("\n\n")
        : [
            "This is a template answer — the mentor service could not be reached.",
            evaluation
              ? `Requirements checked: ${evaluation.counts.met} met · ${evaluation.counts.notMet} not met · ${
                  evaluation.counts.needsInfo + evaluation.counts.needsConfirm
                } to confirm.`
              : "No target has been checked yet — pick a goal in Explore first.",
            "Next step: review your gaps on the detail page and add the missing profile information.",
          ].join("\n\n");
    return {
      id: `local-${Date.now()}-offline`,
      role: "mentor",
      content,
      basis: evaluation
        ? lang === "bn"
          ? `শর্ত যাচাই: ${evaluation.counts.met} মেটে · ${evaluation.counts.notMet} ফাঁক — আপনার সংরক্ষিত যাচাই থেকে`
          : `Requirements checked: ${evaluation.counts.met} met · ${evaluation.counts.notMet} gaps — from your saved check`
        : undefined,
      actions: evaluation
        ? [{ type: "open_requirement", label: lang === "bn" ? "ফাঁকগুলো দেখুন" : "Review gaps" }]
        : undefined,
      aiGenerated: false,
      createdAt: new Date().toISOString(),
    };
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || awaiting) return;
    setInput("");
    setAwaiting(true);
    const refId =
      view === "detail"
        ? detailSlug ?? undefined
        : view === "task"
          ? activeTaskId ?? undefined
          : goalSlug ?? undefined;

    // Optimistic user turn — the mentor reply is appended only when the
    // server actually answers.
    appendMentorMessage({
      id: `local-${Date.now()}`,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    });

    // Guests ground the mentor on the SAME local facts the deterministic
    // surfaces use (validated server-side; never an authorization source).
    const openTasks = (plan?.tasks ?? []).filter(
      (task) => task.status === "todo" || task.status === "in_progress",
    );
    const nextOpen = [...openTasks].sort((a, b) =>
      (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
    )[0];
    const body: Record<string, unknown> = { message, context: { view, refId }, lang };
    if (!user) {
      if (profile) body.profile = profile;
      if (plan) {
        body.planContext = {
          done: plan.tasks.filter((task) => task.status === "done").length,
          open: openTasks.length,
          ...(nextOpen ? { nextTaskTitle: nextOpen.title, nextTaskStableKey: nextOpen.stableKey } : {}),
        };
      }
    }

    const result = await apiPost<unknown>(
      "/api/ai/mentor",
      body,
      { timeoutMs: 60000 }, // the provider timeout is 45s — don't abort early
    );

    const reply = result.ok ? parseReplyData(result.data) : null;
    if (reply) {
      appendMentorMessage({
        id: `local-${Date.now()}-m`,
        role: "mentor",
        content: reply.content,
        basis: reply.basis || undefined,
        actions: reply.actions,
        aiGenerated: reply.aiGenerated,
        createdAt: new Date().toISOString(),
      });
    } else {
      appendMentorMessage(buildOfflineReply());
      toast({
        title: t("common.error"),
        description:
          lang === "bn"
            ? "মেন্টর সেবা এখন পাওয়া যাচ্ছে না — নিচে টেমপ্লেট উত্তর দেখানো হয়েছে।"
            : "The mentor service is unreachable — a labelled template answer is shown below.",
        variant: "destructive",
      });
    }
    setAwaiting(false);
  };

  const clearThread = async () => {
    setConfirmClear(false);
    if (user) {
      const result = await apiFetch("/api/ai/mentor", { method: "DELETE" });
      if (!result.ok) {
        // Keep the visible thread: the server history is still intact.
        toast({ title: t("common.error"), variant: "destructive" });
        return;
      }
    }
    clearMentorThread();
  };

  const dispatchAction = (action: MentorAction) => {
    switch (action.type) {
      case "open_requirement":
        navigate("detail", goalSlug ?? undefined);
        break;
      case "open_source":
        navigate("sources");
        break;
      case "start_task": {
        // The action may carry a stableKey; mentors only point at tasks.
        const task = action.stableKey
          ? plan?.tasks.find((tk) => tk.stableKey === action.stableKey)
          : undefined;
        if (task) navigate("task", undefined, task.id);
        else navigate("workspace");
        break;
      }
      case "request_profile_field":
        navigate("settings");
        break;
      case "propose_task":
      case "preview_replan":
        // Proposals are reviewed in the workspace — never auto-applied.
        navigate("workspace");
        break;
    }
  };

  const introLine1 = goalSlug
    ? lang === "bn"
      ? `আমি আপনার যাচাই করা তথ্যের ভিত্তিতে উত্তর দিই — এখনকার লক্ষ্য: ${targetName ?? ""}`
      : `I answer from your checked facts — current target: ${targetName ?? ""}`
    : lang === "bn"
      ? "Explore থেকে একটি লক্ষ্য বেছে নিলে আমি তার নথিভুক্ত শর্তের ভিত্তিতে উত্তর দেব।"
      : "Pick a target in Explore and I will ground my answers in its documented requirements.";
  const introLine2 = evaluation
    ? lang === "bn"
      ? `এখন পর্যন্ত ${evaluation.counts.met}টি মেটে · ${evaluation.counts.notMet}টি ফাঁক।`
      : `Checked so far: ${evaluation.counts.met} met · ${evaluation.counts.notMet} gaps.`
    : lang === "bn"
      ? "আমি সময়সীমা বা খরচ বানাই না — অজানা থাকলে বলি।"
      : "I never invent deadlines or costs — unknowns stay unknown.";

  return (
    <aside
      aria-label={lang === "bn" ? "উরান মেন্টর প্যানেল" : "Uraan mentor panel"}
      className="flex h-full flex-col"
    >
      {/* Header: mascot + capability honesty + hide / clear */}
      <header className="flex items-start gap-2.5 border-b border-border/70 p-3">
        <MentorMascot state={mascotState} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">
            {lang === "bn" ? "উরান মেন্টর" : "Uraan Mentor"}
          </p>
          {offline ? (
            <Badge variant="outline" className="mt-1 border-coral/50 px-1.5 py-0 text-[10px] text-coral">
              {lang === "bn" ? "অফলাইন সহায়ক — টেমপ্লেট উত্তর" : "Offline helper — template answers"}
            </Badge>
          ) : (
            <Badge variant="outline" className="mt-1 border-leaf/40 bg-secondary/70 px-1.5 py-0 text-[10px]">
              {lang === "bn" ? "AI-সহায়তা, আপনার তথ্যে ভিত্তিক" : "AI-assisted, grounded on your facts"}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            onClick={() => setMentorHidden(true)}
            aria-label={lang === "bn" ? "মেন্টর লুকান" : "Hide mentor"}
            title={lang === "bn" ? "মেন্টর লুকান" : "Hide mentor"}
          >
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          </Button>
          {confirmClear ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 text-destructive"
                onClick={() => void clearThread()}
                aria-label={lang === "bn" ? "ইতিহাস মুছে ফেলার নিশ্চয়তা" : "Confirm clearing history"}
                title={lang === "bn" ? "নিশ্চিত করুন" : "Confirm"}
              >
                <Check className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                onClick={() => setConfirmClear(false)}
                aria-label={t("common.cancel")}
                title={t("common.cancel")}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={() => setConfirmClear(true)}
              aria-label={lang === "bn" ? "ইতিহাস মুছুন" : "Clear history"}
              title={lang === "bn" ? "ইতিহাস মুছুন" : "Clear history"}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </header>

      {/* Thread */}
      <div ref={threadRef} className="uraan-scroll flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {loadingHistory ? (
          <p className="pt-6 text-center text-xs text-muted-foreground">
            {lang === "bn" ? "আপনার মেন্টর ইতিহাস লোড হচ্ছে…" : "Loading your mentor history…"}
          </p>
        ) : mentorThread.length === 0 ? (
          <div className="flex flex-col items-center gap-3 pt-4 text-center">
            <MentorMascot state="idle" size={56} />
            <div className="rounded-lg border border-border/70 bg-card p-3 text-xs leading-relaxed text-muted-foreground">
              <p>{introLine1}</p>
              <p className="mt-1">{introLine2}</p>
            </div>
            <div className="flex flex-col items-stretch gap-2">
              {STARTERS.map((starter) => (
                <Button
                  key={starter.en}
                  variant="outline"
                  size="sm"
                  className="h-auto rounded-full px-3 py-1 text-xs font-normal"
                  onClick={() => void send(lang === "bn" ? starter.bn : starter.en)}
                >
                  {lang === "bn" ? starter.bn : starter.en}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          mentorThread.map((message) => (
            <motion.div
              key={message.id}
              initial={animateEntrance ? { opacity: 0, y: 10 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`flex max-w-[95%] flex-col ${
                message.role === "mentor" ? "self-start" : "self-end items-end"
              }`}
            >
              <div
                className={`whitespace-pre-line rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  message.role === "mentor"
                    ? "bg-accent text-accent-foreground"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {message.content}
              </div>
              {message.role === "mentor" && (
                <div className="mt-1 flex w-full flex-col items-start gap-1.5">
                  {message.aiGenerated === false && (
                    <p className="text-[10px] font-medium text-coral">
                      {lang === "bn" ? "টেমপ্লেট উত্তর — AI অনুপলব্ধ" : "Template answer — AI unavailable"}
                    </p>
                  )}
                  {message.basis && (
                    <p className="flex items-start gap-1 text-[11px] leading-snug text-muted-foreground">
                      <BookCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                      <span>{message.basis}</span>
                    </p>
                  )}
                  {message.actions && message.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {message.actions.map((action, i) => (
                        <Button
                          key={`${message.id}-action-${i}`}
                          variant="outline"
                          size="sm"
                          className="h-7 max-w-[220px] gap-1 rounded-full px-2.5 text-[11px] font-normal"
                          onClick={() => dispatchAction(action)}
                        >
                          <span className="truncate">{action.label}</span>
                          {actionIcon(action)}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/70 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter newline — but never mid-IME
              // composition (Bangla input methods rely on it).
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder={lang === "bn" ? "মেন্টরকে কিছু জিজ্ঞাসা করুন…" : "Ask your mentor…"}
            aria-label={lang === "bn" ? "মেন্টরকে বার্তা" : "Message the mentor"}
            className="min-h-9 max-h-28 flex-1 resize-none text-sm"
          />
          <Button
            size="icon"
            onClick={() => void send(input)}
            disabled={awaiting || !input.trim()}
            aria-label={lang === "bn" ? "পাঠান" : "Send message"}
          >
            <SendHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
          {lang === "bn"
            ? "উত্তর আপনার প্ল্যানের তথ্য থেকে তৈরি। ব্যক্তিগত ডকুমেন্ট পেস্ট করবেন না।"
            : "Replies are generated from your plan facts. Don't paste private documents."}
        </p>
      </div>
    </aside>
  );
}
