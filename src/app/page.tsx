"use client";

/**
 * Uraan application shell.
 *
 * Navigation is durable-URL driven: every screen is addressable through
 * query parameters on / (view, slug, tab, ids, dest, level, cycle, q —
 * non-sensitive only; no personal profile data ever enters the URL).
 * The hosting sandbox exposes a single app route, so this delivers deep
 * links, refresh persistence, and back/forward history without multi-path
 * routes; the owner's deployment can promote these to real paths later
 * (documented in DEPLOYMENT.md).
 */
import { useEffect, useRef, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { useAppStore, type ExploreFilters, type PrepareTab, type View } from "@/lib/store";
import { UraanHeader } from "@/components/uraan/header";
import { UraanFooter } from "@/components/uraan/footer";
import { HomeView } from "@/components/uraan/home-view";
import { OnboardingView } from "@/components/uraan/onboarding-view";
import { JourneyView } from "@/components/uraan/journey-view";
import { ExploreView } from "@/components/uraan/explore-view";
import { OpportunityDetailView } from "@/components/uraan/opportunity-detail";
import { CompareView } from "@/components/uraan/compare-view";
import { PrepareView } from "@/components/uraan/prepare/prepare-view";
import { ApplicationsView } from "@/components/uraan/applications-view";
import { CalendarView } from "@/components/uraan/calendar-view";
import { SourcesView } from "@/components/uraan/sources-view";
import { SettingsView } from "@/components/uraan/settings-view";
import { AdminView } from "@/components/uraan/admin-view";
import { AuthDialog } from "@/components/uraan/auth-dialog";

const VALID_VIEWS: View[] = [
  "home", "onboarding", "journey", "explore", "detail", "compare",
  "prepare", "applications", "calendar", "sources", "admin", "settings",
];
const VALID_TABS: PrepareTab[] = ["language", "experience", "writing", "recommenders", "research", "documents"];

/** Build the canonical query string for the current navigation state. */
function urlOf(state: {
  view: View;
  detailSlug: string | null;
  prepareTab: PrepareTab;
  compareSlugs: string[];
  exploreFilters: ExploreFilters;
}): string {
  const params = new URLSearchParams();
  params.set("view", state.view);
  if (state.view === "detail" && state.detailSlug) params.set("slug", state.detailSlug);
  if (state.view === "prepare" && state.prepareTab !== "language") params.set("tab", state.prepareTab);
  if (state.view === "compare" && state.compareSlugs.length > 0) params.set("ids", state.compareSlugs.join(","));
  if (state.view === "explore") {
    const { query, country, level, cycle } = state.exploreFilters;
    if (query) params.set("q", query);
    if (country !== "all") params.set("dest", country);
    if (level !== "all") params.set("level", level);
    if (cycle !== "all") params.set("cycle", cycle);
  }
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

/** Parse the URL into a navigation snapshot (invalid values ignored). */
function stateOfUrl(): {
  view: View;
  detailSlug?: string | null;
  prepareTab?: PrepareTab;
  compareSlugs?: string[];
  exploreFilters?: Partial<ExploreFilters>;
} {
  const params = new URLSearchParams(window.location.search);
  const rawView = params.get("view") as View | null;
  const view = rawView && VALID_VIEWS.includes(rawView) ? rawView : "home";
  const snapshot: ReturnType<typeof stateOfUrl> = { view };
  const slug = params.get("slug");
  if (view === "detail" && slug && /^[a-z0-9-]{1,120}$/i.test(slug)) snapshot.detailSlug = slug;
  const tab = params.get("tab") as PrepareTab | null;
  if (view === "prepare" && tab && VALID_TABS.includes(tab)) snapshot.prepareTab = tab;
  const ids = params.get("ids");
  if (view === "compare" && ids) {
    const slugs = ids.split(",").filter((s) => /^[a-z0-9-]{1,120}$/i.test(s)).slice(0, 3);
    if (slugs.length > 0) snapshot.compareSlugs = slugs;
  }
  if (view === "explore") {
    const filters: Partial<ExploreFilters> = {};
    const q = params.get("q");
    if (q && q.length <= 120) filters.query = q;
    const dest = params.get("dest");
    if (dest && /^[a-z]{2}$/i.test(dest)) filters.country = dest;
    const level = params.get("level");
    if (level && ["bachelor", "master", "phd", "master_phd"].includes(level)) filters.level = level;
    const cycle = params.get("cycle");
    if (cycle && ["open", "opens_later", "in_progress", "closed", "rolling", "archived", "unknown"].includes(cycle)) {
      filters.cycle = cycle;
    }
    if (Object.keys(filters).length > 0) snapshot.exploreFilters = filters;
  }
  return snapshot;
}

const VIEW_TITLES: Record<View, string> = {
  home: "app.name",
  onboarding: "onboarding.title",
  journey: "journey.title",
  explore: "explore.title",
  detail: "explore.title", // detail shows the opportunity name in-content
  compare: "compare.title",
  prepare: "prepare.title",
  applications: "apps.title",
  calendar: "cal.title",
  sources: "sources.title",
  admin: "admin.title",
  settings: "settings.title",
};

/** URL ↔ store synchronization: deep links, back/forward, refresh survive. */
function useUrlRouting() {
  const { t } = useI18n();
  const view = useAppStore((s) => s.view);
  const detailSlug = useAppStore((s) => s.detailSlug);
  const prepareTab = useAppStore((s) => s.prepareTab);
  const compareSlugs = useAppStore((s) => s.compareSlugs);
  const exploreFilters = useAppStore((s) => s.exploreFilters);
  const applying = useRef(false);
  const firstSync = useRef(true);

  // Initial deep link: URL wins on first load.
  useEffect(() => {
    applying.current = true;
    useAppStore.getState().applyFromUrl(stateOfUrl());
    applying.current = false;
     
  }, []);

  // Store → URL: every navigation pushes a history entry (back/forward work).
  // The very first sync REPLACES (no extra history entry on a fresh load).
  useEffect(() => {
    if (applying.current) return;
    const next = urlOf({ view, detailSlug, prepareTab, compareSlugs, exploreFilters });
    if (next !== window.location.pathname + window.location.search) {
      if (firstSync.current) {
        window.history.replaceState({}, "", next);
      } else {
        window.history.pushState({}, "", next);
      }
    }
    firstSync.current = false;
     
  }, [view, detailSlug, prepareTab, compareSlugs, exploreFilters]);

  // URL ← browser: back/forward buttons re-apply the URL state to the store.
  useEffect(() => {
    const onPop = () => {
      applying.current = true;
      useAppStore.getState().applyFromUrl(stateOfUrl());
      applying.current = false;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Accurate per-view page titles.
  useEffect(() => {
    if (view === "home") {
      document.title = "Uraan — Study Abroad Preparation Workspace";
      return;
    }
    const key = VIEW_TITLES[view] ?? "app.name";
    const title = t(key as Parameters<typeof t>[0]);
    document.title = `${title} · Uraan`;
  }, [view, t]);
}

function Shell() {
  const view = useAppStore((s) => s.view);
  const hydrated = useAppStore((s) => s.hydrated);
  const [authOpen, setAuthOpen] = useState(false);

  useUrlRouting();

  // Startup contract (audited fix P1-2):
  // 1. Resolve the session FIRST — the shell stays a skeleton so no
  //    cached state of another owner can ever render.
  // 2. For a signed-in user, hydrate the FULL /api/state before revealing
  //    account-specific views; guests continue from their local cache.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const finish = () => {
        if (!cancelled) useAppStore.getState().setHydrated(true);
      };
      try {
        const res = await fetch("/api/auth/session");
        const json = await res.json().catch(() => null);
        const user = res.ok && json?.ok ? (json.data?.user ?? null) : null;
        if (cancelled) return;
        if (user) {
          // Drop any cache that belongs to a different owner (or another
          // account), then load this account's server truth.
          useAppStore.getState().syncOwner(user);
          useAppStore.getState().setUser(user);
          // An open guest→account merge decision outranks hydration: the
          // unmerged guest snapshot in the local cache must survive this
          // load. Hydrating now would overwrite (and persist) server state
          // over the snapshot with no prompt ever re-appearing. Instead,
          // skip /api/state and re-open the merge dialog.
          const cached = useAppStore.getState();
          const hasLocalSnapshot = Boolean(
            cached.profile ||
              cached.plan ||
              cached.shortlist.length > 0 ||
              cached.applications.length > 0,
          );
          if (cached.mergePending && hasLocalSnapshot) {
            setAuthOpen(true);
            finish();
            return;
          }
          if (cached.mergePending) {
            // Stale flag with nothing left to merge — clear it and hydrate.
            useAppStore.getState().setMergePending(false);
          }
          try {
            const stateRes = await fetch("/api/state");
            const stateJson = await stateRes.json().catch(() => null);
            if (!cancelled && stateRes.ok && stateJson?.ok) {
              const s = stateJson.data;
              useAppStore.getState().setProfile(s.profile ?? null);
              useAppStore.getState().setPlan(s.plan ?? null);
              useAppStore.getState().setApplications(s.applications ?? []);
              useAppStore.getState().setGoal(s.goalSlug ?? null);
              useAppStore.getState().setShortlist(s.shortlist ?? []);
            }
          } catch {
            /* hydration failed: retry on next action; local cache stays empty for accounts */
          }
          finish();
        } else {
          useAppStore.getState().syncOwner(null);
          finish();
        }
      } catch {
        // Offline / route failure: continue as guest with local cache.
        useAppStore.getState().syncOwner(null);
        finish();
      }
      // Live catalogue stats (non-blocking): coverage counts in copy are
      // derived from data, never hardcoded.
      void (async () => {
        try {
          const res = await fetch("/api/health");
          const json = await res.json().catch(() => null);
          if (res.ok && json?.ok) {
            useAppStore.getState().setStats({
              opportunities: Number(json.data?.opportunities ?? 0),
              sources: Number(json.data?.sources ?? 0),
              status: "ok",
            });
          } else {
            useAppStore.getState().setStats({ opportunities: null, sources: null, status: "error" });
          }
        } catch {
          useAppStore.getState().setStats({ opportunities: null, sources: null, status: "error" });
        }
      })();
    })();
    return () => {
      cancelled = true;
    };
     
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <UraanHeader onSignIn={() => setAuthOpen(true)} />
      <div id="main-content" className="flex flex-1 flex-col">
        {!hydrated ? (
          <StartupSkeleton />
        ) : (
          <>
            {view === "home" && <HomeView />}
            {view === "onboarding" && <OnboardingView />}
            {view === "journey" && <JourneyView />}
            {view === "explore" && <ExploreView />}
            {view === "detail" && <OpportunityDetailView />}
            {view === "compare" && <CompareView />}
            {view === "prepare" && <PrepareView />}
            {view === "applications" && <ApplicationsView />}
            {view === "calendar" && <CalendarView />}
            {view === "sources" && <SourcesView />}
            {view === "settings" && <SettingsView onSignIn={() => setAuthOpen(true)} />}
            {view === "admin" && <AdminView />}
          </>
        )}
      </div>
      <UraanFooter />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}

/** Shown while the session resolves — never another user's cached state. */
function StartupSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading your workspace">
      <div className="h-10 w-2/3 max-w-md animate-pulse rounded-lg bg-muted" />
      <div className="mt-4 h-4 w-1/2 max-w-sm animate-pulse rounded bg-muted" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl border border-border/60 bg-muted/60" />
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  );
}
