/**
 * GroupEditorPanel — Edits a section group (header/footer).
 *
 * Features:
 *  - Lists sections within the group
 *  - Click section to open SectionEditorPanel with groupId context
 *  - Add/remove sections from the group
 *  - Back button to return to section list
 */

import { useMemo } from "react";
import { ArrowLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCustomizerStore } from "../../store/customizerStore";

export function GroupEditorPanel() {
  const draft = useCustomizerStore((s) => s.draft);
  const schemas = useCustomizerStore((s) => s.schemas);
  const locale = useCustomizerStore((s) => s.locale);
  const selection = useCustomizerStore((s) => s.selection);
  const setSelection = useCustomizerStore((s) => s.setSelection);
  const setActivePanel = useCustomizerStore((s) => s.setActivePanel);
  const clearSelection = useCustomizerStore((s) => s.clearSelection);
  const removeSectionFromGroup = useCustomizerStore((s) => s.removeSectionFromGroup);
  const addSectionToGroup = useCustomizerStore((s) => s.addSectionToGroup);

  const groupId = selection.groupId;
  const group = groupId ? draft?.section_groups[groupId] : null;

  const groupLabel = useMemo(() => {
    if (!groupId) return "";
    const labels: Record<string, Record<string, string>> = {
      header: { en: "Header", ar: "الرأس" },
      footer: { en: "Footer", ar: "التذييل" },
    };
    return labels[groupId]?.[locale] || groupId;
  }, [groupId, locale]);

  // Available section types for this group from schemas
  const availableGroupSections = useMemo(() => {
    if (!schemas || !groupId) return [];
    return schemas.section_groups[groupId]?.sections ?? [];
  }, [schemas, groupId]);

  if (!group || !groupId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {locale === "ar" ? "لم يتم تحديد مجموعة." : "No group selected."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <button
          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={clearSelection}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-semibold">{groupLabel}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Sections in this group */}
        {group.order.map((sectionId) => {
          const section = group.sections[sectionId];
          if (!section) return null;

          const sectionSchema = schemas?.sections.find((s) => s.type === section.type);
          const label = sectionSchema
            ? locale === "ar"
              ? sectionSchema.locales?.ar?.name || sectionSchema.name
              : sectionSchema.locales?.en?.name || sectionSchema.name
            : section.type;

          return (
            <div
              key={sectionId}
              className="group flex items-center gap-2 rounded-lg border bg-card p-2.5 transition-colors hover:border-primary/30"
            >
              <button
                className="flex flex-1 items-center gap-2 text-left"
                onClick={() => {
                  setSelection({ type: "section", sectionId, blockId: null, groupId });
                  setActivePanel("section-editor");
                }}
              >
                <span className="truncate text-sm font-medium">{label}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
              <button
                className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                onClick={() => removeSectionFromGroup(groupId, sectionId)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

        {group.order.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {locale === "ar" ? "لا توجد أقسام في هذه المجموعة." : "No sections in this group."}
          </p>
        )}

        {/* Add section to group */}
        {availableGroupSections.length > 0 && (
          <div className="pt-2 space-y-1">
            <p className="text-xs text-muted-foreground">
              {locale === "ar" ? "إضافة قسم:" : "Add section:"}
            </p>
            {availableGroupSections.map((gs) => {
              const label = locale === "ar"
                ? gs.locales?.ar?.name || gs.name
                : gs.locales?.en?.name || gs.name;
              return (
                <Button
                  key={gs.type}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => addSectionToGroup(groupId, gs.type)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {label}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
