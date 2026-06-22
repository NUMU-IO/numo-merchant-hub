/**
 * BlockEditorPanel — edits a selected block's settings and (when the
 * block nests) manages its child blocks.
 *
 * Resolves the block by its full PATH (`selection.blockPath`), so it
 * works at any depth. The Back button drills OUT one level — to the
 * parent block when nested, or to the section when top-level. Child
 * blocks are managed by the same <BlockListEditor> the section uses, so
 * selecting a child drills further IN.
 */

import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { useCustomizerStore } from "../../store/customizerStore";
import {
  findSectionSchema,
  resolveSectionRef,
  resolveBlockAt,
  blockSchemaAt,
  containerSchemaAt,
} from "../../store/blockPaths";
import { SchemaFormV3 } from "../inputs/SchemaFormV3";
import { BlockListEditor } from "./BlockListEditor";

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
  // Prefer the explicit nested path; fall back to a one-element path for
  // top-level blocks selected by older code paths.
  const blockPath = selection.blockPath ?? (blockId ? [blockId] : null);

  const { section, block, sectionSchema } = useMemo(() => {
    if (!draft || !sectionId || !blockPath) {
      return { section: null, block: null, sectionSchema: undefined };
    }
    const sec = resolveSectionRef(draft, activePage, sectionId, groupId);
    const blk = resolveBlockAt(sec, blockPath) ?? null;
    // 3-pool lookup so header/footer block editors resolve their section
    // schema — a single-pool `schemas.sections.find` missed chrome sections,
    // leaving every chrome block showing "No configurable settings".
    const ss = sec ? findSectionSchema(schemas, sec.type) : undefined;
    return { section: sec ?? null, block: blk, sectionSchema: ss };
  }, [draft, sectionId, blockPath, groupId, activePage, schemas]);

  // The selected block's own schema (settings live here).
  const blockSchema = useMemo(
    () =>
      section && blockPath
        ? blockSchemaAt(sectionSchema, section, blockPath)
        : undefined,
    [section, sectionSchema, blockPath],
  );

  // This block's allowed CHILD blocks (for nesting).
  const childContainer = useMemo(
    () =>
      section && blockPath
        ? containerSchemaAt(sectionSchema, section, blockPath)
        : { blocks: [], maxBlocks: undefined },
    [section, sectionSchema, blockPath],
  );

  if (!block || !sectionId || !blockPath) {
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
      : blockSchema.name
    : block.type;

  const goBack = () => {
    if (blockPath.length > 1) {
      // Drill out to the parent block.
      const parentPath = blockPath.slice(0, -1);
      setSelection({
        type: "block",
        sectionId,
        blockId: parentPath[parentPath.length - 1],
        blockPath: parentPath,
        groupId,
      });
      setActivePanel("block-editor");
    } else {
      setSelection({
        type: "section",
        sectionId,
        blockId: null,
        blockPath: null,
        groupId,
      });
      setActivePanel("section-editor");
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header with back button */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <button
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={goBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{blockLabel}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {blockPath.length > 1
              ? locale === "ar"
                ? `عنصر متداخل · ${block.type}`
                : `Nested block · ${block.type}`
              : block.type}
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {/* Block settings */}
        {blockSchema && blockSchema.settings.length > 0 ? (
          <SchemaFormV3
            settings={blockSchema.settings}
            values={block.settings}
            locale={locale}
            onChange={(key, value) =>
              updateBlockSetting(sectionId, blockPath, key, value, groupId ?? undefined)
            }
            storeId={storeId ?? undefined}
          />
        ) : childContainer.blocks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {locale === "ar"
              ? "لا توجد إعدادات قابلة للتعديل لهذا العنصر."
              : "No configurable settings for this block."}
          </p>
        ) : null}

        {/* Nested child blocks (blocks-in-blocks) */}
        {childContainer.blocks.length > 0 && (
          <BlockListEditor
            sectionId={sectionId}
            groupId={groupId ?? undefined}
            parentPath={blockPath}
            container={block}
            allowedBlockSchemas={childContainer.blocks}
            maxBlocks={childContainer.maxBlocks}
            locale={locale}
          />
        )}
      </div>
    </div>
  );
}
