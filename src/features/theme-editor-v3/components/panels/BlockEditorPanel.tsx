/**
 * BlockEditorPanel — Edits a selected block's settings.
 *
 * Features:
 *  - Back button to return to section editor
 *  - Schema-driven settings form for the block
 *  - Block type label with bilingual support
 */

import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { useCustomizerStore } from "../../store/customizerStore";
import { SchemaFormV3 } from "../inputs/SchemaFormV3";
import type { BlockSchema } from "../../types";

export function BlockEditorPanel() {
  const draft = useCustomizerStore((s) => s.draft);
  const schemas = useCustomizerStore((s) => s.schemas);
  const locale = useCustomizerStore((s) => s.locale);
  const activePage = useCustomizerStore((s) => s.activePage);
  const selection = useCustomizerStore((s) => s.selection);
  const storeId = useCustomizerStore((s) => s.storeId);
  const updateBlockSetting = useCustomizerStore((s) => s.updateBlockSetting);
  const setSelection = useCustomizerStore((s) => s.setSelection);
  const setActivePanel = useCustomizerStore((s) => s.setActivePanel);

  const { sectionId, blockId, groupId } = selection;

  // Resolve the section and block
  const { section, block } = useMemo(() => {
    if (!draft || !sectionId || !blockId) return { section: null, block: null };
    let sec;
    if (groupId) {
      sec = draft.section_groups[groupId]?.sections[sectionId];
    } else {
      sec = draft.templates[activePage]?.sections[sectionId];
    }
    const blk = sec?.blocks?.[blockId] ?? null;
    return { section: sec ?? null, block: blk };
  }, [draft, sectionId, blockId, groupId, activePage]);

  // Find the block schema
  const blockSchema: BlockSchema | undefined = useMemo(() => {
    if (!section || !block || !schemas) return undefined;
    const sectionSchema = schemas.sections.find((s) => s.type === section.type);
    return sectionSchema?.blocks?.find((b) => b.type === block.type);
  }, [section, block, schemas]);

  if (!block || !sectionId || !blockId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {locale === "ar" ? "لم يتم تحديد عنصر." : "No block selected."}
        </p>
      </div>
    );
  }

  const blockLabel = blockSchema
    ? locale === "ar"
      ? blockSchema.locales?.ar?.name || blockSchema.name
      : blockSchema.locales?.en?.name || blockSchema.name
    : block.type;

  return (
    <div className="flex h-full flex-col">
      {/* Header with back button */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <button
          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={() => {
            setSelection({ type: "section", sectionId, blockId: null, groupId });
            setActivePanel("section-editor");
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold truncate">{blockLabel}</h2>
          <p className="text-xs text-muted-foreground truncate">{block.type}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {blockSchema && blockSchema.settings.length > 0 ? (
          <SchemaFormV3
            settings={blockSchema.settings}
            values={block.settings}
            locale={locale}
            onChange={(key, value) =>
              updateBlockSetting(sectionId, blockId, key, value, groupId ?? undefined)
            }
            storeId={storeId ?? undefined}
          />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {locale === "ar"
              ? "لا توجد إعدادات قابلة للتعديل لهذا العنصر."
              : "No configurable settings for this block."}
          </p>
        )}
      </div>
    </div>
  );
}
