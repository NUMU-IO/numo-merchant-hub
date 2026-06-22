/**
 * SectionEditorPanel — Edits a selected section's settings and manages its blocks.
 *
 * Features:
 *  - Back button to return to section list
 *  - Schema-driven settings form for the section
 *  - Preset switcher (destructive — confirms first)
 *  - Top-level block list via <BlockListEditor> (drag reorder, add,
 *    toggle, remove, select-to-drill). Nested blocks are managed by
 *    drilling into a block (BlockEditorPanel renders the same component
 *    for its children).
 */

import { useMemo, useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Button } from "@/components/ui/button";
import { useCustomizerStore } from "../../store/customizerStore";
import { findSectionSchema } from "../../store/blockPaths";
import { SchemaFormV3 } from "../inputs/SchemaFormV3";
import { BlockListEditor } from "./BlockListEditor";
import type { SectionSchema } from "../../types";

export function SectionEditorPanel() {
  const draft = useCustomizerStore((s) => s.draft);
  const schemas = useCustomizerStore((s) => s.schemas);
  const locale = useCustomizerStore((s) => s.locale);
  const activePage = useCustomizerStore((s) => s.activePage);
  const selection = useCustomizerStore((s) => s.selection);
  const storeId = useCustomizerStore((s) => s.storeId);

  const updateSectionSetting = useCustomizerStore((s) => s.updateSectionSetting);
  const clearSelection = useCustomizerStore((s) => s.clearSelection);
  const applyPreset = useCustomizerStore((s) => s.applyPreset);

  // Preset about to be applied, held pending a destructive-change confirm.
  const [pendingPreset, setPendingPreset] = useState<number | null>(null);

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

  // Find the section schema. Chrome sections (tag:"header"/"footer") are
  // filtered OUT of the template `sections` pool into `section_groups` by
  // normalizeSchemas, so a lookup against `sections` alone misses them —
  // leaving the panel with the raw type label and no settings form.
  // `findSectionSchema` searches all three pools (shared with the store's
  // addBlock/applyPreset so block + preset actions resolve chrome too).
  const sectionSchema: SectionSchema | undefined = useMemo(
    () => (section ? findSectionSchema(schemas, section.type) : undefined),
    [section, schemas],
  );

  // Destructive-change summary for the pending preset switch.
  const presetConfirm = useMemo(() => {
    if (pendingPreset === null || !section || !sectionSchema) return null;
    const preset = sectionSchema.presets?.[pendingPreset];
    if (!preset) return null;
    const defaults: Record<string, unknown> = {};
    sectionSchema.settings.forEach((s) => {
      if (s.default !== undefined) defaults[s.id] = s.default;
    });
    const target = { ...defaults, ...(preset.settings ?? {}) };
    const current = section.settings ?? {};
    const keys = new Set([...Object.keys(target), ...Object.keys(current)]);
    let changed = 0;
    keys.forEach((k) => {
      if (JSON.stringify(current[k]) !== JSON.stringify(target[k])) changed++;
    });
    const curBlocks = section.block_order?.length ?? 0;
    const presetBlocks = preset.blocks?.length ?? 0;
    return { name: preset.name, changed, blockChange: curBlocks !== presetBlocks };
  }, [pendingPreset, section, sectionSchema]);

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

  return (
    <div className="flex h-full flex-col">
      {/* Header with back button */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <button
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={clearSelection}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="truncate text-sm font-semibold">{sectionLabel}</h2>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {/* Section settings form */}
        {sectionSchema && sectionSchema.settings.length > 0 && (
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "ar" ? "إعدادات القسم" : "Section Settings"}
              </h3>
              {sectionSchema.presets && sectionSchema.presets.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                      <RotateCcw className="h-3 w-3" />
                      {locale === "ar" ? "تبديل النمط" : "Switch preset"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {sectionSchema.presets.map((preset, i) => (
                      <DropdownMenuItem
                        key={`${preset.name}-${i}`}
                        onClick={() => setPendingPreset(i)}
                      >
                        <span className="truncate">{preset.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <SchemaFormV3
              settings={sectionSchema.settings}
              values={section.settings}
              locale={locale}
              onChange={(key, value) =>
                updateSectionSetting(sectionId, key, value, groupId ?? undefined)
              }
              storeId={storeId ?? undefined}
            />
          </div>
        )}

        {/* Top-level blocks (drill into a block to manage its children) */}
        {availableBlockTypes.length > 0 && (
          <BlockListEditor
            sectionId={sectionId}
            groupId={groupId ?? undefined}
            parentPath={[]}
            container={section}
            allowedBlockSchemas={availableBlockTypes}
            maxBlocks={sectionSchema?.max_blocks}
            locale={locale}
          />
        )}
      </div>

      {/* Destructive preset-switch confirmation. */}
      <AlertDialog
        open={pendingPreset !== null}
        onOpenChange={(o) => {
          if (!o) setPendingPreset(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {locale === "ar" ? "تبديل النمط؟" : "Switch preset?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {locale === "ar"
                ? `سيؤدي تطبيق "${presetConfirm?.name ?? ""}" إلى استبدال إعدادات هذا القسم${
                    presetConfirm && presetConfirm.changed > 0
                      ? ` (${presetConfirm.changed} تعديل سيُفقد)`
                      : ""
                  }${presetConfirm?.blockChange ? " وإعادة بناء عناصره" : ""}. يمكنك التراجع بعد ذلك.`
                : `Applying "${presetConfirm?.name ?? ""}" will replace this section's settings${
                    presetConfirm && presetConfirm.changed > 0
                      ? ` (${presetConfirm.changed} customization${
                          presetConfirm.changed === 1 ? "" : "s"
                        } will be lost)`
                      : ""
                  }${presetConfirm?.blockChange ? " and rebuild its blocks" : ""}. You can undo afterwards.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {locale === "ar" ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingPreset !== null && sectionId) {
                  applyPreset(sectionId, pendingPreset, groupId ?? undefined);
                }
                setPendingPreset(null);
              }}
            >
              {locale === "ar" ? "تبديل واستبدال" : "Switch & replace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
