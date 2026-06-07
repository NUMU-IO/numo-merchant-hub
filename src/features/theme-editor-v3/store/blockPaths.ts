/**
 * Nested-block addressing (blocks-in-blocks) — pure helpers shared by the
 * customizer store (mutations) and the panels (resolution/render).
 *
 * A block is addressed by a PATH: the chain of block ids from the
 * section's direct child down to the target. A top-level block is
 * `[blockId]`; a link nested in a footer column is `["col1", "link2"]`.
 */

import type {
  ThemeSettingsV3,
  SectionSchemaDefinition,
  BlockSchemaDefinition,
  SectionInstance,
  BlockInstance,
} from "../types";

/** Max nesting depth for blocks-in-blocks. Depth 1 = a top-level block;
 *  a block already at this depth can't accept children. Kept in sync
 *  with the SDK's MAX_BLOCK_DEPTH. */
export const MAX_BLOCK_DEPTH = 5;

/** A node that holds a block container: a section or a nesting block. */
export type BlockContainer = {
  blocks?: Record<string, BlockInstance>;
  block_order?: string[];
};

/** Normalize a legacy string id or an explicit path to a path array. */
export function asBlockPath(blockId: string | string[]): string[] {
  return Array.isArray(blockId) ? blockId : [blockId];
}

/** Resolve a section from the draft (group-scoped or template-scoped). */
export function resolveSectionRef(
  draft: ThemeSettingsV3,
  activePage: string,
  sectionId: string,
  groupId?: string | null,
): SectionInstance | undefined {
  return groupId
    ? draft.section_groups[groupId]?.sections[sectionId]
    : draft.templates[activePage]?.sections[sectionId];
}

/** Walk `parentPath` from `root`, returning the container that holds the
 *  children at that path. Empty path → the section itself. undefined if
 *  any hop is missing. */
export function resolveContainer(
  root: BlockContainer | undefined,
  parentPath: string[],
): BlockContainer | undefined {
  let container = root;
  for (const id of parentPath) {
    const next: BlockInstance | undefined = container?.blocks?.[id];
    if (!next) return undefined;
    container = next;
  }
  return container;
}

/** Resolve the block instance at the full `path`. */
export function resolveBlockAt(
  root: BlockContainer | undefined,
  path: string[],
): BlockInstance | undefined {
  if (path.length === 0) return undefined;
  const parent = resolveContainer(root, path.slice(0, -1));
  return parent?.blocks?.[path[path.length - 1]];
}

/** Walk the schema tree in lock-step with the instance tree to find the
 *  allowed child block schemas + max_blocks for the container at
 *  `parentPath`. Empty path → the section's own blocks/max_blocks. */
export function containerSchemaAt(
  sectionSchema: SectionSchemaDefinition | undefined,
  section: BlockContainer | undefined,
  parentPath: string[],
): { blocks: BlockSchemaDefinition[]; maxBlocks?: number } {
  if (!sectionSchema) return { blocks: [] };
  let allowed: BlockSchemaDefinition[] = sectionSchema.blocks ?? [];
  let maxBlocks: number | undefined = sectionSchema.max_blocks;
  let inst: BlockContainer | undefined = section;
  for (const id of parentPath) {
    const childInst: BlockInstance | undefined = inst?.blocks?.[id];
    if (!childInst) return { blocks: [], maxBlocks: undefined };
    const childSchema = allowed.find((b) => b.type === childInst.type);
    allowed = childSchema?.blocks ?? [];
    maxBlocks = childSchema?.max_blocks;
    inst = childInst;
  }
  return { blocks: allowed, maxBlocks };
}

/** The schema for the block at `path` itself (not its children) — found by
 *  resolving the parent container's allowed schemas, then matching the
 *  block's type. Undefined if the block or its schema isn't found. */
export function blockSchemaAt(
  sectionSchema: SectionSchemaDefinition | undefined,
  section: BlockContainer | undefined,
  path: string[],
): BlockSchemaDefinition | undefined {
  if (path.length === 0) return undefined;
  const block = resolveBlockAt(section, path);
  if (!block) return undefined;
  const parent = containerSchemaAt(sectionSchema, section, path.slice(0, -1));
  return parent.blocks.find((b) => b.type === block.type);
}
