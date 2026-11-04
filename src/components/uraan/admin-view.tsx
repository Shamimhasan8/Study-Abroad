"use client";

/**
 * Editorial workspace (admin-only, server-gated). Review queue, source
 * fetch health, assisted evidence submission, approve/publish with audit.
 */
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PenLine, RefreshCw, CheckCircle2, XCircle, Landmark, ClipboardList, Loader2 } from "lucide-react";

interface QueueItem {
  id: string;
  sourceKey: string;
  sourceTitle: string;
  opportunitySlug?: string;
  fieldPath: string;
  factValue: string;
  unit?: string;
  extraction: string;
  confidence: string;
  conflictNote?: string;
  createdAt: string;
}

interface HealthItem {
  key: string;
  title: string;
  status: string;
  httpStatus?: number;
  retrievedAt: string;
  sizeBytes?: number;
  note?: string;
}

interface AuditItem {
  id: string;
  action: string;
  targetType: string;
  targetId?: string;
  detail?: string;
  createdAt: string;
}

export function AdminView() {
  const { t, lang } = useI18n();
  const user = useAppStore((s) => s.user);
  const { toast } = useToast();

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [health, setHealth] = useState<HealthItem[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [publishedCount, setPublishedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [runningIngestion, setRunningIngestion] = useState(false);

  // Submit-evidence form state
  const [sourceKey, setSourceKey] = useState("");
  const [opportunitySlug, setOpportunitySlug] = useState("");
  const [fieldPath, setFieldPath] = useState("");
  const [factValue, setFactValue] = useState("");
  const [unit, setUnit] = useState("");
  const [confidence, setConfidence] = useState("official_page");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/queue");
      if (res.status === 401) {
        setForbidden(true);
        return;
      }
      const json = await res.json();
      if (json.ok) {
        setQueue(json.data.queue);
        setHealth(json.data.sourcesHealth);
        setAudit(json.data.audit);
        setPublishedCount(json.data.publishedCount);
        setForbidden(false);
      }
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const runIngestion = async (volatility?: string) => {
    setRunningIngestion(true);
    try {
      const url = volatility ? `/api/admin/ingestion?volatility=${volatility}` : "/api/admin/ingestion";
      const res = await fetch(url, { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        const failed = json.data.outcomes.filter((o: { status: string }) => o.status === "failed").length;
        toast({
          title: `${json.data.outcomes.length} sources checked · ${failed} failed`,
          description: lang === "bn" ? "ফেচ সফলতা মানে যাচাই নয় — রিভিউ করতে হবে।" : "A fetch success is not verification — review still applies.",
        });
        await load();
      }
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setRunningIngestion(false);
    }
  };

  const review = async (evidenceId: string, action: "approve" | "reject") => {
    try {
      const res = await fetch("/api/admin/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceId, action }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: action === "approve" ? t("admin.published") : t("admin.reject") });
        await load();
      }
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const submitEvidence = async () => {
    if (!sourceKey || !fieldPath || !factValue) return;
    try {
      const res = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceKey,
          opportunitySlug: opportunitySlug || undefined,
          fieldPath,
          factValue,
          unit: unit || undefined,
          confidence,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        toast({ title: t("common.saved") });
        setFieldPath(""); setFactValue(""); setUnit(""); setOpportunitySlug("");
        await load();
      } else {
        // Surface the typed rejection (invalid field path, unknown source…)
        toast({ title: t("common.error"), description: json?.error ?? `HTTP ${res.status}`, variant: "destructive" });
      }
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  if (forbidden || (user && user.role !== "admin")) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">{t("admin.forbidden")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-[26px] font-bold tracking-tight sm:text-3xl">
            <PenLine className="h-6 w-6 text-leaf" aria-hidden="true" />
            {t("admin.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.notifyNote")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => runIngestion()} disabled={runningIngestion} className="gap-1.5">
            {runningIngestion ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
            {t("admin.runIngestion")}
          </Button>
          <Button variant="outline" onClick={() => runIngestion("cycle-critical")} disabled={runningIngestion} size="sm">
            cycle-critical
          </Button>
          <Button variant="outline" onClick={() => runIngestion("medium")} disabled={runningIngestion} size="sm">
            medium
          </Button>
          <Button variant="outline" onClick={() => runIngestion("low")} disabled={runningIngestion} size="sm">
            low
          </Button>
        </div>
      </header>

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Review queue */}
          <Card className="border-border/70 bg-card">
            <CardContent className="p-5">
              <h2 className="mb-3 flex items-center gap-1.5 text-base font-semibold tracking-tight">
                <ClipboardList className="h-4 w-4 text-leaf" aria-hidden="true" />
                {t("admin.queue")} ({queue.length})
              </h2>
              {queue.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("admin.empty")}</p>
              ) : (
                <ul className="max-h-96 overflow-y-auto uraan-scroll flex flex-col gap-3">
                  {queue.map((item) => (
                    <li key={item.id} className="rounded-lg border border-border/70 p-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{item.fieldPath}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {item.sourceTitle}
                            {item.opportunitySlug ? ` → ${item.opportunitySlug}` : ""}
                          </p>
                          <p className="mt-1 text-sm">{item.factValue}{item.unit ? ` ${item.unit}` : ""}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <Badge variant="outline" className="text-[10px]">{item.extraction}</Badge>
                            <Badge variant="outline" className="text-[10px]">{item.confidence}</Badge>
                            {item.conflictNote && <Badge variant="outline" className="border-destructive/40 text-[10px] text-destructive">{t("admin.conflict")}</Badge>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => review(item.id, "approve")}>
                            <CheckCircle2 className="h-3.5 w-3.5 text-leaf" aria-hidden="true" />
                            {t("admin.approve")}
                          </Button>
                          <Button size="sm" variant="ghost" className="gap-1" onClick={() => review(item.id, "reject")}>
                            <XCircle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                            {t("admin.reject")}
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Submit evidence */}
          <Card className="border-border/70 bg-card">
            <CardContent className="p-5">
              <h2 className="mb-3 text-base font-semibold tracking-tight">{t("admin.evidence")}</h2>
              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={(e) => { e.preventDefault(); void submitEvidence(); }}
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ev-source">source key</Label>
                  <Input id="ev-source" required className="bg-card" value={sourceKey} onChange={(e) => setSourceKey(e.target.value)} placeholder="mext-ug" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ev-opp">opportunity slug</Label>
                  <Input id="ev-opp" className="bg-card" value={opportunitySlug} onChange={(e) => setOpportunitySlug(e.target.value)} placeholder="mext-undergraduate-embassy" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ev-field">field path</Label>
                  <Input id="ev-field" required className="bg-card" value={fieldPath} onChange={(e) => setFieldPath(e.target.value)} placeholder="deadlineNote" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ev-value">{t("admin.value")}</Label>
                  <Textarea id="ev-value" required className="min-h-10 bg-card" value={factValue} onChange={(e) => setFactValue(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ev-unit">unit</Label>
                  <Input id="ev-unit" className="bg-card" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="EUR / month" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ev-confidence">confidence</Label>
                  <Select value={confidence} onValueChange={setConfidence}>
                    <SelectTrigger id="ev-confidence" className="bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="official_page">official_page</SelectItem>
                      <SelectItem value="secondary_official">secondary_official</SelectItem>
                      <SelectItem value="unverified">unverified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="sm:col-span-2 self-start">{t("common.add")}</Button>
              </form>
            </CardContent>
          </Card>

          {/* Sources health */}
          <Card className="border-border/70 bg-card">
            <CardContent className="p-5">
              <h2 className="mb-3 flex items-center gap-1.5 text-base font-semibold tracking-tight">
                <Landmark className="h-4 w-4 text-leaf" aria-hidden="true" />
                {t("admin.sourcesHealth")}
              </h2>
              <ul className="max-h-72 overflow-y-auto uraan-scroll flex flex-col gap-2">
                {health.slice(0, 12).map((item) => (
                  <li key={item.key + item.retrievedAt} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 p-2.5 text-sm">
                    <Badge
                      variant="outline"
                      className={
                        item.status === "fetched" ? "border-leaf/50 bg-secondary" :
                        item.status === "unchanged" ? "text-muted-foreground" : "border-destructive/40 text-destructive"
                      }
                    >
                      {item.status}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.retrievedAt.slice(0, 16).replace("T", " ")}</span>
                    {item.httpStatus && <span className="text-xs tabular-nums text-muted-foreground">{item.httpStatus}</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("admin.published")}: {publishedCount} · {t("admin.lastRun")}: {health[0]?.retrievedAt.slice(0, 16).replace("T", " ") ?? "—"}
              </p>
            </CardContent>
          </Card>

          {/* Audit */}
          <Card className="border-border/70 bg-card">
            <CardContent className="p-5">
              <h2 className="mb-3 text-base font-semibold tracking-tight">{t("admin.audit")}</h2>
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
              ) : (
                <ul className="max-h-72 overflow-y-auto uraan-scroll flex flex-col gap-1.5 text-xs text-muted-foreground">
                  {audit.map((item) => (
                    <li key={item.id} className="flex items-baseline gap-2">
                      <span className="shrink-0 tabular-nums">{item.createdAt.slice(0, 16).replace("T", " ")}</span>
                      <span className="font-medium text-foreground/75">{item.action}</span>
                      <span className="truncate">{item.targetType} {item.targetId ?? ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
