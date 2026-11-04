"use client";

/**
 * Uraan single-page application shell.
 * All screens are coherent nested views switched client-side; the server
 * exposes only / plus JSON API routes. View wiring grows as modules land.
 */
import { useEffect, useState } from "react";
import { I18nProvider } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { UraanHeader } from "@/components/uraan/header";
import { UraanFooter } from "@/components/uraan/footer";
import { HomeView } from "@/components/uraan/home-view";
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
      <UraanHeader onSignIn={() => setAuthOpen(true)} />
      <div className="flex flex-1 flex-col">
        {view === "home" && <HomeView />}
        {/* Further views are wired in as their modules land: onboarding,
            journey, explore, detail, compare, prepare, applications,
            calendar, sources, settings, admin. */}
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
