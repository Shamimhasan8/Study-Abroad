"use client";

/**
 * Experience journal — records what the student actually did: projects, work,
 * community help, family duties, creative work. Kind badges + reflections are
 * first-class; certificates-for-padding is explicitly discouraged.
 */
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import type { ExperienceEntry } from "@/lib/types";
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
import { Loader2, Plus, Trash2, ExternalLink, BookOpen } from "lucide-react";
import { StudentReading } from "../illustrations";
import { GuestNotice, apiFetch, apiSend, formatDate } from "./shared";

type ExpKind = ExperienceEntry["kind"];

const KINDS: ExpKind[] = ["project", "work", "community", "family", "creative"];

interface FormState {
  kind: ExpKind;
  title: string;
  description: string;
  reflection: string;
  startDate: string;
  endDate: string;
  links: string;
}

const EMPTY_FORM: FormState = {
  kind: "project",
  title: "",
  description: "",
  reflection: "",
  startDate: "",
  endDate: "",
  links: "",
};

/** Parse the free-text links field into validated URLs; throws on junk. */
function parseLinks(raw: string): { ok: true; links: string[] } | { ok: false } {
  const parts = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const links: string[] = [];
  for (const part of parts) {
    try {
      const url = new URL(part);
      if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false };
      links.push(part);
    } catch {
      return { ok: false };
    }
  }
  if (links.length > 5) return { ok: false };
  return { ok: true, links };
}

export function ExperienceTab() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const user = useAppStore((s) => s.user);

  const [entries, setEntries] = useState<ExperienceEntry[] | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setEntries(null);
      return;
    }
    try {
      const data = await apiFetch<{ experiences: ExperienceEntry[] }>("/api/experience");
      setEntries(data.experiences);
    } catch {
      setEntries([]);
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }, [user, t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const add = async () => {
    if (!user || !form.title.trim() || !form.description.trim()) return;
    const parsed = parseLinks(form.links);
    if (!parsed.ok) {
      toast({ title: t("error.validation"), variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await apiSend<{ id: string }>("/api/experience", "POST", {
        kind: form.kind,
        title: form.title.trim(),
        description: form.description.trim(),
        reflection: form.reflection.trim() || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        links: parsed.links,
      });
      setForm(EMPTY_FORM);
      await load();
      toast({ title: t("common.saved") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await apiFetch<{ deleted: boolean }>(`/api/experience?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await load();
      toast({ title: t("docs.deleted") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const valid = form.title.trim().length > 0 && form.description.trim().length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Add form */}
      <section aria-labelledby="exp-add-title">
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-3">
            <CardTitle id="exp-add-title" className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Plus className="h-4 w-4 text-leaf" aria-hidden="true" />
              {t("exp.addTitle")}
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed text-muted-foreground">
              {t("exp.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!user && <GuestNotice />}
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void add();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="exp-kind">{t("exp.kind")}</Label>
                <Select value={form.kind} onValueChange={(v) => setField("kind", v as ExpKind)}>
                  <SelectTrigger id="exp-kind" className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {t(`exp.kind.${k}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="exp-title">
                  {lang === "bn" ? "শিরোনাম" : "Title"}
                </Label>
                <Input
                  id="exp-title"
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  maxLength={200}
                  className="bg-card"
                  aria-required="true"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="exp-description">{t("exp.whatYouDid")}</Label>
                <Textarea
                  id="exp-description"
                  rows={4}
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  maxLength={4000}
                  className="bg-card"
                  aria-required="true"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="exp-reflection">{t("exp.reflection")}</Label>
                <Textarea
                  id="exp-reflection"
                  rows={3}
                  value={form.reflection}
                  onChange={(e) => setField("reflection", e.target.value)}
                  maxLength={4000}
                  className="bg-card"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="exp-start">{t("exp.startDate")}</Label>
                  <Input
                    id="exp-start"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setField("startDate", e.target.value)}
                    className="bg-card"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="exp-end">{t("exp.endDate")}</Label>
                  <Input
                    id="exp-end"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setField("endDate", e.target.value)}
                    className="bg-card"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="exp-links">{t("exp.links")}</Label>
                <Input
                  id="exp-links"
                  value={form.links}
                  onChange={(e) => setField("links", e.target.value)}
                  placeholder="https://…"
                  className="bg-card"
                />
                <p className="text-xs text-muted-foreground">
                  {lang === "bn"
                    ? "একাধিক লিংক কমা দিয়ে আলাদা করুন (সর্বোচ্চ ৫টি)"
                    : "Separate multiple links with commas (up to 5)"}
                </p>
              </div>
              <Button type="submit" disabled={!user || !valid || busy} className="gap-1.5">
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden="true" />
                )}
                {t("common.add")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Journal list */}
      <section aria-labelledby="exp-list-title">
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-3">
            <CardTitle id="exp-list-title" className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <BookOpen className="h-4 w-4 text-leaf" aria-hidden="true" />
              {t("exp.title")}
            </CardTitle>
            <Badge variant="outline" className="w-fit max-w-full whitespace-normal break-words border-coral/40 bg-accent text-xs font-normal leading-relaxed text-foreground/75">
              {t("exp.noPadding")}
            </Badge>
          </CardHeader>
          <CardContent>
            {!user && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <StudentReading width={160} height={116} aria-hidden="true" />
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {t("exp.empty")}
                </p>
              </div>
            )}

            {user && entries === null && (
              <div className="flex flex-col gap-3" aria-label={t("common.loading")}>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            )}

            {user && entries !== null && entries.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <StudentReading width={160} height={116} aria-hidden="true" />
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {t("exp.empty")}
                </p>
              </div>
            )}

            {user && entries !== null && entries.length > 0 && (
              <ul className="uraan-scroll flex max-h-96 flex-col gap-3 overflow-y-auto pr-1">
                {entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-lg border border-border/70 bg-secondary/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="font-medium">
                            {t(`exp.kind.${entry.kind}`)}
                          </Badge>
                          <p className="text-sm font-semibold leading-snug">{entry.title}</p>
                        </div>
                        {(entry.startDate || entry.endDate) && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[entry.startDate, entry.endDate].filter(Boolean).join(" – ")}
                          </p>
                        )}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`${t("common.delete")} — ${entry.title}`}
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("common.delete")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {lang === "bn"
                                ? `“${entry.title}” — এই এন্ট্রি সরাবেন?`
                                : `Remove “${entry.title}”?`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void remove(entry.id)}>
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                      {entry.description}
                    </p>
                    {entry.reflection && (
                      <p className="mt-2 border-l-2 border-leaf/50 pl-3 text-sm italic leading-relaxed text-muted-foreground">
                        {entry.reflection}
                      </p>
                    )}
                    {entry.links && entry.links.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {entry.links.map((url) => (
                          <li key={url}>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-leaf underline-offset-4 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              {url.replace(/^https?:\/\//, "").slice(0, 40)}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDate(entry.createdAt, lang)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
