"use client";

/**
 * Uraan header — compact navigation per information architecture:
 * Explore · My Journey · Prepare · Applications (primary),
 * with Calendar / Sources / Settings / Editorial as secondary.
 */
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { PaperPlaneMark } from "./illustrations";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Compass,
  Map,
  NotebookPen,
  FolderOpen,
  CalendarDays,
  BookCheck,
  Settings,
  PenLine,
  Languages,
  UserRound,
  LogOut,
  Menu,
  ExternalLink,
} from "lucide-react";
import type { View } from "@/lib/store";
import { cn } from "@/lib/utils";

const PRIMARY: { view: View; icon: typeof Compass }[] = [
  { view: "explore", icon: Compass },
  { view: "journey", icon: Map },
  { view: "prepare", icon: NotebookPen },
  { view: "applications", icon: FolderOpen },
];

export function UraanHeader({ onSignIn }: { onSignIn: () => void }) {
  const { t, lang, setLang } = useI18n();
  const { view, navigate, user, setUser, syncOwner } = useAppStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const go = (next: View) => {
    navigate(next);
    setMobileOpen(false);
  };

  const NavButton = ({ target, icon: Icon, label }: { target: View; icon: typeof Compass; label: string }) => (
    <button
      onClick={() => go(target)}
      aria-current={view === target ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        "hover:bg-secondary focus-visible:bg-secondary",
        view === target ? "bg-secondary text-secondary-foreground" : "text-foreground/80",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );

  const renderSecondaryItems = () => (
    <>
      <DropdownMenuItem onClick={() => go("calendar")}>
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
        {t("nav.calendar")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => go("sources")}>
        <BookCheck className="h-4 w-4" aria-hidden="true" />
        {t("nav.sources")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => go("settings")}>
        <Settings className="h-4 w-4" aria-hidden="true" />
        {t("nav.settings")}
      </DropdownMenuItem>
      {user?.role === "admin" && (
        <DropdownMenuItem onClick={() => go("admin")}>
          <PenLine className="h-4 w-4" aria-hidden="true" />
          {t("nav.admin")}
        </DropdownMenuItem>
      )}
    </>
  );

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* network failure — clear local identity anyway */
    }
    // Reset the cache owner FIRST: this discards the signed-out account's
    // cached domain state (syncOwner's account→guest branch) and returns the
    // cache to guest scope. Without it, ownerKey keeps the old account id and
    // any guest work done while signed out would be silently wiped when a
    // DIFFERENT account signs in next (account→account discard branch).
    useAppStore.getState().syncOwner(null);
    setUser(null);
    navigate("home");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:px-4">
        {/* Brand */}
        <button
          onClick={() => go("home")}
          className="flex items-center gap-2 rounded-lg focus-visible:outline-2"
          aria-label={`${t("app.name")} — ${t("nav.home")}`}
        >
          <PaperPlaneMark width={26} height={26} />
          <span className="text-lg font-bold tracking-tight">{t("app.name")}</span>
        </button>

        {/* Competition notice — official organizer sticker placeholder.
            The official asset was not retrievable in the build environment;
            this is an honest link badge, not a replica. */}
        <a
          href="https://yunet-aignite26.devpost.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1 rounded-full border border-coral/40 bg-accent px-2.5 py-0.5 text-xs font-medium text-foreground/75 hover:border-coral transition-colors"
          title="YuNet AI Ignite 2026 — Devpost"
        >
          AI Ignite 2026
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>

        {/* Primary nav (desktop) */}
        <nav aria-label="Primary" className="ml-4 hidden md:flex items-center gap-1">
          {PRIMARY.map(({ view: target, icon }) => (
            <NavButton key={target} target={target} icon={icon} label={t(`nav.${target}` as Parameters<typeof t>[0])} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Language toggle */}
          <div
            role="group"
            aria-label={t("common.language")}
            className="flex items-center rounded-full border border-border bg-card p-0.5"
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

          {/* Account */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 max-w-40">
                  <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{user.name || user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {renderSecondaryItems()}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {t("auth.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={onSignIn} className="hidden sm:inline-flex">
                {t("auth.signIn")}
              </Button>
              <Button size="sm" onClick={onSignIn} className="hidden sm:inline-flex">
                {t("auth.signUp")}
              </Button>
            </>
          )}

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("nav.menu")}>
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetTitle className="flex items-center gap-2 px-1">
                <PaperPlaneMark width={22} height={22} />
                {t("app.name")}
              </SheetTitle>
              <nav aria-label="Mobile" className="mt-4 flex flex-col gap-1">
                {PRIMARY.map(({ view: target, icon: Icon }) => (
                  <button
                    key={target}
                    onClick={() => go(target)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-secondary"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {t(`nav.${target}` as Parameters<typeof t>[0])}
                  </button>
                ))}
                <div className="my-2 border-t border-border" />
                <button onClick={() => go("calendar")} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-secondary">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  {t("nav.calendar")}
                </button>
                <button onClick={() => go("sources")} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-secondary">
                  <BookCheck className="h-4 w-4" aria-hidden="true" />
                  {t("nav.sources")}
                </button>
                <button onClick={() => go("settings")} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-secondary">
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  {t("nav.settings")}
                </button>
                {user?.role === "admin" && (
                  <button onClick={() => go("admin")} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-secondary">
                    <PenLine className="h-4 w-4" aria-hidden="true" />
                    {t("nav.admin")}
                  </button>
                )}
                {!user && (
                  <Button className="mt-3" onClick={() => { setMobileOpen(false); onSignIn(); }}>
                    {t("auth.signUp")}
                  </Button>
                )}
                {user && (
                  <Button variant="outline" className="mt-3" onClick={signOut}>
                    {t("auth.signOut")}
                  </Button>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
