"use client";

/**
 * Auth dialog — sign in / create account, with explicit guest→account merge.
 *
 * Merge safety contract (audited fix P0-5 / P1-1):
 * - Guest data is cleared ONLY after the server confirms a durable merge
 *   (200 + validated receipt). Any failure keeps the guest's copy and
 *   offers retry or export.
 * - A 409 conflict opens a preview of server-plan vs guest-plan; replace
 *   happens only after the user accepts it (confirmReplace retry).
 * - Retries reuse the same importId, so the server treats them as one
 *   import and never duplicates the plan.
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

interface ConflictPreview {
  existing: { goalSlug: string | null; horizonMonths: number; generatedAt: string; taskCount: number; completed: number };
  incoming: { goalSlug: string | null; horizonMonths: number; taskCount: number; completed: number };
}

export function AuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user, setUser, profile, plan, shortlist, resetDomain, ensureImportId, clearImportId } = useAppStore();
  const [mode, setMode] = useState<Mode>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mergePrompt, setMergePrompt] = useState(false);
  const [conflict, setConflict] = useState<ConflictPreview | null>(null);
  const [mergeFailed, setMergeFailed] = useState(false);

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
      if (res.ok && json.ok) {
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

  const exportGuestData = () => {
    const state = useAppStore.getState();
    const blob = new Blob(
      [JSON.stringify({ profile: state.profile, plan: state.plan, goalSlug: state.goalSlug, shortlist: state.shortlist, applications: state.applications }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "uraan-guest-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const mergeGuest = async (opts?: { confirmReplace?: boolean }) => {
    setBusy(true);
    setMergeFailed(false);
    try {
      const state = useAppStore.getState();
      const importId = state.ensureImportId();
      const res = await fetch("/api/sync/merge-guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importId,
          confirmReplace: opts?.confirmReplace ?? false,
          profile: state.profile,
          plan: state.plan,
          shortlist: state.shortlist,
          goalSlug: state.goalSlug,
          applications: state.applications,
        }),
      });
      const json = await res.json().catch(() => null);

      // Conflict: open the preview; nothing has been touched yet.
      if (res.status === 409 && json?.error === "conflict") {
        setConflict(json.data as ConflictPreview);
        return;
      }

      // Durable success requires: HTTP ok + envelope ok + receipt validation.
      const receipt = json?.data;
      const durable =
        res.ok &&
        json?.ok === true &&
        receipt?.merged === true &&
        receipt?.importId === importId &&
        typeof receipt?.counts === "object";
      if (!durable) {
        // Guest data is PRESERVED — failure must never erase the only copy.
        setMergeFailed(true);
        toast({
          title: t("common.error"),
          description: t("auth.mergeKept"),
          variant: "destructive",
        });
        return;
      }

      clearImportId();
      resetDomain(); // only now — after the confirmed durable merge
      await hydrateServerState();
      onOpenChange(false);
      toast({
        title: t("common.saved"),
        description: t("auth.mergeReceipt", {
          tasks: String(receipt.counts.tasks ?? 0),
          completed: String(receipt.counts.completedTasks ?? 0),
        }),
      });
    } catch {
      // Network/timeout: guest copy stays intact; retry or export offered.
      setMergeFailed(true);
      toast({ title: t("common.error"), description: t("auth.mergeKept"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const keepServerPlan = async () => {
    // Keep the account's existing plan; profile/shortlist/applications can
    // still merge additively (idempotent upserts server-side).
    setBusy(true);
    try {
      const state = useAppStore.getState();
      const importId = state.ensureImportId();
      const res = await fetch("/api/sync/merge-guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importId,
          profile: state.profile,
          shortlist: state.shortlist,
          goalSlug: state.goalSlug,
          applications: state.applications,
          // no plan: nothing to replace — additive merge only
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        clearImportId();
        resetDomain();
        await hydrateServerState();
        onOpenChange(false);
      } else {
        setMergeFailed(true);
      }
    } catch {
      setMergeFailed(true);
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

  if (conflict) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("auth.conflictTitle")}</DialogTitle>
            <DialogDescription>{t("auth.conflictBody")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-semibold">{t("auth.conflictServer")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{conflict.existing.goalSlug ?? "—"}</p>
              <p className="mt-2 text-xs">{t("auth.conflictMeta", { tasks: String(conflict.existing.taskCount), completed: String(conflict.existing.completed) })}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm font-semibold">{t("auth.conflictGuest")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{conflict.incoming.goalSlug ?? "—"}</p>
              <p className="mt-2 text-xs">{t("auth.conflictMeta", { tasks: String(conflict.incoming.taskCount), completed: String(conflict.incoming.completed) })}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => void keepServerPlan()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {t("auth.conflictKeep")}
            </Button>
            <Button onClick={() => void mergeGuest({ confirmReplace: true })} disabled={busy}>
              {t("auth.conflictReplace")}
            </Button>
          </div>
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
          {mergeFailed ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <p>{t("auth.mergeKept")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void mergeGuest()}>
                  {t("auth.retry")}
                </Button>
                <Button variant="outline" size="sm" onClick={exportGuestData}>
                  {t("auth.exportData")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={skipMerge} disabled={busy}>
                {t("auth.mergeSkip")}
              </Button>
              <Button onClick={() => void mergeGuest()} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {t("auth.mergeConfirm")}
              </Button>
            </div>
          )}
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
