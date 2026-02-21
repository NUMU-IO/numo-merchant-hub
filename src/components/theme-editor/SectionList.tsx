/**
 * SectionList — displays the ordered list of section instances from a template.
 *
 * Each item shows:
 * - Section name (from schema lookup) with type icon
 * - Enable / disable toggle (eye icon)
 * - Reorder up / down buttons
 * - Drag-and-drop reordering via grip handle
 * - Click to select for editing
 * - "Add Section" button at bottom
 */

import { useRef, useCallback, useMemo } from "react";
import type {
  TemplateConfigData,
  SectionSchemaData,
} from "@/services/themeApi";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Image,
  LayoutGrid,
  ShoppingBag,
  Megaphone,
  Star,
  Mail,
  Type,
  Sparkles,
  Settings2,
} from "lucide-react";

// Map section types to icons for visual clarity
const SECTION_ICONS: Record<string, typeof Image> = {
  hero: Image,
  categories: LayoutGrid,
  "featured-collection": ShoppingBag,
  "promo-banner": Megaphone,
  testimonials: Star,
  newsletter: Mail,
  marquee: Type,
};

export interface SectionListProps {
  template: TemplateConfigData;
  sectionSchemas: SectionSchemaData[];
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onToggleSection: (sectionId: string, disabled: boolean) => void;
  onAddSection: (sectionType: string, presetIndex?: number) => void;
  onRemoveSection: (sectionId: string) => void;
}

export function SectionList({
  template,
  sectionSchemas,
  selectedSectionId,
  onSelectSection,
  onReorder,
  onToggleSection,
  onAddSection,
  onRemoveSection,
}: SectionListProps) {
  const dragIndexRef = useRef<number | null>(null);
  const dragOverIndexRef = useRef<number | null>(null);

  // Build a lookup map: section type -> schema
  const schemaMap = useMemo(() => {
    const m = new Map<string, SectionSchemaData>();
    for (const s of sectionSchemas) {
      m.set(s.type, s);
    }
    return m;
  }, [sectionSchemas]);

  // Resolve a display name for a section instance
  const getSectionName = useCallback(
    (sectionId: string) => {
      const instance = template.sections[sectionId];
      if (!instance) return sectionId;
      const schema = schemaMap.get(instance.type);
      if (!schema) return instance.type;
      return schema.nameAr || schema.name;
    },
    [template.sections, schemaMap],
  );

  const getSectionType = useCallback(
    (sectionId: string) => {
      const instance = template.sections[sectionId];
      return instance?.type ?? sectionId;
    },
    [template.sections],
  );

  // Get a short subtitle for a section (setting count hint)
  const getSectionSubtitle = useCallback(
    (sectionId: string) => {
      const instance = template.sections[sectionId];
      if (!instance) return "";
      const schema = schemaMap.get(instance.type);
      if (!schema) return instance.type;
      const settingCount = schema.settings.length;
      const customized = Object.keys(instance.settings).length;
      if (customized > 0) return `${customized}/${settingCount} settings customized`;
      return `${settingCount} settings`;
    },
    [template.sections, schemaMap],
  );

  // DnD handlers
  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverIndexRef.current = index;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    const to = dragOverIndexRef.current;
    if (from !== null && to !== null && from !== to) {
      onReorder(from, to);
    }
    dragIndexRef.current = null;
    dragOverIndexRef.current = null;
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    dragOverIndexRef.current = null;
  };

  return (
    <div className="flex flex-col gap-1">
      {/* Section list */}
      {template.order.map((sectionId, index) => {
        const instance = template.sections[sectionId];
        if (!instance) return null;

        const isSelected = selectedSectionId === sectionId;
        const isDisabled = !!instance.disabled;
        const SectionIcon = SECTION_ICONS[instance.type] || Sparkles;

        return (
          <div
            key={sectionId}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            className={cn(
              "group flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all cursor-pointer",
              isSelected
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-transparent hover:border-border hover:bg-muted/50",
              isDisabled && "opacity-40",
            )}
            onClick={() => onSelectSection(sectionId)}
          >
            {/* Drag handle indicator */}
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50 cursor-grab active:cursor-grabbing" />

            {/* Section icon */}
            <div className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
            )}>
              <SectionIcon className="h-3.5 w-3.5" />
            </div>

            {/* Name + subtitle */}
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium leading-tight">{getSectionName(sectionId)}</p>
              <p className="truncate text-[11px] text-muted-foreground leading-tight mt-0.5">
                {getSectionSubtitle(sectionId)}
              </p>
            </div>

            {/* Edit chevron — always visible, indicates clickability */}
            <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground/60 group-hover:text-primary transition-colors" />

            {/* Actions — visible on hover or when selected */}
            <div
              className={cn(
                "flex items-center gap-0.5",
                !isSelected && "opacity-0 group-hover:opacity-100 transition-opacity",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Move up */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={index === 0}
                onClick={() => onReorder(index, index - 1)}
                title="Move up"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>

              {/* Move down */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={index === template.order.length - 1}
                onClick={() => onReorder(index, index + 1)}
                title="Move down"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>

              {/* Toggle visibility */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onToggleSection(sectionId, !isDisabled)}
                title={isDisabled ? "Enable section" : "Disable section"}
              >
                {isDisabled ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </Button>

              {/* Remove */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onRemoveSection(sectionId)}
                title="Remove section"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {template.order.length === 0 && (
        <div className="py-8 text-center">
          <LayoutGrid className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            No sections added yet.
          </p>
        </div>
      )}

      {/* Add Section button */}
      <Button
        variant="outline"
        size="sm"
        className="mt-2 w-full gap-1.5 border-dashed"
        onClick={() => {
          onAddSection("");
        }}
      >
        <Plus className="h-4 w-4" />
        Add Section
      </Button>
    </div>
  );
}
