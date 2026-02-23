/**
 * AddSectionSheet — slide-out panel that shows available section types to add.
 *
 * Groups sections by their preset categories (Hero, Collection, Promotional, etc.).
 * Each item shows section name, nameAr, and an "Add" button.
 */

import { useMemo } from "react";
import type { SectionSchemaData } from "@/services/themeApi";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus } from "lucide-react";

export interface AddSectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionSchemas: SectionSchemaData[];
  onAddSection: (sectionType: string, presetIndex?: number) => void;
}

interface CategoryGroup {
  category: string;
  categoryAr?: string;
  items: Array<{
    schema: SectionSchemaData;
    presetIndex?: number;
    presetName: string;
    presetNameAr?: string;
  }>;
}

export function AddSectionSheet({
  open,
  onOpenChange,
  sectionSchemas,
  onAddSection,
}: AddSectionSheetProps) {
  // Group sections by preset category. Sections without presets go into "Other".
  const groups = useMemo(() => buildCategoryGroups(sectionSchemas), [sectionSchemas]);

  const handleAdd = (sectionType: string, presetIndex?: number) => {
    onAddSection(sectionType, presetIndex);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Add Section</SheetTitle>
          <SheetDescription>
            Choose a section type to add to your page.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {groups.map((group, idx) => (
            <div key={group.category}>
              {idx > 0 && <Separator className="mb-4" />}

              <h3 className="mb-3 text-sm font-semibold text-foreground">
                {group.categoryAr || group.category}
              </h3>

              <div className="space-y-2">
                {group.items.map((item, itemIdx) => (
                  <div
                    key={`${item.schema.type}-${item.presetIndex ?? itemIdx}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {item.presetNameAr || item.presetName}
                      </p>
                      {item.presetNameAr && item.presetName && (
                        <p className="text-xs text-muted-foreground truncate">
                          {item.presetName}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.schema.type}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1"
                      onClick={() => handleAdd(item.schema.type, item.presetIndex)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Empty state */}
          {groups.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No section types available.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Build category groups from section schemas + their presets.
// ---------------------------------------------------------------------------

function buildCategoryGroups(schemas: SectionSchemaData[]): CategoryGroup[] {
  const map = new Map<string, CategoryGroup>();

  for (const schema of schemas) {
    if (schema.presets && schema.presets.length > 0) {
      // Each preset may define its own category
      schema.presets.forEach((preset, presetIdx) => {
        const cat = preset.category || "Other";
        if (!map.has(cat)) {
          map.set(cat, {
            category: cat,
            categoryAr: preset.categoryAr,
            items: [],
          });
        }
        map.get(cat)!.items.push({
          schema,
          presetIndex: presetIdx,
          presetName: preset.name || schema.name,
          presetNameAr: preset.nameAr || schema.nameAr,
        });
      });
    } else {
      // No presets — place under "Other"
      const cat = "Other";
      if (!map.has(cat)) {
        map.set(cat, { category: cat, items: [] });
      }
      map.get(cat)!.items.push({
        schema,
        presetIndex: undefined,
        presetName: schema.name,
        presetNameAr: schema.nameAr,
      });
    }
  }

  return Array.from(map.values());
}
