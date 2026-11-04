"use client";

/**
 * My documents — private storage only the owner can open. Upload requires an
 * explicit informed-consent checkbox; the limit note (PDF/PNG/JPG/TXT, 5 MB)
 * is always visible. Files never mark tasks complete by themselves.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import type { PrivateDocumentMeta } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Loader2, FolderLock, Upload, Download, Trash2, FileText } from "lucide-react";
import { BookStack } from "../illustrations";
import { GuestNotice, apiFetch, formatBytes, formatDate } from "./shared";

const PURPOSES: PrivateDocumentMeta["purpose"][] = [
  "transcript",
  "certificate",
  "test_score",
  "essay_draft",
  "research",
  "financial",
  "other",
];

const PURPOSE_LABELS: Record<string, [string, string]> = {
  transcript: ["Transcript", "ট্রান্সক্রিপ্ট"],
  certificate: ["Certificate", "সার্টিফিকেট"],
  test_score: ["Test score", "টেস্ট স্কোর"],
  essay_draft: ["Essay draft", "এসে ড্রাফট"],
  research: ["Research", "রিসার্চ"],
  financial: ["Financial", "আর্থিক"],
  other: ["Other", "অন্যান্য"],
};

const MAX_BYTES = 5 * 1024 * 1024;

function purposeLabel(purpose: string, lang: "en" | "bn"): string {
  const pair = PURPOSE_LABELS[purpose];
  if (!pair) return purpose;
  return lang === "bn" ? pair[1] : pair[0];
}

export function DocumentsTab() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const user = useAppStore((s) => s.user);

  const [documents, setDocuments] = useState<PrivateDocumentMeta[] | null>(null);
  const [purpose, setPurpose] = useState<PrivateDocumentMeta["purpose"]>("transcript");
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileKey, setFileKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setDocuments(null);
      return;
    }
    try {
      const data = await apiFetch<{ documents: PrivateDocumentMeta[] }>("/api/documents");
      setDocuments(data.documents);
    } catch {
      setDocuments([]);
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }, [user, t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!user || !file || !consent) return;
    if (file.size > MAX_BYTES) {
      toast({
        title: t("common.error"),
        description: t("docs.limit", { mb: 5 }),
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("purpose", purpose);
      const res = await fetch("/api/documents", { method: "POST", body });
      const json = (await res.json().catch(() => null)) as
        | { ok: true; data: { document: PrivateDocumentMeta } }
        | { ok: false; error: string }
        | null;
      if (!json || !json.ok) throw new Error(json?.error ?? "network_error");
      setFileKey((k) => k + 1); // resets the file input
      setConsent(false);
      await load();
      toast({ title: t("common.saved") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await apiFetch<{ deleted: boolean }>(`/api/documents/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await load();
      toast({ title: t("docs.deleted") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Upload */}
      <section aria-labelledby="docs-upload-title">
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-3">
            <CardTitle id="docs-upload-title" className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <FolderLock className="h-4 w-4 text-leaf" aria-hidden="true" />
              {t("docs.upload")}
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed text-muted-foreground">
              {t("docs.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!user && <GuestNotice />}
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void upload();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="doc-file">
                  {lang === "bn" ? "ফাইল" : "File"}
                </Label>
                <Input
                  key={fileKey}
                  ref={fileInputRef}
                  id="doc-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
                  className="bg-card py-1.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-accent"
                />
                <p className="text-xs text-muted-foreground">{t("docs.limit", { mb: 5 })}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="doc-purpose">{t("docs.purpose")}</Label>
                <Select value={purpose} onValueChange={(v) => setPurpose(v as PrivateDocumentMeta["purpose"])}>
                  <SelectTrigger id="doc-purpose" className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PURPOSES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {purposeLabel(p, lang)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="doc-consent"
                  checked={consent}
                  onCheckedChange={(checked) => setConsent(checked === true)}
                  className="mt-0.5"
                  aria-required="true"
                />
                <Label htmlFor="doc-consent" className="text-xs font-normal leading-relaxed text-muted-foreground">
                  {t("docs.consent")}
                </Label>
              </div>
              <Button type="submit" disabled={!user || !consent || uploading} className="gap-1.5">
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Upload className="h-4 w-4" aria-hidden="true" />
                )}
                {t("docs.upload")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Stored documents */}
      <section aria-labelledby="docs-list-title">
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-3">
            <CardTitle id="docs-list-title" className="text-base font-semibold tracking-tight">
              {t("docs.listTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!user && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <BookStack width={150} height={128} aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{t("docs.empty")}</p>
              </div>
            )}

            {user && documents === null && (
              <div className="flex flex-col gap-3" aria-label={t("common.loading")}>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            )}

            {user && documents !== null && documents.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <BookStack width={150} height={128} aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{t("docs.empty")}</p>
              </div>
            )}

            {user && documents !== null && documents.length > 0 && (
              <ul className="uraan-scroll flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center gap-3 rounded-lg border border-border/70 bg-secondary/40 px-3 py-2.5"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={doc.originalName}>
                        {doc.originalName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {purposeLabel(doc.purpose, lang)} · {formatBytes(doc.sizeBytes)} ·{" "}
                        {formatDate(doc.createdAt, lang)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <a
                        href={`/api/documents/${encodeURIComponent(doc.id)}`}
                        download
                        className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-leaf underline-offset-4 hover:underline"
                        aria-label={`${t("docs.download")} — ${doc.originalName}`}
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">{t("docs.download")}</span>
                      </a>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`${t("docs.delete")} — ${doc.originalName}`}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("docs.delete")}</AlertDialogTitle>
                            <AlertDialogDescription>{t("docs.deleteConfirm")}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void remove(doc.id)}>
                              {t("docs.delete")}
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
    </div>
  );
}
