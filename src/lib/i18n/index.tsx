"use client";

/**
 * Uraan i18n provider — English/Bangla with real translated strings.
 * Persists the choice in localStorage and keeps <html lang> in sync so
 * screen readers and Bengali typography rules apply correctly.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en, type TranslationKey } from "./en";
import { bn } from "./bn";
import { useAppStore } from "@/lib/store";

export type Language = "en" | "bn";

const DICTS: Record<Language, Record<TranslationKey, string>> = { en, bn };
const STORAGE_KEY = "uraan.language";

type I18nContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  // Hydrate from storage once on mount (client only). Reading storage in an
  // effect (not a lazy initializer) keeps SSR markup deterministic — the
  // stored language applies after hydration without a markup mismatch.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate post-hydration storage read
      if (stored === "en" || stored === "bn") setLangState(stored);
    } catch {
      /* storage unavailable — stay with default */
    }
  }, []);

  // Keep <html lang> in sync for accessibility + typography.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const dict = DICTS[lang] ?? DICTS.en;
      const template = dict[key] ?? en[key] ?? key;
      return interpolate(template, vars);
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

/** Bengali numerals for Bangla UI (10 → ১০). */
export function localizeDigits(n: number, lang: Language): string {
  const s = String(n);
  if (lang !== "bn") return s;
  const bnDigits = "০১২৩৪৫৬৭৮৯";
  return s.replace(/\d/g, (d) => bnDigits[Number(d)]);
}

/**
 * Coverage copy derived from LIVE catalogue stats (audited fix P0-2):
 * loading / service failure / genuine zero / live count each render their
 * own honest sentence — a hardcoded number can never outlive the data.
 */
export function useCoverageLine(noteKey: TranslationKey, zeroKey?: TranslationKey): string {
  const { t, lang } = useI18n();
  const stats = useAppStore((s) => s.stats);
  if (stats.status === "loading") return t("common.coverageLoading");
  if (stats.status === "error" || stats.opportunities === null) {
    return t("common.coverageUnavailable");
  }
  if (stats.opportunities === 0) return t(zeroKey ?? "home.coverageZero");
  return t(noteKey, { count: localizeDigits(stats.opportunities, lang) });
}
