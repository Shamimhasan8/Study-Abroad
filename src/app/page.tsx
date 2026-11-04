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
import type { SessionUser } from "@/lib/types";

function Shell() {
  const view = useAppStore((s) => s.view);
  const setUser = useAppStore((s) => s.setUser);
  const [authOpen, setAuthOpen] = useState(false);

  // Session bootstrap: if a valid session cookie exists, hydrate identity.
  // Guests simply stay guests — public browsing never requires sign-in.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/session");
        const json = await res.json();
        if (!cancelled && json.ok && json.data?.user) {
          setUser(json.data.user as SessionUser);
        }
      } catch {
        /* offline or route not yet deployed — guest mode continues */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser]);

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
      </div>
      <UraanFooter />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
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
