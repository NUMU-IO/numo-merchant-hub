/**
 * EditorModeSwitcher — top-of-sidebar tab strip that toggles between
 * Sections, Theme settings, and App embeds. Shopify-parity entry point.
 *
 * Lives just above the panel router in ThemeCustomizerV3's left column,
 * so every panel inherits the same chrome. Bilingual labels (EN/AR)
 * and RTL-aware via the editor locale.
 */

import { useCustomizerStore } from "../../store/customizerStore";
import type { EditorMode } from "../../types";
import { Layers, Settings, Puzzle, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

const TABS: Array<{
  mode: EditorMode;
  icon: typeof Layers;
  label: { en: string; ar: string };
}> = [
  {
    mode: "sections",
    icon: Layers,
    label: { en: "Sections", ar: "الأقسام" },
  },
  {
    mode: "theme-settings",
    icon: Settings,
    label: { en: "Theme settings", ar: "الثيم" },
  },
  {
    mode: "wording",
    icon: Type,
    label: { en: "Content", ar: "النصوص" },
  },
  {
    mode: "app-embeds",
    icon: Puzzle,
    label: { en: "App embeds", ar: "التطبيقات" },
  },
];

export function EditorModeSwitcher() {
  const activeMode = useCustomizerStore((s) => s.activeMode);
  const setActiveMode = useCustomizerStore((s) => s.setActiveMode);
  const locale = useCustomizerStore((s) => s.locale);
  const isAr = locale === "ar";

  // Phase 5.2 — the "App embeds" tab is hidden unless a super-admin turns
  // it on platform-wide (numu-admin → Platform config). Default OFF so the
  // editor never advertises a dead "Coming soon" feature. The flag flows
  // through /auth/me feature_flags as `theme_app_embeds`.
  const appEmbedsEnabled = useFeatureFlag("theme_app_embeds");
  const tabs = TABS.filter((t) => t.mode !== "app-embeds" || appEmbedsEnabled);

  return (
    <div
      role="tablist"
      aria-label={isAr ? "وضع المحرر" : "Editor mode"}
      // Tight tab strip — columns split evenly (3 by default, 4 when the
      // App-embeds tab is enabled), each compact enough for the longer AR
      // labels.
      className={cn(
        "grid gap-1 border-b bg-muted/30 p-2",
        tabs.length === 4 ? "grid-cols-4" : "grid-cols-3",
      )}
    >
      {tabs.map(({ mode, icon: Icon, label }) => {
        const isActive = activeMode === mode;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={isActive ? "true" : "false"}
            onClick={() => setActiveMode(mode)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-[11px] font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="truncate">{label[isAr ? "ar" : "en"]}</span>
          </button>
        );
      })}
    </div>
  );
}
