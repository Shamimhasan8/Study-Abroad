"use client";

/**
 * Student workspace shell (Gate 2 of the 04 contract).
 *
 * Desktop (≥lg): compact top bar + 224px side navigation + central working
 * canvas + contextual mentor rail (304px, only ≥xl so the canvas keeps a
 * useful reading width). Mobile: top bar + fixed bottom navigation with a
 * "More" sheet and a mentor bottom sheet that never covers primary
 * controls. Capability states are stated in ordinary language — this
 * device vs synced, live vs offline mentor — never advertised beyond what
 * the probes verified.
 */
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore, type View } from "@/lib/store";
import { PaperPlaneMark } from "@/components/uraan/illustrations";
import { MentorRail } from "@/components/uraan/mentor/mentor-rail";
import { CompetitionBadge } from "@/components/uraan/shell/competition-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Map, CalendarDays, NotebookPen, FolderOpen, Wallet, BookCheck, Settings,
  PenLine, UserRound, LogOut, Languages, Menu, MessageCircle, CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRIMARY: { view: View; icon: typeof Map; labelKey: string }[] = [
  { view: "workspace", icon: Map, labelKey: "nav.workspace" },
  { view: "calendar", icon: CalendarDays, labelKey: "nav.calendar" },
  { view: "prepare", icon: NotebookPen, labelKey: "nav.prepare" },
  { view: "applications", icon: FolderOpen, labelKey: "nav.applications" },
];

const SECONDARY: { view: View; icon: typeof Map; labelKey: string }[] = [
  { view: "funding", icon: Wallet, labelKey: "nav.funding" },
  { view: "sources", icon: BookCheck, labelKey: "nav.sources" },
  { view: "settings", icon: Settings, labelKey: "nav.settings" },
];

/** Ordinary-language capability line — never a diagnostic dump. */
function CapabilityLine() {
  const { lang } = useI18n();
  const capabilities = useAppStore((s) => s.capabilities);
  const user = useAppStore((s) => s.user);
  const synced = Boolean(user && capabilities?.accountSync.available);
  const mentorLive = capabilities?.liveMentor.available === true;
  const label = synced
    ? lang === "bn" ? "সেভ সিঙ্ক হচ্ছে" : "Saving synced"
    : lang === "bn" ? "শুধু এই ডিভাইসে সেভ" : "Saves on this device";
  return (
    <button
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary/60 focus-visible:outline-2"
      aria-label={lang === "bn" ? "সেবা সক্ষমতা দেখুন" : "Service capabilities"}
      onClick={(e) => e.currentTarget.focus()}
      title={
        lang === "bn"
          ? `ব্রাউজিং: ${capabilities?.browsing.mode === "database" ? "লাইভ ডেটা" : "সেভ করা কপি"} · মেন্টর: ${mentorLive ? "লাইভ এআই" : "অফলাইন উত্তর"} · আপলোড: ${capabilities?.privateUploads.available ? "চালু" : "বন্ধ"}`
          : `Browsing: ${capabilities?.browsing.mode === "database" ? "live data" : "saved copy"} · Mentor: ${mentorLive ? "live AI" : "offline answers"} · Uploads: ${capabilities?.privateUploads.available ? "on" : "off"}`
      }
    >
      <CircleDot className={cn("h-3 w-3 shrink-0", synced ? "text-leaf" : "text-sunflower")} aria-hidden="true" />
      <span className="truncate">{label}</span>
      <span className={cn("ml-auto h-1.5 w-1.5 shrink-0 rounded-full", mentorLive ? "bg-leaf" : "bg-muted-foreground/40")} aria-hidden="true" />
    </button>
  );
}

function MotionToggle() {
  const { lang } = useI18n();
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  const setReduceMotion = useAppStore((s) => s.setReduceMotion);
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground">
      <span>{lang === "bn" ? "কম অ্যানিমেশন" : "Reduce motion"}</span>
      <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} aria-label={lang === "bn" ? "কম অ্যানিমেশন" : "Reduce motion"} />
    </div>
  );
}

function LangToggle({ compact = false }: { compact?: boolean }) {
  const { t, lang, setLang } = useI18n();
  return (
    <div
      role="group"
      aria-label={t("common.language")}
      className={cn(
        "flex items-center rounded-full border border-border bg-card p-0.5",
        compact && "scale-95",
      )}
    >
      <Languages className="mx-1 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      {(["en", "bn"] as const).map((code) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold transition-colors",
            lang === code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {code === "en" ? "EN" : "বাং"}
        </button>
      ))}
    </div>
  );
}

function NavItem({
  target,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  target: View;
  icon: typeof Map;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
        "hover:bg-secondary focus-visible:bg-secondary",
        active ? "bg-secondary text-secondary-foreground" : "text-foreground/75",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function WorkspaceShell({
  children,
  onSignIn,
}: {
  children: React.ReactNode;
  onSignIn: () => void;
}) {
  const { t, lang, setLang } = useI18n();
  const { view, navigate, user, setUser, syncOwner, mentorHidden, setMentorHidden } = useAppStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const [mentorSheetOpen, setMentorSheetOpen] = useState(false);

  const go = (next: View) => {
    navigate(next);
    setMoreOpen(false);
  };

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* network failure — clear local identity anyway */
    }
    useAppStore.getState().syncOwner(null);
    useAppStore.getState().clearMentorThread();
    setUser(null);
    navigate("home");
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* Compact workspace top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          <button
            onClick={() => go("home")}
            className="flex items-center gap-2 rounded-lg focus-visible:outline-2"
            aria-label={`${t("app.name")} — ${t("nav.home")}`}
          >
            <PaperPlaneMark width={26} height={26} />
            <span className="text-lg font-bold tracking-tight">{t("app.name")}</span>
          </button>
          <CompetitionBadge compact />
          <nav aria-label="Public" className="ml-3 hidden items-center gap-1 md:flex">
            <button
              onClick={() => go("explore")}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary focus-visible:bg-secondary"
              aria-current={view === "explore" ? "page" : undefined}
            >
              {t("nav.explore")}
            </button>
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="hidden xl:inline-flex"
              onClick={() => setMentorHidden(!mentorHidden)}
              aria-label={mentorHidden ? (lang === "bn" ? "মেন্টর দেখান" : "Show mentor") : (lang === "bn" ? "মেন্টর লুকান" : "Hide mentor")}
              aria-pressed={!mentorHidden}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
            </Button>
            <LangToggle compact />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="max-w-40 gap-1.5">
                    <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{user.name || user.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => go("funding")}>
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    {t("nav.funding")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => go("sources")}>
                    <BookCheck className="h-4 w-4" aria-hidden="true" />
                    {t("nav.sources")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => go("settings")}>
                    <Settings className="h-4 w-4" aria-hidden="true" />
                    {t("nav.settings")}
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <DropdownMenuItem onClick={() => go("admin")}>
                      <PenLine className="h-4 w-4" aria-hidden="true" />
                      {t("nav.admin")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    {t("auth.signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button size="sm" onClick={onSignIn}>
                {t("auth.signIn")}
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-stretch">
        {/* Side navigation (desktop) */}
        <nav aria-label="Workspace" className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 flex-col justify-between overflow-y-auto border-r border-border bg-sidebar/40 px-3 py-4 lg:flex">
          <div className="flex flex-col gap-1">
            {PRIMARY.map(({ view: target, icon, labelKey }) => (
              <NavItem
                key={target}
                target={target}
                icon={icon}
                label={t(labelKey as Parameters<typeof t>[0])}
                active={view === target}
                onClick={() => go(target)}
              />
            ))}
            <div className="my-3 border-t border-border" />
            {SECONDARY.map(({ view: target, icon, labelKey }) => (
              <NavItem
                key={target}
                target={target}
                icon={icon}
                label={t(labelKey as Parameters<typeof t>[0])}
                active={view === target}
                onClick={() => go(target)}
              />
            ))}
            {user?.role === "admin" && (
              <NavItem target="admin" icon={PenLine} label={t("nav.admin")} active={view === "admin"} onClick={() => go("admin")} />
            )}
          </div>
          <div className="flex flex-col gap-1 border-t border-border pt-3">
            <CapabilityLine />
            <MotionToggle />
          </div>
        </nav>

        {/* Central working canvas */}
        <div id="main-content" className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
          {children}
        </div>

        {/* Contextual mentor rail (wide desktop only) */}
        {!mentorHidden && (
          <aside
            aria-label={lang === "bn" ? "প্রসঙ্গ মেন্টর" : "Contextual mentor"}
            className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[304px] shrink-0 border-l border-border bg-sidebar/30 xl:block"
          >
            <MentorRail />
          </aside>
        )}
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Workspace mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid h-16 grid-cols-5" role="list">
          {PRIMARY.map(({ view: target, icon: Icon, labelKey }) => (
            <button
              key={target}
              onClick={() => go(target)}
              role="listitem"
              aria-current={view === target ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                view === target ? "text-leaf" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="truncate">{t(labelKey as Parameters<typeof t>[0])}</span>
            </button>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            role="listitem"
            aria-label={t("nav.menu")}
            className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
            <span className="truncate">{t("nav.menu")}</span>
          </button>
        </div>
      </nav>

      {/* Mobile: mentor floating trigger + bottom sheet */}
      <Button
        size="icon"
        onClick={() => setMentorSheetOpen(true)}
        className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full shadow-lg lg:hidden xl:hidden"
        aria-label={lang === "bn" ? "মেন্টর খুলুন" : "Open mentor"}
      >
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
      </Button>
      {mentorSheetOpen && (
        <Sheet open={mentorSheetOpen} onOpenChange={setMentorSheetOpen}>
          <SheetContent side="bottom" className="h-[75vh] p-0">
            <SheetTitle className="sr-only">{lang === "bn" ? "উরান মেন্টর" : "Uraan Mentor"}</SheetTitle>
            <SheetDescription className="sr-only">
              {lang === "bn" ? "আপনার প্রসঙ্গ অনুযায়ী গাইড" : "Guidance grounded on your context"}
            </SheetDescription>
            <div className="h-full">
              <MentorRail />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Mobile "More" sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="right" className="w-64">
          <SheetTitle className="flex items-center gap-2 px-1">
            <PaperPlaneMark width={22} height={22} />
            {t("app.name")}
          </SheetTitle>
          <div className="mt-4 flex flex-col gap-1">
            {SECONDARY.map(({ view: target, icon: Icon, labelKey }) => (
              <button
                key={target}
                onClick={() => go(target)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-secondary"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {t(labelKey as Parameters<typeof t>[0])}
              </button>
            ))}
            {user?.role === "admin" && (
              <button onClick={() => go("admin")} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-secondary">
                <PenLine className="h-4 w-4" aria-hidden="true" />
                {t("nav.admin")}
              </button>
            )}
            <div className="my-2 border-t border-border" />
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm text-muted-foreground">{t("common.language")}</span>
              <LangToggle />
            </div>
            {user ? (
              <Button variant="outline" className="mt-3" onClick={signOut}>
                {t("auth.signOut")}
              </Button>
            ) : (
              <Button className="mt-3" onClick={() => { setMoreOpen(false); onSignIn(); }}>
                {t("auth.signUp")}
              </Button>
            )}
            <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3">
              <CapabilityLine />
              <MotionToggle />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
