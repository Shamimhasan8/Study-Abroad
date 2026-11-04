"use client";

/**
 * Auth dialog — sign in / create account, with explicit guest→account merge.
 * Guest data moves into the account exactly once, never duplicated.
 */
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SessionUser } from "@/lib/types";

type Mode = "login" | "register";

export function AuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user, setUser, profile, plan, shortlist, resetDomain } = useAppStore();
  const [mode, setMode] = useState<Mode>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mergePrompt, setMergePrompt] = useState(false);

  const hasGuestData = Boolean(profile || plan || shortlist.length > 0);

  const authenticate = async () => {
    setBusy(true);
    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast({
          title: mode === "login" ? t("auth.loginFailed") : json.error === "email_taken" ? t("auth.emailTaken") : json.error === "weak_password" ? t("auth.weakPassword") : t("common.error"),
          variant: "destructive",
        });
        return;
      }
      setUser(json.data.user as SessionUser);
      if (mode === "register" && hasGuestData) {
        setMergePrompt(true); // explicit merge question before moving data
      } else {
        await hydrateServerState();
        onOpenChange(false);
      }
    } catch {
      toast({ title: t("common.error"), description: t("common.errorHint"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const hydrateServerState = async () => {
    try {
      const res = await fetch("/api/state");
      const json = await res.json();
      if (json.ok) {
        const s = json.data;
        if (s.profile) useAppStore.getState().setProfile(s.profile);
        if (s.plan) useAppStore.getState().setPlan(s.plan);
        useAppStore.getState().setApplications(s.applications ?? []);
        if (s.goalSlug) useAppStore.getState().setGoal(s.goalSlug);
        if (s.shortlist) useAppStore.getState().setShortlist(s.shortlist);
      }
    } catch {
      /* state hydration failure keeps local state; retry on next action */
    }
  };

  const mergeGuest = async () => {
    setBusy(true);
    try {
      const state = useAppStore.getState();
      await fetch("/api/sync/merge-guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: state.profile,
          plan: state.plan,
          shortlist: state.shortlist,
          goalSlug: state.goalSlug,
          applications: state.applications,
        }),
      });
      resetDomain(); // guest copy cleared after the one-time move
      await hydrateServerState();
      onOpenChange(false);
      toast({ title: t("common.saved") });
    } catch {
      toast({ title: t("common.error"), description: t("common.errorHint"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const skipMerge = async () => {
    resetDomain();
    await hydrateServerState();
    onOpenChange(false);
  };

  // Signed-in view of the dialog (rare — e.g. opened via settings)
  if (user && !mergePrompt) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{user.email}</DialogTitle>
            <DialogDescription>{t("auth.signOut")}?</DialogDescription>
          </DialogHeader>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  if (mergePrompt) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("auth.mergeTitle")}</DialogTitle>
            <DialogDescription>{t("auth.mergeBody")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={skipMerge} disabled={busy}>
              {t("auth.mergeSkip")}
            </Button>
            <Button onClick={mergeGuest} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {t("auth.mergeConfirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === "login" ? t("auth.signIn") : t("auth.signUp")}
          </DialogTitle>
          <DialogDescription>{t("auth.guestPersist")}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
              toast({ title: t("auth.invalidEmail"), variant: "destructive" });
              return;
            }
            void authenticate();
          }}
        >
          {mode === "register" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auth-name">{t("auth.name")}</Label>
              <Input
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="bg-card"
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="auth-email">{t("auth.email")}</Label>
            <Input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="bg-card"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="auth-password">{t("auth.password")}</Label>
            <Input
              id="auth-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="bg-card"
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {mode === "login" ? t("auth.signIn") : t("auth.signUp")}
          </Button>
        </form>
        <button
          className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? t("auth.noAccount") + " " + t("auth.signUp") : t("auth.haveAccount") + " " + t("auth.signIn")}
        </button>
      </DialogContent>
    </Dialog>
  );
}
