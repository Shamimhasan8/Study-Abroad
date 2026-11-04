"use client";

/**
 * Recommenders — choose, brief, and track the people who will write for you.
 * Uraan never contacts anyone: request messages are drafted for the student's
 * own review, and the integrity note stays visible at all times.
 */
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import type { RecommenderRequest, RecommenderStatus } from "@/lib/types";
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
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { Loader2, Plus, Trash2, Users, MessageSquare, ShieldCheck } from "lucide-react";
import type { TranslationKey } from "@/lib/i18n/en";
import { GuestNotice, apiFetch, apiSend } from "./shared";

const STATUSES: RecommenderStatus[] = [
  "planned",
  "drafted",
  "sent_user",
  "confirmed",
  "declined",
];

// The i18n catalogues key the "sent_user" status as "rec.status.sentUser" —
// map explicitly so the domain union never leaks into stringly-typed calls.
const STATUS_KEY: Record<RecommenderStatus, TranslationKey> = {
  planned: "rec.status.planned",
  drafted: "rec.status.drafted",
  sent_user: "rec.status.sentUser",
  confirmed: "rec.status.confirmed",
  declined: "rec.status.declined",
};

const STATUS_TONE: Record<RecommenderStatus, string> = {
  planned: "border-border/70 text-muted-foreground",
  drafted: "border-sunflower/50 text-foreground/80",
  sent_user: "border-leaf/50 text-foreground/80",
  confirmed: "border-leaf/60 bg-secondary text-foreground",
  declined: "border-coral/50 text-muted-foreground",
};

/** Starter request message the student edits before anything is sent. */
function requestTemplate(name: string, lang: "en" | "bn"): string {
  if (lang === "bn") {
    return `প্রিয় ${name},

আমি বিদেশে স্নাতকোত্তর/গবেষণার আবেদন প্রস্তুত করছি। আপনার অধীনে কাজ করার অভিজ্ঞতা আমার আবেদনের জন্য খুব গুরুত্বপূর্ণ। আপনি কি আমার জন্য একটি রেকমেন্ডেশন চিঠি লিখতে রাজি হবেন?

আপনি রাজি হলে আমি আমার সিভি, ট্রান্সক্রিপ্ট আর আপনার সাথে করা কাজের একটি সারমর্ম পাঠাব। ডেডলাইন ও প্রেরণের নিয়মও জানাব।

বিবেচনার জন্য ধন্যবাদ।`;
  }
  return `Dear ${name},

I am preparing applications for study abroad, and the work I did under your guidance is central to them. Would you be willing to write a letter of recommendation for me?

If you agree, I will share my CV, transcript, and a short summary of the work I did with you, along with the deadlines and how the letter should be submitted.

Thank you for considering this.`;
}

export function RecommendersTab() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const user = useAppStore((s) => s.user);

  const [recommenders, setRecommenders] = useState<RecommenderRequest[] | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [relationship, setRelationship] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  // Per-recommender editable request drafts (working copies, saved via POST).
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftBusy, setDraftBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setRecommenders(null);
      return;
    }
    try {
      const data = await apiFetch<{ recommenders: RecommenderRequest[] }>("/api/recommenders");
      setRecommenders(data.recommenders);
    } catch {
      setRecommenders([]);
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }, [user, t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!user || !name.trim() || addBusy) return;
    setAddBusy(true);
    try {
      await apiSend<{ id: string }>("/api/recommenders", "POST", {
        name: name.trim(),
        role: role.trim() || undefined,
        relationship: relationship.trim() || undefined,
        status: "planned",
      });
      setName("");
      setRole("");
      setRelationship("");
      await load();
      toast({ title: t("common.saved") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setAddBusy(false);
    }
  };

  const patch = async (rec: RecommenderRequest, changes: Partial<RecommenderRequest>) => {
    try {
      await apiSend<{ id: string }>("/api/recommenders", "POST", {
        id: rec.id,
        name: rec.name,
        role: rec.role,
        relationship: rec.relationship,
        status: changes.status ?? rec.status,
        requestDraft: "requestDraft" in changes ? changes.requestDraft : rec.requestDraft,
      });
      await load();
      toast({ title: t("common.saved") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const remove = async (id: string) => {
    try {
      await apiFetch<{ deleted: boolean }>(`/api/recommenders?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (draftingId === id) {
        setDraftingId(null);
        setDraftText("");
      }
      await load();
      toast({ title: t("docs.deleted") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const startDrafting = (rec: RecommenderRequest) => {
    setDraftingId(rec.id);
    setDraftText(rec.requestDraft ?? requestTemplate(rec.name, lang));
  };

  const stopDrafting = () => {
    setDraftingId(null);
    setDraftText("");
  };

  const saveDraftMessage = async (rec: RecommenderRequest) => {
    setDraftBusy(true);
    try {
      await patch(rec, { requestDraft: draftText });
    } finally {
      setDraftBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Add form + integrity note */}
      <section aria-labelledby="rec-add-title" className="flex flex-col gap-4">
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-3">
            <CardTitle id="rec-add-title" className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Users className="h-4 w-4 text-leaf" aria-hidden="true" />
              {t("rec.add")}
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed text-muted-foreground">
              {t("rec.subtitle")}
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
                <Label htmlFor="rec-name">{t("rec.name")}</Label>
                <Input
                  id="rec-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  className="bg-card"
                  aria-required="true"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rec-role">{t("rec.role")}</Label>
                <Input
                  id="rec-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  maxLength={120}
                  className="bg-card"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rec-relationship">{t("rec.relationship")}</Label>
                <Input
                  id="rec-relationship"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  maxLength={240}
                  className="bg-card"
                />
              </div>
              <Button type="submit" disabled={!user || !name.trim() || addBusy} className="gap-1.5">
                {addBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden="true" />
                )}
                {t("rec.add")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Alert className="border-coral/40 bg-accent/70">
          <ShieldCheck className="h-4 w-4 text-coral" aria-hidden="true" />
          <AlertDescription className="text-sm leading-relaxed text-foreground/80">
            {t("rec.integrityNote")}
          </AlertDescription>
        </Alert>
      </section>

      {/* Tracker list */}
      <section aria-labelledby="rec-list-title">
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-3">
            <CardTitle id="rec-list-title" className="text-base font-semibold tracking-tight">
              {t("rec.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!user && (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("common.empty")}</p>
            )}

            {user && recommenders === null && (
              <div className="flex flex-col gap-3" aria-label={t("common.loading")}>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}

            {user && recommenders !== null && recommenders.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("common.empty")}</p>
            )}

            {user && recommenders !== null && recommenders.length > 0 && (
              <ul className="uraan-scroll flex max-h-96 flex-col gap-3 overflow-y-auto pr-1">
                {recommenders.map((rec) => (
                  <li
                    key={rec.id}
                    className="flex flex-col gap-3 rounded-lg border border-border/70 bg-secondary/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug">{rec.name}</p>
                        {rec.role && (
                          <p className="text-xs text-muted-foreground">{rec.role}</p>
                        )}
                        {rec.relationship && (
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {rec.relationship}
                          </p>
                        )}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`${t("common.delete")} — ${rec.name}`}
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
                                ? `${rec.name} — এই রেকমেন্ডার তালিকা থেকে সরাবেন?`
                                : `Remove ${rec.name} from your list?`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void remove(rec.id)}>
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor={`rec-status-${rec.id}`} className="text-xs text-muted-foreground">
                        {t("rec.status")}
                      </Label>
                      <Badge variant="outline" className={`text-xs ${STATUS_TONE[rec.status]}`}>
                        {t(STATUS_KEY[rec.status])}
                      </Badge>
                      <Select
                        value={rec.status}
                        onValueChange={(v) => void patch(rec, { status: v as RecommenderStatus })}
                      >
                        <SelectTrigger
                          id={`rec-status-${rec.id}`}
                          className="h-8 w-44 bg-card text-xs"
                          aria-label={`${t("rec.status")} — ${rec.name}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {t(STATUS_KEY[status])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => (draftingId === rec.id ? stopDrafting() : startDrafting(rec))}
                        className="w-fit gap-1.5"
                        aria-expanded={draftingId === rec.id}
                      >
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("rec.draftMessage")}
                      </Button>

                      {draftingId === rec.id && (
                        <div className="flex flex-col gap-2">
                          <Label htmlFor={`rec-draft-${rec.id}`} className="sr-only">
                            {t("rec.draftMessage")}
                          </Label>
                          <Textarea
                            id={`rec-draft-${rec.id}`}
                            rows={7}
                            value={draftText}
                            onChange={(e) => setDraftText(e.target.value)}
                            maxLength={4000}
                            className="bg-card text-sm leading-relaxed"
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => void saveDraftMessage(rec)}
                              disabled={draftBusy}
                              className="gap-1.5"
                            >
                              {draftBusy && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              )}
                              {t("common.save")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={stopDrafting}
                            >
                              {t("common.close")}
                            </Button>
                          </div>
                        </div>
                      )}

                      {rec.requestDraft && draftingId !== rec.id && (
                        <p className="rounded-lg border border-border/70 bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                          {rec.requestDraft.slice(0, 140)}
                          {rec.requestDraft.length > 140 ? "…" : ""}
                        </p>
                      )}
                    </div>
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
