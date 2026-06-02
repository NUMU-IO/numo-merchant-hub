/**
 * BlockListEditor — renders ONE block container's children (the section's
 * top-level blocks, or a nesting block's child blocks) with drag-reorder,
 * add, toggle, remove, and select-to-drill.
 *
 * Nesting (blocks-in-blocks) is modeled as DRILL-DOWN, not an inline tree:
 * selecting a block opens the BlockEditorPanel, which renders THIS same
 * component for that block's children (`parentPath` one level deeper).
 * That keeps a single, proven dnd context per level and an unbounded
 * depth with zero extra UI — Shopify's "click in to manage children" UX.
 *
 * Addressing: every mutation is called with the child's FULL path
 * (`[...parentPath, childId]`) so the path-aware store resolves the right
 * container at any depth. `parentPath = []` ⇒ the section itself.
 */

import { useCallback } from "react";
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
import { GripVertical, Eye, EyeOff, Trash2, Plus, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useCustomizerStore,
  MAX_BLOCK_DEPTH,
} from "../../store/customizerStore";
import type {
  BlockInstance,
  BlockSchemaDefinition,
  EditorLocale,
} from "../../types";

function blockLabel(
  block: BlockInstance,
  schema: BlockSchemaDefinition | undefined,
  locale: EditorLocale,
): string {
  if (schema) {
    return locale === "ar"
      ? schema.locales?.ar?.name || schema.name
      : schema.name;
  }
  return block.type;
}

function pathsEqual(a: string[] | null | undefined, b: string[]): boolean {
  if (!a || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

interface BlockListEditorProps {
  sectionId: string;
  groupId?: string;
  /** Path to the container whose children we edit. [] = the section. */
  parentPath: string[];
  /** The container instance (section or block) — read block_order/blocks. */
  container: { blocks?: Record<string, BlockInstance>; block_order?: string[] };
  /** Child block schemas this container allows. */
  allowedBlockSchemas: BlockSchemaDefinition[];
  /** Per-container block limit. */
  maxBlocks?: number;
  locale: EditorLocale;
  /** Heading shown above the list. Defaults to "Blocks". */
  heading?: string;
}

export function BlockListEditor({
  sectionId,
  groupId,
  parentPath,
  container,
  allowedBlockSchemas,
  maxBlocks,
  locale,
  heading,
}: BlockListEditorProps) {
  const selection = useCustomizerStore((s) => s.selection);
  const addBlock = useCustomizerStore((s) => s.addBlock);
  const removeBlock = useCustomizerStore((s) => s.removeBlock);
  const toggleBlock = useCustomizerStore((s) => s.toggleBlock);
  const reorderBlocks = useCustomizerStore((s) => s.reorderBlocks);
  const setSelection = useCustomizerStore((s) => s.setSelection);
  const setActivePanel = useCustomizerStore((s) => s.setActivePanel);

  const blocks = container.blocks ?? {};
  const blockOrder = container.block_order ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = blockOrder.indexOf(active.id as string);
      const newIndex = blockOrder.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = [...blockOrder];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, active.id as string);
      reorderBlocks(sectionId, newOrder, groupId, parentPath);
    },
    [blockOrder, reorderBlocks, sectionId, groupId, parentPath],
  );

  const atDepthCap = parentPath.length >= MAX_BLOCK_DEPTH;
  const canAddBlock =
    allowedBlockSchemas.length > 0 &&
    !atDepthCap &&
    (!maxBlocks || blockOrder.length < maxBlocks);

  if (allowedBlockSchemas.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {heading ?? (locale === "ar" ? "العناصر" : "Blocks")}
          {maxBlocks && (
            <span className="ml-1 font-normal">
              ({blockOrder.length}/{maxBlocks})
            </span>
          )}
        </h3>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={blockOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {blockOrder.map((childId) => {
              const block = blocks[childId];
              if (!block) return null;
              const schema = allowedBlockSchemas.find((b) => b.type === block.type);
              const childPath = [...parentPath, childId];
              const nestable = (schema?.blocks?.length ?? 0) > 0;
              const childCount = block.block_order?.length ?? 0;
              return (
                <SortableBlockRow
                  key={childId}
                  id={childId}
                  label={blockLabel(block, schema, locale)}
                  disabled={!!block.disabled}
                  selected={pathsEqual(
                    selection.blockPath ??
                      (selection.blockId ? [selection.blockId] : null),
                    childPath,
                  )}
                  nestedCount={nestable ? childCount : null}
                  onSelect={() => {
                    setSelection({
                      type: "block",
                      sectionId,
                      blockId: childId,
                      blockPath: childPath,
                      groupId: groupId ?? null,
                    });
                    setActivePanel("block-editor");
                  }}
                  onToggle={() => toggleBlock(sectionId, childPath, groupId)}
                  onRemove={() => removeBlock(sectionId, childPath, groupId)}
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

      <div className="mt-2">
        {canAddBlock ? (
          allowedBlockSchemas.length === 1 ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() =>
                addBlock(sectionId, allowedBlockSchemas[0].type, groupId, parentPath)
              }
            >
              <Plus className="h-3.5 w-3.5" />
              {locale === "ar" ? "إضافة عنصر" : "Add block"}
            </Button>
          ) : (
            <AddBlockDropdown
              blockTypes={allowedBlockSchemas}
              locale={locale}
              onAdd={(type) => addBlock(sectionId, type, groupId, parentPath)}
            />
          )
        ) : (
          <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground">
              {atDepthCap
                ? locale === "ar"
                  ? `بلغت أقصى عمق للتداخل (${MAX_BLOCK_DEPTH}).`
                  : `Max nesting depth reached (${MAX_BLOCK_DEPTH}).`
                : locale === "ar"
                  ? `تم بلوغ الحد الأقصى (${maxBlocks}). أزل عنصرًا لإضافة آخر.`
                  : `Block limit reached (${maxBlocks}). Remove a block to add another.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sortable row ────────────────────────────────────────────────────────
function SortableBlockRow({
  id,
  label,
  disabled,
  selected,
  nestedCount,
  onSelect,
  onToggle,
  onRemove,
}: {
  id: string;
  label: string;
  disabled: boolean;
  selected: boolean;
  /** null = block can't nest; number = nested child count (drill affordance). */
  nestedCount: number | null;
  onSelect: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1 rounded-md border bg-card p-1.5 transition-all",
        isDragging && "z-50 opacity-90 shadow-lg",
        selected && "border-primary ring-1 ring-primary/20",
        disabled && "opacity-50",
        !selected && !isDragging && "hover:border-primary/30",
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
        {nestedCount !== null && (
          <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
            {nestedCount}
          </span>
        )}
        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
      </button>

      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onToggle}
        >
          {disabled ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
        <button
          className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Add-block dropdown (multi-type) ───────────────────────────────────────
function AddBlockDropdown({
  blockTypes,
  locale,
  onAdd,
}: {
  blockTypes: BlockSchemaDefinition[];
  locale: EditorLocale;
  onAdd: (type: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-2">
          <Plus className="h-3.5 w-3.5" />
          {locale === "ar" ? "إضافة عنصر" : "Add block"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {blockTypes.map((bt) => (
          <DropdownMenuItem key={bt.type} onClick={() => onAdd(bt.type)}>
            <Plus className="me-2 h-3 w-3" />
            <span className="truncate">
              {locale === "ar" ? bt.locales?.ar?.name || bt.name : bt.name}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
