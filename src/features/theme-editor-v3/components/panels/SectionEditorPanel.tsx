/**
 * SectionEditorPanel — Edits a selected section's settings and manages its blocks.
 *
 * Features:
 *  - Back button to return to section list
 *  - Schema-driven settings form for the section
 *  - Block list with drag-and-drop reordering
 *  - Block add/remove/toggle
 *  - Click block to open BlockEditorPanel
 */

import { useMemo, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  GripVertical,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCustomizerStore } from "../../store/customizerStore";
import { SchemaFormV3 } from "../inputs/SchemaFormV3";
import type { BlockInstance, EditorLocale, SectionSchema, BlockSchema } from "../../types";

// ─── Sortable Block Item ────────────────────────────────────────────────────

interface BlockItemProps {
  id: string;
  block: BlockInstance;
  blockSchema: BlockSchema | undefined;
  locale: EditorLocale;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onRemove: () => void;
}

function SortableBlockItem({
  id,
  block,
  blockSchema,
  locale,
  isSelected,
  onSelect,
  onToggle,
  onRemove,
}: BlockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const label = useMemo(() => {
    if (blockSchema) {
      return locale === "ar"
        ? blockSchema.locales?.ar?.name || blockSchema.name
        : blockSchema.locales?.en?.name || blockSchema.name;
    }
    return block.type;
  }, [blockSchema, block.type, locale]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1 rounded-md border bg-card p-1.5 transition-all",
        isDragging && "z-50 shadow-lg opacity-90",
        isSelected && "border-primary ring-1 ring-primary/20",
        block.disabled && "opacity-50",
        !isSelected && !isDragging && "hover:border-primary/30",
      )}
    >
      <button
        className="cursor-grab touch-none p-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <button className="flex flex-1 items-center gap-1.5 text-left" onClick={onSelect}>
        <span className="truncate text-xs font-medium">{label}</span>
        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
      </button>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={onToggle}
        >
          {block.disabled ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
        <button
          className="rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────────────────

export function SectionEditorPanel() {
  const draft = useCustomizerStore((s) => s.draft);
  const schemas = useCustomizerStore((s) => s.schemas);
  const locale = useCustomizerStore((s) => s.locale);
  const activePage = useCustomizerStore((s) => s.activePage);
  const selection = useCustomizerStore((s) => s.selection);
  const storeId = useCustomizerStore((s) => s.storeId);

  const updateSectionSetting = useCustomizerStore((s) => s.updateSectionSetting);
  const addBlock = useCustomizerStore((s) => s.addBlock);
  const removeBlock = useCustomizerStore((s) => s.removeBlock);
  const toggleBlock = useCustomizerStore((s) => s.toggleBlock);
  const reorderBlocks = useCustomizerStore((s) => s.reorderBlocks);
  const setSelection = useCustomizerStore((s) => s.setSelection);
  const setActivePanel = useCustomizerStore((s) => s.setActivePanel);
  const clearSelection = useCustomizerStore((s) => s.clearSelection);

  const sectionId = selection.sectionId;
  const groupId = selection.groupId;

  // Resolve the section from the correct container
  const section = useMemo(() => {
    if (!draft || !sectionId) return null;
    if (groupId) {
      return draft.section_groups[groupId]?.sections[sectionId] ?? null;
    }
    return draft.templates[activePage]?.sections[sectionId] ?? null;
  }, [draft, sectionId, groupId, activePage]);

  // Find the section schema
  const sectionSchema: SectionSchema | undefined = useMemo(() => {
    if (!section || !schemas) return undefined;
    return schemas.sections.find((s) => s.type === section.type);
  }, [section, schemas]);

  const blocks = section?.blocks ?? {};
  const blockOrder = section?.block_order ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!sectionId) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = blockOrder.indexOf(active.id as string);
      const newIndex = blockOrder.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = [...blockOrder];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, active.id as string);
      reorderBlocks(sectionId, newOrder, groupId ?? undefined);
    },
    [sectionId, blockOrder, reorderBlocks, groupId],
  );

  if (!section || !sectionId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {locale === "ar" ? "لم يتم تحديد قسم." : "No section selected."}
        </p>
      </div>
    );
  }

  const sectionLabel = sectionSchema
    ? locale === "ar"
      ? sectionSchema.locales?.ar?.name || sectionSchema.name
      : sectionSchema.locales?.en?.name || sectionSchema.name
    : section.type;

  const availableBlockTypes = sectionSchema?.blocks ?? [];
  const maxBlocks = sectionSchema?.max_blocks;
  const canAddBlock = !maxBlocks || blockOrder.length < maxBlocks;

  return (
    <div className="flex h-full flex-col">
      {/* Header with back button */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <button
          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={clearSelection}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-semibold truncate">{sectionLabel}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Section settings form */}
        {sectionSchema && sectionSchema.settings.length > 0 && (
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {locale === "ar" ? "إعدادات القسم" : "Section Settings"}
            </h3>
            <SchemaFormV3
              settings={sectionSchema.settings}
              values={section.settings}
              locale={locale}
              onChange={(key, value) => updateSectionSetting(sectionId, key, value, groupId ?? undefined)}
              storeId={storeId ?? undefined}
            />
          </div>
        )}

        {/* Blocks */}
        {availableBlockTypes.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "ar" ? "العناصر" : "Blocks"}
                {maxBlocks && (
                  <span className="ml-1 font-normal">
                    ({blockOrder.length}/{maxBlocks})
                  </span>
                )}
              </h3>
            </div>

            {/* Block list with drag-and-drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={blockOrder} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {blockOrder.map((blockId) => {
                    const block = blocks[blockId];
                    if (!block) return null;
                    const blockSchema = availableBlockTypes.find((b) => b.type === block.type);
                    return (
                      <SortableBlockItem
                        key={blockId}
                        id={blockId}
                        block={block}
                        blockSchema={blockSchema}
                        locale={locale}
                        isSelected={selection.blockId === blockId}
                        onSelect={() => {
                          setSelection({
                            type: "block",
                            sectionId,
                            blockId,
                            groupId: groupId ?? null,
                          });
                          setActivePanel("block-editor");
                        }}
                        onToggle={() => toggleBlock(sectionId, blockId, groupId ?? undefined)}
                        onRemove={() => removeBlock(sectionId, blockId, groupId ?? undefined)}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>

            {blockOrder.length === 0 && (
              <p className="py-3 text-center text-xs text-muted-foreground">
                {locale === "ar" ? "لا توجد عناصر." : "No blocks."}
              </p>
            )}

            {/* Add block button */}
            {canAddBlock && (
              <div className="mt-2">
                {availableBlockTypes.length === 1 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => addBlock(sectionId, availableBlockTypes[0].type, groupId ?? undefined)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {locale === "ar" ? "إضافة عنصر" : "Add block"}
                  </Button>
                ) : (
                  <AddBlockDropdown
                    blockTypes={availableBlockTypes}
                    locale={locale}
                    onAdd={(type) => addBlock(sectionId, type, groupId ?? undefined)}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add Block Dropdown ─────────────────────────────────────────────────────

function AddBlockDropdown({
  blockTypes,
  locale,
  onAdd,
}: {
  blockTypes: { type: string; name: string; locales?: Record<string, { name?: string }> }[];
  locale: EditorLocale;
  onAdd: (type: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-1">
        {locale === "ar" ? "اختر نوع العنصر:" : "Choose block type:"}
      </p>
      <div className="grid grid-cols-2 gap-1">
        {blockTypes.map((bt) => {
          const label =
            locale === "ar"
              ? bt.locales?.ar?.name || bt.name
              : bt.locales?.en?.name || bt.name;
          return (
            <Button
              key={bt.type}
              variant="outline"
              size="sm"
              className="justify-start gap-1.5 text-xs"
              onClick={() => onAdd(bt.type)}
            >
              <Plus className="h-3 w-3" />
              {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
