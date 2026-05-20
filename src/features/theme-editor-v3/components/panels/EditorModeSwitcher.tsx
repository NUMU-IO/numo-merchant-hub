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

  return (
    <div
      role="tablist"
      aria-label={isAr ? "وضع المحرر" : "Editor mode"}
      // Tight tab strip — three columns split evenly, each tab compact
      // enough that even the longer AR label "إعدادات الثيم" fits.
      className="grid grid-cols-4 gap-1 border-b bg-muted/30 p-2"
    >
      {TABS.map(({ mode, icon: Icon, label }) => {
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
