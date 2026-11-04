"use client";

/** Uraan footer — honest coverage disclosure, always at the bottom. */
import { useI18n } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { PaperPlaneMark } from "./illustrations";

export function UraanFooter() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);

  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2.5">
            <PaperPlaneMark width={22} height={22} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{t("app.name")} · {t("app.tagline")}</p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                {t("footer.coverage")}
              </p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                {t("footer.honesty")}
              </p>
            </div>
          </div>
          <nav aria-label="Footer" className="flex flex-col gap-1.5 text-sm">
            <button
              onClick={() => navigate("sources")}
              className="text-left text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("footer.links")}
            </button>
            <a
              href="https://github.com/Shamimhasan8/Study-Abroad/blob/main/DATA_POLICY.md"
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("footer.privacy")}
            </a>
            <span className="text-muted-foreground/70">{t("footer.rights")}</span>
          </nav>
        </div>
      </div>
    </footer>
  );
}
