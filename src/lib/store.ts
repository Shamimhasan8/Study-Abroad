"use client";

/**
 * Uraan app store — unified client state.
 *
 * Guests: state persists to localStorage (answers, plan, shortlist…).
 * Signed-in users: the server database is the source of truth; the store is
 * the hydrated cache, and mutations go through API routes first.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ApplicationRecord,
  EvaluationSummary,
  PlanData,
  ProfileData,
  SessionUser,
} from "./types";

export type View =
  | "home"
  | "onboarding"
  | "journey"
  | "explore"
  | "detail"
  | "compare"
  | "prepare"
  | "applications"
  | "calendar"
  | "sources"
  | "admin"
  | "settings";

export type PrepareTab =
  | "language"
  | "experience"
  | "writing"
  | "recommenders"
  | "research"
  | "documents";

interface AppState {
  // transient navigation
  view: View;
  detailSlug: string | null;
  prepareTab: PrepareTab;
  compareSlugs: string[];

  // identity
  user: SessionUser | null;

  // guest→account merge idempotency key (persisted; one per snapshot)
  importId: string | null;

  // domain state
  profile: ProfileData | null;
  plan: PlanData | null;
  goalSlug: string | null;
  shortlist: string[];
  applications: ApplicationRecord[];
  evaluations: Record<string, EvaluationSummary>;

  // actions
  navigate: (view: View, detailSlug?: string) => void;
  setPrepareTab: (tab: PrepareTab) => void;
  toggleCompare: (slug: string) => void;
  clearCompare: () => void;

  setUser: (user: SessionUser | null) => void;
  ensureImportId: () => string;
  clearImportId: () => void;
  setProfile: (profile: ProfileData | null) => void;
  patchProfile: (partial: Partial<ProfileData>) => void;

  setPlan: (plan: PlanData | null) => void;
  patchTask: (
    taskId: string,
    patch: { status?: PlanData["tasks"][number]["status"]; notes?: string; userEdited?: boolean },
  ) => void;

  setGoal: (slug: string | null) => void;
  toggleShortlist: (slug: string) => void;
  setShortlist: (slugs: string[]) => void;

  setApplications: (apps: ApplicationRecord[]) => void;
  upsertApplication: (app: ApplicationRecord) => void;
  removeApplication: (id: string) => void;

  setEvaluation: (slug: string, evaluation: EvaluationSummary) => void;

  resetDomain: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      view: "home",
      detailSlug: null,
      prepareTab: "language",
      compareSlugs: [],

      user: null,

      importId: null,

      profile: null,
      plan: null,
      goalSlug: null,
      shortlist: [],
      applications: [],
      evaluations: {},

      navigate: (view, detailSlug) =>
        set({ view, detailSlug: detailSlug ?? (view === "detail" ? get().detailSlug : null) }),

      setPrepareTab: (prepareTab) => set({ prepareTab }),

      toggleCompare: (slug) => {
        const current = get().compareSlugs;
        if (current.includes(slug)) {
          set({ compareSlugs: current.filter((s) => s !== slug) });
        } else if (current.length < 3) {
          set({ compareSlugs: [...current, slug] });
        }
      },

      clearCompare: () => set({ compareSlugs: [] }),

      setUser: (user) => set({ user }),

      ensureImportId: () => {
        const existing = get().importId;
        if (existing) return existing;
        const generated =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `imp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        set({ importId: generated });
        return generated;
      },

      clearImportId: () => set({ importId: null }),

      setProfile: (profile) => set({ profile }),

      patchProfile: (partial) => {
        const current = get().profile;
        set({ profile: current ? { ...current, ...partial } : (partial as ProfileData) });
      },

      setPlan: (plan) => set({ plan }),

      patchTask: (taskId, patch) => {
        const plan = get().plan;
        if (!plan) return;
        set({
          plan: {
            ...plan,
            tasks: plan.tasks.map((task) =>
              task.id === taskId ? { ...task, ...patch } : task,
            ),
          },
        });
      },

      setGoal: (goalSlug) => set({ goalSlug }),

      toggleShortlist: (slug) => {
        const current = get().shortlist;
        set({
          shortlist: current.includes(slug)
            ? current.filter((s) => s !== slug)
            : [...current, slug],
        });
      },

      setShortlist: (shortlist) => set({ shortlist }),

      setApplications: (applications) => set({ applications }),

      upsertApplication: (app) => {
        const current = get().applications;
        const idx = current.findIndex((a) => a.id === app.id);
        set({
          applications:
            idx >= 0
              ? current.map((a) => (a.id === app.id ? app : a))
              : [...current, app],
        });
      },

      removeApplication: (id) =>
        set({ applications: get().applications.filter((a) => a.id !== id) }),

      setEvaluation: (slug, evaluation) =>
        set({ evaluations: { ...get().evaluations, [slug]: evaluation } }),

      resetDomain: () =>
        set({
          profile: null,
          plan: null,
          goalSlug: null,
          shortlist: [],
          applications: [],
          evaluations: {},
        }),
    }),
    {
      name: "uraan.state",
      storage: createJSONStorage(() => localStorage),
      // Persist only durable domain state — navigation and identity are
      // re-derived on load (session from cookie, view starts at home).
      partialize: (state) => ({
        importId: state.importId,
        profile: state.profile,
        plan: state.plan,
        goalSlug: state.goalSlug,
        shortlist: state.shortlist,
        applications: state.applications,
        evaluations: state.evaluations,
      }),
    },
  ),
);
