"use client";

/**
 * Applications — self-reported tracking through real states.
 * Guests keep applications locally; signed-in users sync via the API.
 */
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import type { ApplicationRecord, ApplicationStatus } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const STATUS_ORDER: ApplicationStatus[] = ["draft", "preparing", "ready", "submitted", "awaiting", "closed"];

export function ApplicationsView() {
  const { t, lang } = useI18n();
  const { applications, upsertApplication, removeApplication, shortlist, user, navigate } = useAppStore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [intake, setIntake] = useState("");
  const [notes, setNotes] = useState("");

  const statusKey = (status: ApplicationStatus) =>
    status === "draft" ? "apps.status.draft" :
    status === "preparing" ? "apps.status.preparing" :
    status === "ready" ? "apps.status.ready" :
    status === "submitted" ? "apps.status.submitted" :
    status === "awaiting" ? "apps.status.awaiting" : "apps.status.closed";

  const syncAdd = async (app: { opportunitySlug: string; opportunityTitle: string; intendedIntake?: string; notes?: string }) => {
    if (!user) return; // guests persist via store only
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...app, status: "draft" }),
      });
      const json = await res.json();
      if (json.ok) upsertApplication(json.data.application as ApplicationRecord);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const syncStatus = async (id: string, status: ApplicationStatus) => {
    if (!user) return;
    try {
      await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
    } catch {
      /* keep optimistic local state */
    }
  };

  const syncDelete = async (id: string) => {
    if (!user) return;
    try {
      await fetch(`/api/applications?id=${id}`, { method: "DELETE" });
    } catch {
      /* ignore */
    }
  };

  const add = async () => {
    if (!slug.trim() || !title.trim()) return;
    // Dedupe guard: never track the same opportunity twice.
    if (applications.some((a) => a.opportunitySlug === slug.trim())) {
      toast({ title: lang === "bn" ? "এই সুযোগটি আগেই ট্র্যাক করা আছে" : "This opportunity is already tracked" });
      setDialogOpen(false);
      return;
    }
    const app = {
      opportunitySlug: slug.trim(),
      opportunityTitle: title.trim(),
      intendedIntake: intake || undefined,
      notes: notes || undefined,
    };
    const now = new Date().toISOString();
    upsertApplication({
      id: user ? `pending-${Date.now()}` : `local-${Date.now()}`,
      status: "draft",
      events: [{ id: `e-${Date.now()}`, type: "created", createdAt: now }],
      createdAt: now,
      updatedAt: now,
      ...app,
    });
    setDialogOpen(false);
    setSlug(""); setTitle(""); setIntake(""); setNotes("");
    void syncAdd(app);
  };

  const changeStatus = (id: string, status: ApplicationStatus) => {
    const app = applications.find((a) => a.id === id);
    if (!app) return;
    upsertApplication({
      ...app,
      status,
      updatedAt: new Date().toISOString(),
      events: [
        { id: `e-${Date.now()}`, type: "status_changed", note: `${app.status} → ${status}`, createdAt: new Date().toISOString() },
        ...app.events,
      ],
    });
    void syncStatus(id, status);
  };

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FolderOpen className="h-6 w-6 text-leaf" aria-hidden="true" />
            {t("apps.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("apps.subtitle")}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("apps.add")}
        </Button>
      </header>

      <p className="mb-5 rounded-lg bg-accent p-3 text-xs leading-relaxed text-foreground/75">
        {t("apps.selfReported")} {t("apps.reminderNote")}
      </p>

      {applications.length === 0 ? (
        <Card className="bg-card">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t("common.empty")} — {t("plan.emptyBody")}
            <div className="mt-4">
              <Button variant="outline" onClick={() => navigate("explore")}>{t("nav.explore")}</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {applications.map((app) => (
            <Card key={app.id} className="border-border/70 bg-card">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold leading-snug">{app.opportunityTitle}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {app.opportunitySlug}
                      {app.intendedIntake ? ` · ${t("apps.intendedIntake")}: ${app.intendedIntake}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-leaf/40 bg-secondary/70">
                      {t(statusKey(app.status as ApplicationStatus))}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { removeApplication(app.id); void syncDelete(app.id); }}
                      aria-label={t("common.delete")}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                {app.notes && <p className="mt-3 text-sm text-muted-foreground">{app.notes}</p>}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {STATUS_ORDER.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={app.status === status ? "secondary" : "outline"}
                      disabled={app.status === status}
                      onClick={() => changeStatus(app.id, status)}
                      className="h-7 text-xs"
                    >
                      {t(statusKey(status))}
                    </Button>
                  ))}
                </div>

                {app.events.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("apps.timeline")}</p>
                    <ul className="max-h-32 overflow-y-auto uraan-scroll flex flex-col gap-1 text-xs text-muted-foreground">
                      {app.events.slice(0, 6).map((event) => (
                        <li key={event.id} className="flex items-baseline gap-2">
                          <span className="shrink-0 tabular-nums">{event.createdAt.slice(0, 10)}</span>
                          <span>
                            {event.type === "status_changed" ? (lang === "bn" ? "অবস্থা বদল" : "Status change") :
                             event.type === "created" ? (lang === "bn" ? "যোগ করা হয়েছে" : "Created") : event.type}
                            {event.note ? ` — ${event.note}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("apps.add")}</DialogTitle>
            <DialogDescription>
              {lang === "bn" ? "টার্গেট সুযোগের তথ্য লিখুন। শর্টলিস্টে থাকলে স্লাগ মিলিয়ে নিন।" : "Enter the target opportunity. Match the slug if it is in your shortlist."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => { e.preventDefault(); void add(); }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="app-slug">{lang === "bn" ? "সুযোগের স্লাগ" : "Opportunity slug"}</Label>
              <Input id="app-slug" required className="bg-card" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="mext-undergraduate-embassy" list="shortlist-slugs" />
              <datalist id="shortlist-slugs">
                {shortlist.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="app-title">{lang === "bn" ? "শিরোনাম" : "Title"}</Label>
              <Input id="app-title" required className="bg-card" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="app-intake">{t("apps.intendedIntake")}</Label>
              <Input id="app-intake" className="bg-card" value={intake} onChange={(e) => setIntake(e.target.value)} placeholder="Fall 2027" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="app-notes">{t("apps.notes")}</Label>
              <Textarea id="app-notes" className="min-h-20 bg-card" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button type="submit">{t("common.add")}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
