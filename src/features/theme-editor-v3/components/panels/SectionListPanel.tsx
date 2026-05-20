/**
 * SectionListPanel — Displays the ordered list of sections for the active page.
 *
 * Features:
 *  - Drag-and-drop reordering via @dnd-kit
 *  - Section toggle (enable/disable)
 *  - Section remove, duplicate, move up/down
 *  - "Add section" button (opens AddSectionDialog)
 *  - Section groups (header/footer) shown as locked groups at top/bottom
 *  - Bilingual labels (EN/AR)
 */

import { useMemo, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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
  GripVertical,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  ChevronRight,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCustomizerStore } from "../../store/customizerStore";
import type { EditorLocale, SectionInstance, ThemeSchemaBundle } from "../../types";
import { VariantPicker } from "./VariantPicker";

// ─── Section Item (Sortable) ────────────────────────────────────────────────

interface SectionItemProps {
  id: string;
  section: SectionInstance;
  locale: EditorLocale;
  schemas: ThemeSchemaBundle | null;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onAddAfter: () => void;
}

function SortableSectionItem({
  id,
  section,
  locale,
  schemas,
  isSelected,
  onSelect,
  onToggle,
  onRemove,
  onDuplicate,
  onAddAfter,
}: SectionItemProps) {
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

  const sectionSchema = schemas?.sections.find((s) => s.type === section.type);
  const label = useMemo(() => {
    if (sectionSchema) {
      return locale === "ar"
        ? sectionSchema.locales?.ar?.name || sectionSchema.name
        : sectionSchema.locales?.en?.name || sectionSchema.name;
    }
    return section.type;
  }, [sectionSchema, section.type, locale]);

  const blockCount = section.block_order?.length ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1 rounded-lg border bg-card p-2 transition-all",
        isDragging && "z-50 shadow-lg opacity-90",
        isSelected && "border-primary ring-1 ring-primary/20",
        section.disabled && "opacity-50",
        !isSelected && !isDragging && "hover:border-primary/30",
      )}
    >
      {/* Drag handle */}
      <button
        className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Section info — clickable to select */}
      <button
        className="flex flex-1 items-center gap-2 text-left"
        onClick={onSelect}
      >
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium">{label}</p>
          {blockCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {blockCount} {locale === "ar" ? "عنصر" : blockCount === 1 ? "block" : "blocks"}
            </p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {/* Actions — visible on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={onToggle}
          title={section.disabled
            ? (locale === "ar" ? "تفعيل" : "Enable")
            : (locale === "ar" ? "إخفاء" : "Hide")}
        >
          {section.disabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        <button
          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={onDuplicate}
          title={locale === "ar" ? "تكرار" : "Duplicate"}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={onRemove}
          title={locale === "ar" ? "حذف" : "Remove"}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Section Group Display ──────────────────────────────────────────────────

interface SectionGroupDisplayProps {
  groupId: string;
  label: string;
  locale: EditorLocale;
  schemas: ThemeSchemaBundle | null;
}

function SectionGroupDisplay({ groupId, label, locale, schemas }: SectionGroupDisplayProps) {
  const draft = useCustomizerStore((s) => s.draft);
  const setSelection = useCustomizerStore((s) => s.setSelection);
  const setActivePanel = useCustomizerStore((s) => s.setActivePanel);
  const selection = useCustomizerStore((s) => s.selection);

  const group = draft?.section_groups[groupId];
  if (!group) return null;

  const sectionCount = group.order.length;

  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border bg-muted/50 p-3 text-left transition-colors",
        selection.groupId === groupId && "border-primary ring-1 ring-primary/20",
        selection.groupId !== groupId && "hover:border-primary/30",
      )}
      onClick={() => {
        setSelection({ type: "group", sectionId: null, blockId: null, groupId });
        setActivePanel("group-editor");
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {sectionCount} {locale === "ar" ? "قسم" : sectionCount === 1 ? "section" : "sections"}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────────────────

export function SectionListPanel() {
  const draft = useCustomizerStore((s) => s.draft);
  const schemas = useCustomizerStore((s) => s.schemas);
  const locale = useCustomizerStore((s) => s.locale);
  const activePage = useCustomizerStore((s) => s.activePage);
  const selection = useCustomizerStore((s) => s.selection);
  const reorderSections = useCustomizerStore((s) => s.reorderSections);
  const removeSection = useCustomizerStore((s) => s.removeSection);
  const toggleSection = useCustomizerStore((s) => s.toggleSection);
  const duplicateSection = useCustomizerStore((s) => s.duplicateSection);
  const setSelection = useCustomizerStore((s) => s.setSelection);
  const setActivePanel = useCustomizerStore((s) => s.setActivePanel);
  const setShowAddSection = useCustomizerStore((s) => s.setShowAddSection);

  const template = draft?.templates[activePage];
  const sections = template?.sections ?? {};
  const order = template?.order ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = order.indexOf(active.id as string);
      const newIndex = order.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = [...order];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, active.id as string);
      reorderSections(newOrder);
    },
    [order, reorderSections],
  );

  const handleSelectSection = useCallback(
    (sectionId: string) => {
      setSelection({ type: "section", sectionId, blockId: null, groupId: null });
      setActivePanel("section-editor");
    },
    [setSelection, setActivePanel],
  );

  // Shared-template impact notice (Step 4 / doc §34).
  // Editing a "shared" template (product, collection, page) affects
  // EVERY resource that uses that template — not just one. Surface a
  // small non-intrusive banner so merchants don't accidentally tweak
  // the product template thinking they're editing one specific product.
  // The single biggest source of Shopify merchant confusion that we
  // can cheaply eliminate.
  const sharedNoticeByTemplate: Record<string, { en: string; ar: string }> = {
    product: {
      en: "This template applies to every product using it.",
      ar: "هذا القالب يطبَّق على كل منتج يستخدمه.",
    },
    collection: {
      en: "This template applies to every collection using it.",
      ar: "هذا القالب يطبَّق على كل مجموعة تستخدمه.",
    },
    page: {
      en: "This template applies to every static page using it.",
      ar: "هذا القالب يطبَّق على كل صفحة ثابتة تستخدمه.",
    },
    blog: {
      en: "This template applies to every blog using it.",
      ar: "هذا القالب يطبَّق على كل مدوّنة تستخدمه.",
    },
    "order-confirmation": {
      en: "Shown to every customer after they complete an order.",
      ar: "يظهر لكل عميل بعد إتمام الطلب.",
    },
    cart: {
      en: "Shown when any customer opens the cart page.",
      ar: "يظهر عند فتح أي عميل لصفحة السلة.",
    },
    checkout: {
      en: "Shown to every customer during checkout.",
      ar: "يظهر لكل عميل أثناء عملية الدفع.",
    },
  };
  const sharedNotice = sharedNoticeByTemplate[activePage];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">
          {locale === "ar" ? "الأقسام" : "Sections"}
        </h2>
        <span className="text-xs text-muted-foreground capitalize">
          {activePage}
        </span>
      </div>

      {/* Wave 7 — Variant picker strip. Auto-hides when the active
          theme doesn't ship variants. */}
      {schemas?.theme_variants && schemas.theme_variants.length > 0 && (
        <VariantPicker
          variants={schemas.theme_variants}
          locale={locale}
        />
      )}

      {/* Shared-template impact notice. Only shows on shared templates
          (product, collection, page, etc.) — not on home or 404 where
          the impact is unambiguous. The lightning-bolt icon + amber
          color matches our existing alert-info pattern. */}
      {sharedNotice && (
        <div className="border-b bg-amber-50/60 dark:bg-amber-950/20 px-4 py-2">
          <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
            <span aria-hidden="true" className="me-1">⚡</span>
            {sharedNotice[locale === "ar" ? "ar" : "en"]}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Header section group */}
        <SectionGroupDisplay
          groupId="header"
          label={locale === "ar" ? "الرأس" : "Header"}
          locale={locale}
          schemas={schemas}
        />

        {/* Page sections — sortable */}
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">
            {locale === "ar" ? "محتوى الصفحة" : "Page Content"}
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {order.map((sectionId) => {
                  const section = sections[sectionId];
                  if (!section) return null;
                  return (
                    <SortableSectionItem
                      key={sectionId}
                      id={sectionId}
                      section={section}
                      locale={locale}
                      schemas={schemas}
                      isSelected={selection.sectionId === sectionId && !selection.groupId}
                      onSelect={() => handleSelectSection(sectionId)}
                      onToggle={() => toggleSection(sectionId)}
                      onRemove={() => removeSection(sectionId)}
                      onDuplicate={() => duplicateSection(sectionId)}
                      onAddAfter={() => setShowAddSection(true, sectionId)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>

          {order.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {locale === "ar" ? "لا توجد أقسام. أضف قسماً للبدء." : "No sections. Add one to get started."}
            </p>
          )}
        </div>

        {/* Add section button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => setShowAddSection(true)}
        >
          <Plus className="h-4 w-4" />
          {locale === "ar" ? "إضافة قسم" : "Add section"}
        </Button>

        {/* Footer section group */}
        <SectionGroupDisplay
          groupId="footer"
          label={locale === "ar" ? "التذييل" : "Footer"}
          locale={locale}
          schemas={schemas}
        />
      </div>
    </div>
  );
}
