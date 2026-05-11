/**
 * AddSectionDialog — Modal for browsing and adding available section types.
 *
 * Features:
 *  - Search/filter sections by name
 *  - Grid display with section previews
 *  - Bilingual labels
 *  - Closes on selection
 */

import { useState, useMemo } from "react";
import { X, Search, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCustomizerStore } from "../../store/customizerStore";

export function AddSectionDialog() {
  const schemas = useCustomizerStore((s) => s.schemas);
  const locale = useCustomizerStore((s) => s.locale);
  const showAddSection = useCustomizerStore((s) => s.showAddSection);
  const setShowAddSection = useCustomizerStore((s) => s.setShowAddSection);
  const addSection = useCustomizerStore((s) => s.addSection);

  const [search, setSearch] = useState("");

  // Flatten section schemas → one entry per preset so merchants pick a
  // STARTING VARIANT, not just a section type. A "Hero" section with
  // three presets (image-left, image-right, full-bleed) shows up as
  // three cards. When a section has only one preset its name is shown
  // verbatim; when it has many we append the preset's name as a
  // sub-label so the cards don't all read "Hero".
  const presetCards = useMemo(() => {
    if (!schemas) return [];
    type Card = {
      sectionType: string;
      presetIndex: number;
      sectionName: string;
      presetName: string;
      hasMultiplePresets: boolean;
    };
    const cards: Card[] = [];
    for (const s of schemas.sections) {
      if (!s.presets || s.presets.length === 0) continue;
      const sectionName = locale === "ar"
        ? s.locales?.ar?.name || s.name
        : s.locales?.en?.name || s.name;
      const hasMultiplePresets = s.presets.length > 1;
      s.presets.forEach((preset, idx) => {
        const presetName =
          (locale === "ar"
            ? preset.locales?.ar?.name
            : preset.locales?.en?.name) ||
          preset.name ||
          (hasMultiplePresets ? `Variant ${idx + 1}` : sectionName);
        cards.push({
          sectionType: s.type,
          presetIndex: idx,
          sectionName,
          presetName,
          hasMultiplePresets,
        });
      });
    }
    if (!search) return cards;
    const q = search.toLowerCase();
    return cards.filter(
      (c) =>
        c.sectionName.toLowerCase().includes(q) ||
        c.presetName.toLowerCase().includes(q),
    );
  }, [schemas, search, locale]);

  if (!showAddSection) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">
            {locale === "ar" ? "إضافة قسم" : "Add section"}
          </h2>
          <button
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={() => setShowAddSection(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={locale === "ar" ? "بحث عن قسم..." : "Search sections..."}
              className="pl-9"
              dir={locale === "ar" ? "rtl" : "ltr"}
            />
          </div>
        </div>

        {/* Section grid — one card per preset variant */}
        <div className="max-h-80 overflow-y-auto px-4 pb-4">
          {presetCards.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {locale === "ar" ? "لا توجد أقسام متاحة." : "No sections available."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {presetCards.map((card) => (
                <button
                  key={`${card.sectionType}:${card.presetIndex}`}
                  type="button"
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors",
                    "hover:border-primary hover:bg-primary/5",
                  )}
                  onClick={() => {
                    addSection(card.sectionType, card.presetIndex);
                    setShowAddSection(false);
                  }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <LayoutGrid className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium">{card.presetName}</span>
                  {card.hasMultiplePresets && (
                    <span className="text-[10px] text-muted-foreground">
                      {card.sectionName}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
