/**
 * VariantPicker — variant tab strip above the section list.
 *
 * Wave 7 deliverable. Themes can ship multiple "looks" of the same
 * design (Empire Default / Empire Bold / Empire Soft) under
 * `theme.json` → `variants[]`. Each variant has:
 *
 *   {
 *     id: "bold",
 *     name: "Bold",
 *     settings_override: { global_settings: { primary_color: "#ff0066" } }
 *   }
 *
 * When the merchant clicks a variant chip, we merge the override into
 * the current draft via `updateGlobalSetting` (one entry per leaf so
 * undo works). The merchant's hand-edits persist where the override
 * doesn't conflict; conflicting keys get overwritten.
 *
 * Hidden when the manifest declares zero variants — most one-off
 * themes don't bother with variants, and we don't want an empty
 * picker eating sidebar real estate.
 *
 * The variant list comes from `schemas.theme_manifest.variants` —
 * we surface it via the customizer store's normalized schemas (which
 * NOW carries the manifest fields alongside section/setting schemas).
 * Falls back gracefully when the field isn't set.
 */

import { useMemo, useState } from "react";
import { Palette, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useCustomizerStore } from "../../store/customizerStore";
import type { EditorLocale } from "../../types";

export interface ThemeVariant {
  id: string;
  name: string;
  name_ar?: string;
  description?: string;
  /**
   * Setting overrides this variant applies on activation. Shape mirrors
   * the V3 themeSettings root — `global_settings`, `templates.<id>.sections.<id>.settings`,
   * `section_groups.<id>.sections.<id>.settings`. Only specified leaves
   * are overwritten.
   */
  settings_override?: {
    global_settings?: Record<string, unknown>;
    templates?: Record<string, unknown>;
    section_groups?: Record<string, unknown>;
  };
}

interface Props {
  variants: ThemeVariant[];
  locale: EditorLocale;
}

export function VariantPicker({ variants, locale }: Props) {
  const isAr = locale === "ar";
  const draft = useCustomizerStore((s) => s.draft);
  const updateGlobalSetting = useCustomizerStore(
    (s) => s.updateGlobalSetting,
  );
  const [pendingVariant, setPendingVariant] = useState<ThemeVariant | null>(null);

  // Detect the active variant by matching the current global settings
  // against each variant's override map. A variant matches if every
  // global_settings key it specifies is currently set to the variant's
  // value. Imperfect (the merchant may have hand-edited toward a
  // variant) but good enough for the visual "Active" pill.
  const activeId = useMemo(() => {
    if (!draft) return null;
    const globals = (draft.global_settings ?? {}) as Record<string, unknown>;
    for (const v of variants) {
      const expected = v.settings_override?.global_settings;
      if (!expected) continue;
      const allMatch = Object.entries(expected).every(
        ([k, val]) => globals[k] === val,
      );
      if (allMatch) return v.id;
    }
    return null;
  }, [draft, variants]);

  function hasUserEdits(variant: ThemeVariant): boolean {
    // Heuristic: warn if the merchant has tweaked any of the global
    // settings the variant override touches. We can't tell whether
    // those tweaks matched a different variant or were free-form, so
    // we treat the presence of differing values as "you have work
    // that will be overwritten".
    if (!draft) return false;
    const globals = (draft.global_settings ?? {}) as Record<string, unknown>;
    const expected = variant.settings_override?.global_settings ?? {};
    for (const [k, v] of Object.entries(expected)) {
      const current = globals[k];
      if (current !== undefined && current !== v) return true;
    }
    return false;
  }

  function applyVariant(v: ThemeVariant) {
    const overrides = v.settings_override?.global_settings ?? {};
    for (const [key, value] of Object.entries(overrides)) {
      updateGlobalSetting(key, value);
    }
    // Templates / section_groups overrides land in a follow-up — the
    // store's `updateSectionSetting` API requires (sectionId, key, value)
    // and we'd need to walk the override map. For Empire's bold variant
    // (which mostly touches global colors + font), global_settings
    // alone covers the visible difference. Track as wave-7-followup.
    setPendingVariant(null);
  }

  if (variants.length === 0) return null;

  return (
    <div className="border-b bg-muted/30 px-4 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Palette className="h-3 w-3" />
          {isAr ? "أسلوب الثيم" : "Theme style"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup">
        {variants.map((v) => {
          const isActive = activeId === v.id;
          const label = isAr ? v.name_ar ?? v.name : v.name;
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={isActive ? "true" : "false"}
              onClick={() => {
                if (isActive) return;
                if (hasUserEdits(v)) {
                  setPendingVariant(v);
                } else {
                  applyVariant(v);
                }
              }}
              className={cn(
                "flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:border-primary/40",
              )}
            >
              {isActive && <Check className="h-3 w-3" />}
              {label}
            </button>
          );
        })}
      </div>

      {/* Confirm before clobbering hand-edits */}
      <AlertDialog
        open={pendingVariant !== null}
        onOpenChange={(open) => !open && setPendingVariant(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {isAr ? "تطبيق أسلوب الثيم" : "Apply theme style"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isAr
                ? `سيتم استبدال بعض ألوان وخطوط متجرك بإعدادات أسلوب "${pendingVariant?.name}". يمكنك التراجع بعد التطبيق.`
                : `Switching to "${pendingVariant?.name}" will overwrite some of your colors and fonts. You can undo right after applying.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {isAr ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingVariant && applyVariant(pendingVariant)}
            >
              {isAr ? "تطبيق" : "Apply"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default VariantPicker;
