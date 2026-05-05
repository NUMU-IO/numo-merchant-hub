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

  const availableSections = useMemo(() => {
    if (!schemas) return [];
    return schemas.sections.filter((s) => {
      // Only show sections that have presets (i.e., are addable by merchants)
      if (!s.presets || s.presets.length === 0) return false;
      if (!search) return true;
      const name = locale === "ar"
        ? s.locales?.ar?.name || s.name
        : s.locales?.en?.name || s.name;
      return name.toLowerCase().includes(search.toLowerCase());
    });
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

        {/* Section grid */}
        <div className="max-h-80 overflow-y-auto px-4 pb-4">
          {availableSections.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {locale === "ar" ? "لا توجد أقسام متاحة." : "No sections available."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {availableSections.map((schema) => {
                const name = locale === "ar"
                  ? schema.locales?.ar?.name || schema.name
                  : schema.locales?.en?.name || schema.name;
                return (
                  <button
                    key={schema.type}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors",
                      "hover:border-primary hover:bg-primary/5",
                    )}
                    onClick={() => {
                      addSection(schema.type, 0);
                    }}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <LayoutGrid className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <span className="text-xs font-medium">{name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
