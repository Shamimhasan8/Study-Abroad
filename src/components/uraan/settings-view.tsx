"use client";

/**
 * Settings — profile summary, interface language, exports, account
 * lifecycle. The auth dialog lives in the app shell; this view links to it.
 */
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, FileText, Languages, LogIn, PenLine, Trash2, UserRound } from "lucide-react";

export function SettingsView({ onSignIn }: { onSignIn: () => void }) {
  const { t, lang, setLang } = useI18n();
  const { profile, user, resetDomain, navigate, setUser } = useAppStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const exportGuestData = () => {
    const state = useAppStore.getState();
    const payload = {
      exportedAt: new Date().toISOString(),
      kind: "uraan-guest-export",
      profile: state.profile,
      plan: state.plan,
      goalSlug: state.goalSlug,
      shortlist: state.shortlist,
      applications: state.applications,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "uraan-guest-data.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
    // Owner switch: account → guest drops all cached account state.
    useAppStore.getState().syncOwner(null);
    setUser(null);
    resetDomain();
    navigate("home");
  };

  const deleteAccount = async () => {
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        useAppStore.getState().syncOwner(null);
        setUser(null);
        resetDomain();
        navigate("home");
      }
    } catch {
      /* network failure — account remains intact */
    }
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
      </header>

      <div className="flex flex-col gap-5">
        {/* Profile summary */}
        <Card className="border-border/70 bg-card">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
                <UserRound className="h-4 w-4 text-leaf" aria-hidden="true" />
                {t("settings.profile")}
              </h2>
              <Button variant="outline" size="sm" onClick={() => navigate("onboarding")} className="gap-1.5">
                <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                {t("settings.editProfile")}
              </Button>
            </div>
            {profile ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">{t("onboarding.step.degree")}</dt>
                <dd className="font-medium">
                  {profile.degreeLevel === "bachelor" ? t("onboarding.degree.bachelor") :
                   profile.degreeLevel === "master" ? t("onboarding.degree.master") :
                   profile.degreeLevel === "phd" ? t("onboarding.degree.phd") : t("onboarding.degree.undecided")}
                </dd>
                {profile.targetIntakeYear && (
                  <>
                    <dt className="text-muted-foreground">{t("onboarding.step.intake")}</dt>
                    <dd className="font-medium">{profile.targetIntakeTerm === "spring" ? "Spring" : "Fall"} {profile.targetIntakeYear}</dd>
                  </>
                )}
                {profile.qualifications.length > 0 && (
                  <>
                    <dt className="text-muted-foreground">{t("onboarding.step.education")}</dt>
                    <dd className="font-medium">
                      {profile.qualifications.map((q) => `${q.level}${q.grades ? ` (${q.grades})` : ""}`).join("; ")}
                    </dd>
                  </>
                )}
                {profile.tests.length > 0 && (
                  <>
                    <dt className="text-muted-foreground">{t("onboarding.lang.tests")}</dt>
                    <dd className="font-medium">{profile.tests.map((test) => `${test.testType} ${test.score}`).join("; ")}</dd>
                  </>
                )}
                {profile.annualContributionBdt !== undefined && (
                  <>
                    <dt className="text-muted-foreground">{t("onboarding.money.contribution")}</dt>
                    <dd className="font-medium">৳{profile.annualContributionBdt.toLocaleString("en-IN")}{profile.financeUncertain ? " ~" : ""}</dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">{t("plan.emptyBody")}</p>
            )}
          </CardContent>
        </Card>

        {/* Language */}
        <Card className="border-border/70 bg-card">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
                <Languages className="h-4 w-4 text-leaf" aria-hidden="true" />
                {t("settings.language")}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {lang === "bn" ? "সম্পূর্ণ ইন্টারফেস বাংলায় পাওয়া যায়।" : "The full interface is available in Bangla."}
              </p>
            </div>
            <div role="group" aria-label={t("settings.language")} className="flex gap-2">
              <Button variant={lang === "en" ? "secondary" : "outline"} size="sm" onClick={() => setLang("en")} aria-pressed={lang === "en"}>
                English
              </Button>
              <Button variant={lang === "bn" ? "secondary" : "outline"} size="sm" onClick={() => setLang("bn")} aria-pressed={lang === "bn"}>
                বাংলা
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Account */}
        <Card className="border-border/70 bg-card">
          <CardContent className="p-5">
            <h2 className="mb-3 text-base font-semibold tracking-tight">{t("settings.account")}</h2>
            {user ? (
              <>
                <p className="text-sm font-medium">{user.email}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {user.role === "admin" ? <Badge variant="outline" className="border-coral/50">admin</Badge> : null}
                </p>
                <Separator className="my-4" />
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm" className="gap-1.5">
                    <a href="/api/export/plan">
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("settings.export")}
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="gap-1.5">
                    <a href="/api/calendar/ics">
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("cal.exportICS")}
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" onClick={signOut}>
                    {t("auth.signOut")}
                  </Button>
                </div>
                <Separator className="my-4" />
                {!confirmDelete ? (
                  <Button variant="ghost" size="sm" className="text-destructive gap-1.5" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("settings.deleteAccount")}
                  </Button>
                ) : (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                    <p className="text-xs leading-relaxed text-destructive">{t("settings.deleteWarn")}</p>
                    <div className="mt-2 flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>{t("common.cancel")}</Button>
                      <Button variant="destructive" size="sm" onClick={deleteAccount}>{t("common.confirm")}</Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted-foreground">{t("auth.guestNotice")}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={onSignIn} className="gap-1.5">
                    <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("auth.signUp")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={onSignIn}>{t("auth.signIn")}</Button>
                  <Button variant="outline" size="sm" onClick={exportGuestData} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("settings.export")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lang === "bn" ? "অতিথি ডেটা JSON ফাইলে এক্সপোর্ট হয় — নিজ দায়িত্বে সংরক্ষণ করুন।" : "Guest data exports as a JSON file — store it yourself."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Policy links */}
        <Card className="border-border/70 bg-card">
          <CardContent className="flex flex-wrap gap-4 p-5 text-sm">
            <button onClick={() => navigate("sources")} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
              {t("footer.links")}
            </button>
            <a
              href="https://github.com/Shamimhasan8/Study-Abroad/blob/main/DATA_POLICY.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {t("footer.privacy")}
            </a>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
