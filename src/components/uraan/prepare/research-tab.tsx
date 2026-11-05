"use client";

/**
 * Research preparation — one saved note: interests, reading log, project
 * summary, faculty-fit worksheet, and an outreach draft the student reviews
 * before anything is ever sent. Debounced autosave + explicit Save button,
 * with a visible saved indicator. Advertised positions ≠ admissions is kept
 * in view at all times.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import type { ReadingLogEntry, ResearchNoteData } from "@/lib/types";
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
import { Loader2, FlaskConical, Plus, Trash2, Check, Save } from "lucide-react";
import { GuestNotice, apiFetch, apiSend, newId } from "./shared";

interface NoteForm {
  interestStatement: string;
  readingLog: ReadingLogEntry[];
  projectSummary: string;
  facultyFitNotes: string;
  outreachDraft: string;
}

const EMPTY_NOTE: NoteForm = {
  interestStatement: "",
  readingLog: [],
  projectSummary: "",
  facultyFitNotes: "",
  outreachDraft: "",
};

export function ResearchTab() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const user = useAppStore((s) => s.user);

  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState<NoteForm>(EMPTY_NOTE);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [saveBusy, setSaveBusy] = useState(false);

  const [paperTitle, setPaperTitle] = useState("");
  const [paperTakeaway, setPaperTakeaway] = useState("");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef(form);
  const loadedRef = useRef(false);
  /** Latest saveNow — lets the unmount cleanup flush a pending autosave. */
  const saveNowRef = useRef<(next: NoteForm) => Promise<void>>(async () => {});
  /** Error title in the CURRENT language — keeps the load effect off `t`
   * deps so a language switch cannot re-run it and reset the form. */
  const errorTitleRef = useRef(t("common.error"));
  useEffect(() => {
    errorTitleRef.current = t("common.error");
  }, [t]);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  // Load the single saved note once per session (guests get a blank form).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user) {
        if (cancelled) return;
        setForm(EMPTY_NOTE);
        setLoaded(true);
        loadedRef.current = false;
        return;
      }
      setLoaded(false);
      try {
        const data = await apiFetch<{ note: ResearchNoteData | null }>("/api/research");
        if (cancelled) return;
        const note = data.note;
        setForm({
          interestStatement: note?.interestStatement ?? "",
          readingLog: note?.readingLog ?? [],
          projectSummary: note?.projectSummary ?? "",
          facultyFitNotes: note?.facultyFitNotes ?? "",
          outreachDraft: note?.outreachDraft ?? "",
        });
        setLoaded(true);
        loadedRef.current = true;
      } catch {
        if (cancelled) return;
        setForm(EMPTY_NOTE);
        setLoaded(true);
        toast({ title: errorTitleRef.current, variant: "destructive" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // `t` is intentionally absent: the load must not re-run on a language
    // switch — re-running reset the form and discarded unsaved input. The
    // toast title stays current via errorTitleRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, toast]);

  // Unmount: flush the pending autosave instead of dropping it. Switching
  // prepare tabs (Radix unmounts inactive content) or leaving the view used
  // to silently discard everything typed since the last debounce window.
  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        void saveNowRef.current(formRef.current);
      }
    },
    [],
  );

  /** PUT the whole note; only called for signed-in users. */
  const saveNow = useCallback(
    async (next: NoteForm) => {
      if (!user || !loadedRef.current) return;
      setSaveState("saving");
      try {
        await apiSend<{ saved: boolean }>("/api/research", "PUT", {
          interestStatement: next.interestStatement.trim() || undefined,
          readingLog: next.readingLog.map((entry) => ({
            id: entry.id,
            title: entry.title,
            takeaway: entry.takeaway?.trim() || undefined,
            addedAt: entry.addedAt,
          })),
          projectSummary: next.projectSummary.trim() || undefined,
          facultyFitNotes: next.facultyFitNotes.trim() || undefined,
          outreachDraft: next.outreachDraft.trim() || undefined,
        });
        setSaveState("saved");
      } catch {
        setSaveState("idle");
        toast({ title: t("common.error"), variant: "destructive" });
      }
    },
    [user, t, toast],
  );

  // Keep the unmount-flush ref pointing at the latest saveNow.
  useEffect(() => {
    saveNowRef.current = saveNow;
  }, [saveNow]);

  /** Any form change: update state and re-arm the debounced autosave. */
  const update = (patch: Partial<NoteForm>) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      if (user && loadedRef.current) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          saveTimer.current = null;
          void saveNow(next);
        }, 1500);
      }
      return next;
    });
  };

  const manualSave = async () => {
    if (!user) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    setSaveBusy(true);
    await saveNow(formRef.current);
    setSaveBusy(false);
  };

  const addPaper = () => {
    if (!paperTitle.trim()) return;
    const entry: ReadingLogEntry = {
      id: newId(),
      title: paperTitle.trim(),
      takeaway: paperTakeaway.trim() || undefined,
      addedAt: new Date().toISOString(),
    };
    update({ readingLog: [...form.readingLog, entry] });
    setPaperTitle("");
    setPaperTakeaway("");
  };

  const removePaper = (id: string) => {
    update({ readingLog: form.readingLog.filter((entry) => entry.id !== id) });
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="research-title">
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle id="research-title" className="flex items-center gap-2 text-base font-semibold tracking-tight">
                  <FlaskConical className="h-4 w-4 text-leaf" aria-hidden="true" />
                  {t("research.title")}
                </CardTitle>
                <CardDescription className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {t("research.subtitle")}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
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
                </span>
                <Button
                  onClick={() => void manualSave()}
                  disabled={!user || saveBusy}
                  className="gap-1.5"
                >
                  {saveBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="h-4 w-4" aria-hidden="true" />
                  )}
                  {t("common.save")}
                </Button>
              </div>
            </div>
            <Badge variant="outline" className="mt-2 w-fit max-w-full whitespace-normal break-words border-leaf/40 bg-accent text-xs font-normal leading-relaxed text-foreground/75">
              {t("research.positionsNote")}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {!user && <GuestNotice />}

            {!loaded && user && (
              <div className="flex flex-col gap-3" aria-label={t("common.loading")}>
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            )}

            {(loaded || !user) && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="research-interest">{t("research.interest")}</Label>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t("research.interestHint")}
                  </p>
                  <Textarea
                    id="research-interest"
                    rows={4}
                    value={form.interestStatement}
                    onChange={(e) => update({ interestStatement: e.target.value })}
                    maxLength={4000}
                    className="bg-card"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">{t("research.reading")}</p>
                  <form
                    className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                    onSubmit={(e) => {
                      e.preventDefault();
                      addPaper();
                    }}
                  >
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="paper-title" className="text-xs text-muted-foreground">
                        {t("research.paperTitle")}
                      </Label>
                      <Input
                        id="paper-title"
                        value={paperTitle}
                        onChange={(e) => setPaperTitle(e.target.value)}
                        maxLength={300}
                        className="bg-card"
                        aria-required="true"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="paper-takeaway" className="text-xs text-muted-foreground">
                        {t("research.paperNote")}
                      </Label>
                      <Input
                        id="paper-takeaway"
                        value={paperTakeaway}
                        onChange={(e) => setPaperTakeaway(e.target.value)}
                        maxLength={1000}
                        className="bg-card"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="submit"
                        variant="outline"
                        disabled={!paperTitle.trim()}
                        className="w-full gap-1.5 sm:w-auto"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {t("research.addPaper")}
                      </Button>
                    </div>
                  </form>

                  {form.readingLog.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
                  ) : (
                    <ul className="uraan-scroll flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
                      {form.readingLog.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-secondary/40 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-snug">{entry.title}</p>
                            {entry.takeaway && (
                              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                                {entry.takeaway}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removePaper(entry.id)}
                            aria-label={`${t("common.remove")} — ${entry.title}`}
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="research-project">{t("research.project")}</Label>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t("research.projectHint")}
                    </p>
                    <Textarea
                      id="research-project"
                      rows={5}
                      value={form.projectSummary}
                      onChange={(e) => update({ projectSummary: e.target.value })}
                      maxLength={4000}
                      className="bg-card"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="research-fit">{t("research.fit")}</Label>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t("research.fitHint")}
                    </p>
                    <Textarea
                      id="research-fit"
                      rows={5}
                      value={form.facultyFitNotes}
                      onChange={(e) => update({ facultyFitNotes: e.target.value })}
                      maxLength={8000}
                      className="bg-card"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="research-outreach">{t("research.outreach")}</Label>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t("research.outreachHint")}
                  </p>
                  <Textarea
                    id="research-outreach"
                    rows={6}
                    value={form.outreachDraft}
                    onChange={(e) => update({ outreachDraft: e.target.value })}
                    maxLength={4000}
                    className="bg-card"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
