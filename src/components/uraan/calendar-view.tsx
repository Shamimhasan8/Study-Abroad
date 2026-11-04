"use client";

/**
 * Calendar — dated tasks and official events, visually distinct.
 * Exports: ICS (all-day, date-only) and printable markdown plan.
 */
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Download, FileText, Landmark, CircleDot } from "lucide-react";
import { deadlineLabel } from "@/lib/dates";
import type { Opportunity } from "@/lib/types";
import { useEffect } from "react";

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_BN = ["জানু", "ফেব", "মার্চ", "এপ্রি", "মে", "জুন", "জুল", "আগ", "সেপ", "অক্টো", "নভে", "ডিসে"];

interface CalendarItem {
  id: string;
  date: string;
  title: string;
  kind: "official" | "task" | "application";
  official: boolean;
}

export function CalendarView() {
  const { t, lang } = useI18n();
  const { plan, applications, user, navigate, goalSlug } = useAppStore();
  const [goalOpportunity, setGoalOpportunity] = useState<Opportunity | null>(null);

  useEffect(() => {
    if (!goalSlug) return;
    void (async () => {
      try {
        const res = await fetch(`/api/catalogue/${goalSlug}`);
        const json = await res.json();
        if (json.ok) setGoalOpportunity(json.data.opportunity);
      } catch { /* ignore */ }
    })();
  }, [goalSlug]);

  const months = lang === "bn" ? MONTHS_BN : MONTHS_EN;

  const items: CalendarItem[] = useMemo(() => {
    const list: CalendarItem[] = [];
    for (const task of plan?.tasks ?? []) {
      if (task.status === "done" || task.status === "skipped" || !task.dueDate) continue;
      list.push({
        id: task.id,
        date: task.dueDate,
        title: lang === "bn" && task.titleBn ? task.titleBn : task.title,
        kind: "task",
        official: task.dateBasis === "official",
      });
    }
    for (const d of goalOpportunity?.deadlines ?? []) {
      if (!d.closeDate) continue;
      list.push({
        id: `official-${d.id}`,
        date: d.closeDate,
        title: `${goalOpportunity!.title} (${d.type})`,
        kind: "official",
        official: d.official,
      });
    }
    for (const app of applications) {
      if (app.status === "submitted" || app.status === "awaiting") {
        list.push({
          id: `app-${app.id}`,
          date: app.updatedAt.slice(0, 10),
          title: app.opportunityTitle,
          kind: "application",
          official: false,
        });
      }
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [plan, goalOpportunity, applications, lang]);

  // Group by month for the next 18 months
  const grouped = useMemo(() => {
    const now = new Date();
    const groups: { key: string; label: string; items: CalendarItem[] }[] = [];
    for (let offset = 0; offset < 18; offset++) {
      const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const monthItems = items.filter((item) => item.date.startsWith(key));
      if (monthItems.length > 0) {
        groups.push({ key, label: `${months[date.getMonth()]} ${date.getFullYear()}`, items: monthItems });
      }
    }
    return groups;
  }, [items, months]);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 font-display text-[26px] font-bold tracking-tight sm:text-3xl">
          <CalendarDays className="h-6 w-6 text-leaf" aria-hidden="true" />
          {t("cal.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("cal.subtitle")}</p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {user && (
          <>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href="/api/calendar/ics">
                <Download className="h-4 w-4" aria-hidden="true" />
                {t("cal.exportICS")}
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href="/api/export/plan">
                <FileText className="h-4 w-4" aria-hidden="true" />
                {t("cal.exportPlan")}
              </a>
            </Button>
          </>
        )}
        {!user && (
          <p className="rounded-lg bg-accent p-3 text-xs text-foreground/75">
            {lang === "bn"
              ? "এক্সপোর্ট চালু করতে অ্যাকাউন্টে সাইন-ইন করুন — অতিথি প্ল্যান শুধু এই ব্রাউজারে থাকে।"
              : "Sign in to enable exports — guest plans stay in this browser only."}
          </p>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Landmark className="h-3.5 w-3.5 text-leaf" aria-hidden="true" />
          {t("cal.official")}
        </span>
        <span className="flex items-center gap-1.5">
          <CircleDot className="h-3.5 w-3.5 text-coral" aria-hidden="true" />
          {t("cal.suggested")}
        </span>
        <span className="ml-auto">{t("cal.legend")}</span>
      </div>

      {grouped.length === 0 ? (
        <Card className="bg-card">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">{t("cal.noDates")}</p>
            <div className="mt-4 flex justify-center gap-3">
              <Button variant="outline" onClick={() => navigate("explore")}>{t("nav.explore")}</Button>
              <Button variant="outline" onClick={() => navigate("journey")}>{t("plan.generate")}</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map((group) => (
            <Card key={group.key} className="border-border/70 bg-card">
              <CardContent className="p-4">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h2>
                <ul className="flex flex-col gap-2">
                  {group.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 rounded-lg border border-border/70 p-2.5">
                      <span className="w-14 shrink-0 text-center text-xs font-bold tabular-nums text-leaf">
                        {item.date.slice(8, 10)} {months[Number(item.date.slice(5, 7)) - 1]}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                      <Badge
                        variant="outline"
                        className={
                          item.official
                            ? "border-leaf/50 bg-secondary text-secondary-foreground"
                            : item.kind === "official"
                              ? "border-sunflower/60 bg-accent"
                              : "text-muted-foreground"
                        }
                      >
                        {item.kind === "official"
                          ? item.official ? t("cal.official") : t("cal.suggested")
                          : t("cal.taskDue")}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">{t("cal.precisionNote")}</p>
      {goalOpportunity && (
        <p className="mt-2 text-xs text-muted-foreground">
          {goalOpportunity.title}: {goalOpportunity.deadlineNote}
        </p>
      )}
    </main>
  );
}
