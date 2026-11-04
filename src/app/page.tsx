"use client";

/**
 * Uraan single-page application shell.
 * All screens are coherent nested views switched client-side; the server
 * exposes only / plus JSON API routes.
 */
import { useEffect, useState } from "react";
import { I18nProvider } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
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

function Shell() {
  const view = useAppStore((s) => s.view);
  const hydrated = useAppStore((s) => s.hydrated);
  const [authOpen, setAuthOpen] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
