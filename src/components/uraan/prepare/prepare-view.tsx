"use client";

/**
 * PrepareView — the six-tab preparation workspace. Tab selection is bound to
 * the app store (`prepareTab`) so navigation into a specific tool survives
 * reloads and deep links from other views. Guests get the same tools with an
 * inline notice; only the public AI practice endpoint keeps working unsigned.
 */
import { useI18n } from "@/lib/i18n";
import { useAppStore, type PrepareTab } from "@/lib/store";
import type { ComponentType } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Languages,
  BookOpen,
  PenLine,
  Users,
  FlaskConical,
  FolderLock,
} from "lucide-react";
import { LanguageTab } from "./language-tab";
import { ExperienceTab } from "./experience-tab";
import { WritingTab } from "./writing-tab";
import { RecommendersTab } from "./recommenders-tab";
import { ResearchTab } from "./research-tab";
import { DocumentsTab } from "./documents-tab";

const TABS: { value: PrepareTab; icon: typeof Languages }[] = [
  { value: "language", icon: Languages },
  { value: "experience", icon: BookOpen },
  { value: "writing", icon: PenLine },
  { value: "recommenders", icon: Users },
  { value: "research", icon: FlaskConical },
  { value: "documents", icon: FolderLock },
];

const CONTENT: Record<PrepareTab, ComponentType> = {
  language: LanguageTab,
  experience: ExperienceTab,
  writing: WritingTab,
  recommenders: RecommendersTab,
  research: ResearchTab,
  documents: DocumentsTab,
};

export function PrepareView() {
  const { t } = useI18n();
  const prepareTab = useAppStore((s) => s.prepareTab);
  const setPrepareTab = useAppStore((s) => s.setPrepareTab);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <header className="uraan-fade-up">
        <h1 className="font-display text-[26px] font-bold tracking-tight sm:text-3xl sm:text-3xl">
          {t("prepare.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t("prepare.subtitle")}
        </p>
      </header>

      <Tabs
        value={prepareTab}
        onValueChange={(value) => setPrepareTab(value as PrepareTab)}
        className="mt-6"
      >
        <TabsList
          className="grid h-auto w-full grid-cols-3 gap-1 sm:grid-cols-6"
          aria-label={t("prepare.title")}
        >
          {TABS.map(({ value, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="gap-1.5 py-2 text-xs sm:py-1.5 sm:text-sm"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {t(`prepare.tab.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map(({ value }) => {
          const TabBody = CONTENT[value];
          return (
            <TabsContent key={value} value={value} className="mt-6 focus-visible:outline-none">
              <div className="uraan-fade-up">
                <TabBody />
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </main>
  );
}
