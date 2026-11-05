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
import type { PlanConfirmation } from "@/lib/planning/replan";
import type {
  ApplicationRecord,
  EvaluationSummary,
  MentorThreadMessage,
  PlanData,
  ProfileData,
  ServiceCapabilities,
  SessionUser,
} from "./types";

export type View =
  | "home"
  | "onboarding"
  | "workspace"
  | "task"
  | "explore"
  | "detail"
  | "compare"
  | "prepare"
  | "applications"
  | "calendar"
  | "funding"
  | "sources"
  | "admin"
  | "settings";

/** Legacy deep links (?view=journey) resolve to the workspace shell. */
export const VIEW_ALIASES: Record<string, View> = { journey: "workspace" };

export type PrepareTab =
  | "language"
  | "experience"
  | "writing"
  | "recommenders"
  | "research"
  | "documents";

export type ExploreFilters = {
  query: string;
  country: string;
  level: string;
  cycle: string;
};

interface AppState {
  // transient navigation
  view: View;
  detailSlug: string | null;
  /** Guided-task screen target (task id from the active plan). */
  activeTaskId: string | null;
  prepareTab: PrepareTab;
  compareSlugs: string[];

  // identity
  user: SessionUser | null;

  /** Which owner the persisted cache belongs to (null = guest). A cache
   * saved under another account is discarded on load — student A's data
   * can never render while student B is signed in. */
  ownerKey: string | null;
  /** True once the session (and, for accounts, /api/state) resolved. The
   * shell renders a skeleton until then — account-specific state is never
   * shown before its true owner is known. */
  hydrated: boolean;

  // guest→account merge idempotency key (persisted; one per snapshot)
  importId: string | null;

  /** True while a guest→account merge decision is still open (signed-in,
   * unmerged guest snapshot in local cache). Persisted so a reload cannot
   * silently clobber the snapshot with server state — the decision dialog
   * re-opens instead. Cleared by every merge outcome (merge/keep/skip). */
  mergePending: boolean;

  /** Live catalogue stats — derived, never hardcoded. status distinguishes
   * loading / ok / error so UI copy can degrade honestly. */
  stats: { opportunities: number | null; sources: number | null; status: "loading" | "ok" | "error" };

  /** Live service capabilities (probed server-side, ordinary-language copy
   * in the UI). null until /api/capabilities resolves. */
  capabilities: ServiceCapabilities | null;

  /** Student motion preference (in addition to the OS-level setting). */
  reduceMotion: boolean;

  /** Contextual mentor rail: hidden by the student (preference, persisted). */
  mentorHidden: boolean;
  /** Current mentor thread (in-memory; signed-in users load server history). */
  mentorThread: MentorThreadMessage[];
  /** Which surface the mentor is attached to right now. */
  mentorContext: { view: View; refId?: string } | null;

  /** Open replan confirmation (persisted preview awaiting cancel/confirm).
   * Shared so the scenario drawer, mentor actions, and the workspace gate
   * all render the SAME reviewed proposal. */
  replanConfirmation: PlanConfirmation | null;

  // domain state
  profile: ProfileData | null;
  plan: PlanData | null;
  goalSlug: string | null;
  shortlist: string[];
  applications: ApplicationRecord[];
  evaluations: Record<string, EvaluationSummary>;
  exploreFilters: ExploreFilters;

  // actions
  navigate: (view: View, detailSlug?: string, taskId?: string) => void;
  setPrepareTab: (tab: PrepareTab) => void;
  toggleCompare: (slug: string) => void;
  clearCompare: () => void;
  setExploreFilters: (filters: Partial<ExploreFilters>) => void;
  /** Apply a full state snapshot from the URL (deep link / back / forward). */
  applyFromUrl: (state: { view: View; detailSlug?: string | null; activeTaskId?: string | null; prepareTab?: PrepareTab; compareSlugs?: string[]; exploreFilters?: Partial<ExploreFilters> }) => void;

  setUser: (user: SessionUser | null) => void;
  syncOwner: (user: SessionUser | null) => void;
  setHydrated: (hydrated: boolean) => void;
  setStats: (stats: { opportunities: number | null; sources: number | null; status: "loading" | "ok" | "error" }) => void;
  setCapabilities: (capabilities: ServiceCapabilities | null) => void;
  setReduceMotion: (reduceMotion: boolean) => void;
  setMentorHidden: (hidden: boolean) => void;
  setMentorThread: (messages: MentorThreadMessage[]) => void;
  appendMentorMessage: (message: MentorThreadMessage) => void;
  clearMentorThread: () => void;
  setMentorContext: (context: { view: View; refId?: string } | null) => void;
  setReplanConfirmation: (confirmation: PlanConfirmation | null) => void;
  ensureImportId: () => string;
  clearImportId: () => void;
  setMergePending: (pending: boolean) => void;
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
      activeTaskId: null,
      prepareTab: "language",
      compareSlugs: [],

      user: null,

      ownerKey: null,
      hydrated: false,

      importId: null,

      mergePending: false,

      stats: { opportunities: null, sources: null, status: "loading" },
      capabilities: null,
      reduceMotion: false,
      mentorHidden: false,
      mentorThread: [],
      mentorContext: null,
      replanConfirmation: null,

      profile: null,
      plan: null,
      goalSlug: null,
      shortlist: [],
      applications: [],
      evaluations: {},
      exploreFilters: { query: "", country: "all", level: "all", cycle: "all" },

      navigate: (view, detailSlug, taskId) =>
        set({
          view,
          detailSlug: detailSlug ?? (view === "detail" ? get().detailSlug : null),
          activeTaskId: taskId ?? (view === "task" ? get().activeTaskId : null),
        }),

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

      setExploreFilters: (filters) =>
        set({ exploreFilters: { ...get().exploreFilters, ...filters } }),

      applyFromUrl: (state) =>
        // The URL is the SOURCE OF TRUTH in this direction (initial deep
        // link + browser back/forward). Absent params must RESET to their
        // defaults, not merge over current state: merging kept a popped
        // filter (e.g. level=master after Back) alive in the store, and the
        // store->URL sync then re-pushed it — cancelling the back/forward
        // navigation entirely.
        set({
          view: state.view,
          detailSlug: state.detailSlug ?? null,
          activeTaskId: state.activeTaskId ?? null,
          prepareTab: state.prepareTab ?? "language",
          compareSlugs: state.compareSlugs ?? [],
          exploreFilters: {
            query: "",
            country: "all",
            level: "all",
            cycle: "all",
            ...state.exploreFilters,
          },
        }),

      setUser: (user) => set({ user }),

      syncOwner: (user) => {
        const key = user?.id ?? null;
        const prev = get().ownerKey;
        if (prev === key) return;
        if (prev === null && key !== null) {
          // guest → account: guest data intentionally survives until the
          // explicit merge decision (merge/skip/conflict flows clear it).
          set({ ownerKey: key });
        } else {
          // logout, or account A → account B: discard the previous owner's
          // cached domain state entirely (including any merge decision that
          // belonged to that owner's session).
          set({
            ownerKey: key,
            profile: null,
            plan: null,
            goalSlug: null,
            shortlist: [],
            applications: [],
            evaluations: {},
            importId: null,
            mergePending: false,
          });
        }
      },

      setHydrated: (hydrated) => set({ hydrated }),

      setStats: (stats) => set({ stats }),

      setCapabilities: (capabilities) => set({ capabilities }),

      setReduceMotion: (reduceMotion) => set({ reduceMotion }),

      setMentorHidden: (mentorHidden) => set({ mentorHidden }),

      setMentorThread: (mentorThread) => set({ mentorThread }),

      appendMentorMessage: (message) =>
        set({ mentorThread: [...get().mentorThread, message] }),

      clearMentorThread: () => set({ mentorThread: [] }),

      setMentorContext: (mentorContext) => set({ mentorContext }),

      setReplanConfirmation: (replanConfirmation) => set({ replanConfirmation }),

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

      setMergePending: (mergePending) => set({ mergePending }),

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
        ownerKey: state.ownerKey,
        importId: state.importId,
        mergePending: state.mergePending,
        profile: state.profile,
        plan: state.plan,
        goalSlug: state.goalSlug,
        shortlist: state.shortlist,
        applications: state.applications,
        evaluations: state.evaluations,
        reduceMotion: state.reduceMotion,
        mentorHidden: state.mentorHidden,
      }),
    },
  ),
);
