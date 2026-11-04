"use client";

/**
 * Language tab — honest study log (server-persisted, per-month totals) plus
 * the AI practice exercise. The practice endpoint is public: guests still
 * get real feedback; the study log shows the guest notice instead.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import type { LanguageLogEntry, PracticeFeedback } from "@/lib/types";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, BookCheck, Sparkles, Plus } from "lucide-react";
import { StudentReading } from "../illustrations";
import {
  GuestNotice,
  apiFetch,
  apiSend,
  minutesLabel,
  monthKey,
  monthLabel,
  todayIsoDate,
} from "./shared";

type Skill = LanguageLogEntry["skill"];

const SKILLS: Skill[] = ["reading", "writing", "listening", "speaking", "grammar", "vocab"];

export function LanguageTab() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const user = useAppStore((s) => s.user);

  // ---------- study log ----------
  const [entries, setEntries] = useState<LanguageLogEntry[] | null>(null);
  const [logBusy, setLogBusy] = useState(false);
  const [skill, setSkill] = useState<Skill>("reading");
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");

  const loadEntries = useCallback(async () => {
    if (!user) {
      setEntries(null);
      return;
    }
    try {
      const data = await apiFetch<{ entries: LanguageLogEntry[] }>("/api/language-log");
      setEntries(data.entries);
    } catch {
      setEntries([]);
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }, [user, t, toast]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const addLog = async () => {
    const parsedMinutes = Number(minutes);
    if (!user || !Number.isInteger(parsedMinutes) || parsedMinutes < 1 || parsedMinutes > 600) {
      return;
    }
    setLogBusy(true);
    try {
      await apiSend<{ id: string }>("/api/language-log", "POST", {
        skill,
        minutes: parsedMinutes,
        note: note.trim() || undefined,
        date: todayIsoDate(),
      });
      setMinutes("");
      setNote("");
      await loadEntries();
      toast({ title: t("common.saved") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setLogBusy(false);
    }
  };

  const currentMonth = todayIsoDate().slice(0, 7);
  const monthTotal = useMemo(() => {
    if (!entries) return 0;
    return entries
      .filter((e) => monthKey(e.date) === currentMonth)
      .reduce((sum, e) => sum + e.minutes, 0);
  }, [entries, currentMonth]);

  const grouped = useMemo(() => {
    if (!entries) return [] as { key: string; items: LanguageLogEntry[] }[];
    const map = new Map<string, LanguageLogEntry[]>();
    for (const entry of entries) {
      const key = monthKey(entry.date);
      const bucket = map.get(key);
      if (bucket) bucket.push(entry);
      else map.set(key, [entry]);
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, items]) => ({ key, items }));
  }, [entries]);

  // ---------- practice exercise (public endpoint) ----------
  const [practiceText, setPracticeText] = useState("");
  const [practiceBusy, setPracticeBusy] = useState(false);
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);

  const submitPractice = async () => {
    if (practiceText.trim().length < 20 || practiceBusy) return;
    setPracticeBusy(true);
    try {
      const data = await apiSend<{ feedback: PracticeFeedback }>("/api/ai/practice", "POST", {
        text: practiceText,
        lang,
      });
      setFeedback(data.feedback);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setPracticeBusy(false);
    }
  };

  const practiceTooShort = practiceText.trim().length > 0 && practiceText.trim().length < 20;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Study log — server data */}
      <section aria-labelledby="lang-log-title" className="flex flex-col gap-4">
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-3">
            <CardTitle id="lang-log-title" className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <BookCheck className="h-4 w-4 text-leaf" aria-hidden="true" />
              {t("lang.logTitle")}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {t("lang.title")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!user && <GuestNotice />}

            <form
              className="grid gap-3 sm:grid-cols-[1fr_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                void addLog();
              }}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
                  <Label htmlFor="lang-skill">{t("lang.logSkill")}</Label>
                  <Select value={skill} onValueChange={(v) => setSkill(v as Skill)}>
                    <SelectTrigger id="lang-skill" className="bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SKILLS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`lang.skills.${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lang-minutes">{t("lang.logMinutes")}</Label>
                  <Input
                    id="lang-minutes"
                    type="number"
                    min={1}
                    max={600}
                    inputMode="numeric"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    className="bg-card"
                    aria-required="true"
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
                  <Label htmlFor="lang-note">{t("lang.logNote")}</Label>
                  <Input
                    id="lang-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="bg-card"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={!user || !minutes || logBusy}
                  className="w-full gap-1.5 sm:w-auto"
                >
                  {logBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  )}
                  {t("lang.logAdd")}
                </Button>
              </div>
            </form>

            {user && entries === null && (
              <div className="flex flex-col gap-2" aria-label={t("common.loading")}>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            )}

            {user && entries !== null && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{t("lang.logTotal")}</p>
                  <Badge variant="outline" className="border-leaf/40 bg-accent text-foreground/80">
                    {minutesLabel(monthTotal, lang)}
                  </Badge>
                </div>
                <Separator />
                {entries.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <StudentReading width={140} height={100} aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
                  </div>
                ) : (
                  <ul className="uraan-scroll flex max-h-96 flex-col gap-4 overflow-y-auto pr-1">
                    {grouped.map(({ key, items }) => (
                      <li key={key}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {monthLabel(key, lang)}
                        </p>
                        <ul className="mt-2 flex flex-col gap-2">
                          {items.map((entry) => (
                            <li
                              key={entry.id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-secondary/60 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {t(`lang.skills.${entry.skill}`)}
                                  <span className="ml-2 font-normal text-muted-foreground">
                                    {minutesLabel(entry.minutes, lang)}
                                  </span>
                                </p>
                                {entry.note && (
                                  <p className="truncate text-xs text-muted-foreground">{entry.note}</p>
                                )}
                              </div>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {entry.date}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            <div className="rounded-lg border border-border/70 bg-accent/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("lang.testsTitle")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t("lang.testsBody")}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Practice exercise — works for guests */}
      <section aria-labelledby="lang-practice-title" className="flex flex-col gap-4">
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-3">
            <CardTitle id="lang-practice-title" className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Sparkles className="h-4 w-4 text-sunflower" aria-hidden="true" />
              {t("lang.practiceTitle")}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {t("lang.practiceBody")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <blockquote className="rounded-lg border border-border/70 bg-secondary/60 px-4 py-3 text-sm leading-relaxed text-foreground/85">
              {t("lang.practicePrompt")}
            </blockquote>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lang-practice-text" className="sr-only">
                {t("lang.practiceTitle")}
              </Label>
              <Textarea
                id="lang-practice-text"
                rows={8}
                value={practiceText}
                onChange={(e) => setPracticeText(e.target.value)}
                placeholder={t("lang.practicePrompt")}
                className="bg-card"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {practiceTooShort ? (
                <p className="text-xs text-muted-foreground" role="status">
                  {lang === "bn" ? "কমপক্ষে ২০ অক্ষর লিখুন" : "Write at least 20 characters"}
                </p>
              ) : (
                <span />
              )}
              <Button
                onClick={() => void submitPractice()}
                disabled={practiceText.trim().length < 20 || practiceBusy}
                className="gap-1.5"
              >
                {practiceBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {t("lang.practiceSubmit")}
              </Button>
            </div>

            {feedback && (
              <Card className="border-border/70 bg-secondary/40" aria-live="polite">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold tracking-tight">
                    {t("lang.practiceFeedback")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {feedback.estimatedLevel ? (
                      <>
                        <p className="text-sm text-muted-foreground">{t("lang.practiceEstimate")}</p>
                        <Badge className="bg-primary text-primary-foreground">
                          {feedback.estimatedLevel}
                        </Badge>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {lang === "bn"
                          ? "স্তর অনুমান করা হয়নি — শব্দসংখ্যা থেকে দক্ষতার মান বোঝা যায় না।"
                          : "No level estimated — word counts are not a proficiency measure."}
                      </p>
                    )}
                    {!feedback.aiGenerated && (
                      <Badge variant="outline" className="border-border text-muted-foreground">
                        {lang === "bn" ? "টেমপ্লেট ফিডব্যাক" : "Template feedback"}
                      </Badge>
                    )}
                  </div>
                  {feedback.strengths.length > 0 && (
                    <div>
                      <p className="text-sm font-medium">
                        {lang === "bn" ? "ভালো দিক" : "Strengths"}
                      </p>
                      <ul className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground">
                        {feedback.strengths.map((item, i) => (
                          <li key={i} className="leading-relaxed">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {feedback.improvements.length > 0 && (
                    <div>
                      <p className="text-sm font-medium">
                        {lang === "bn" ? "উন্নতির জায়গা" : "To improve"}
                      </p>
                      <ul className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground">
                        {feedback.improvements.map((item, i) => (
                          <li key={i} className="leading-relaxed">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {feedback.note && (
                    <p className="text-sm leading-relaxed text-foreground/80">{feedback.note}</p>
                  )}
                  <p className="rounded-lg border border-sunflower/50 bg-accent px-3 py-2 text-xs leading-relaxed text-foreground/80">
                    {t("lang.practiceDisclaimer")}
                  </p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
