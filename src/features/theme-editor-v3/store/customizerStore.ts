/**
 * Theme Editor V3 — Zustand Store.
 *
 * Central state management for the V3 customizer. Handles:
 *  - Draft state (ThemeSettingsV3)
 *  - Auto-save with 2s debounce (Dual-Write to backend)
 *  - Undo/redo stack (50 entries max)
 *  - Section/block CRUD operations
 *  - Editor UI state (selection, locale, device, panel)
 *  - Dirty tracking
 *
 * This store is completely independent of the V2 ThemeEditor.tsx state.
 * The old editor continues to work alongside this one.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  ThemeSettingsV3,
  ThemeSchemaBundle,
  SectionInstance,
  BlockInstance,
  PageTemplate,
  SectionGroup,
  EditorLocale,
  DeviceMode,
  SidebarPanel,
  EditorSelection,
} from "../types";
import {
  fetchDraftV3,
  saveDraftV3,
  publishV3,
  fetchSchemasV3,
  initializeV3,
  discardDraftV3,
} from "../services/themeEditorV3Api";

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_HISTORY = 50;
const AUTOSAVE_DEBOUNCE_MS = 2000;

// ─── History Entry ──────────────────────────────────────────────────────────

interface HistoryEntry {
  data: ThemeSettingsV3;
  label: string;
  timestamp: number;
}

// ─── Store State ────────────────────────────────────────────────────────────

interface CustomizerState {
  // ── Core data ──
  storeId: string | null;
  draft: ThemeSettingsV3 | null;
  schemas: ThemeSchemaBundle | null;

  // ── Loading / error ──
  isLoading: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  error: string | null;

  // ── Dirty tracking ──
  isDirty: boolean;
  lastSavedAt: string | null;

  // ── Undo/redo ──
  past: HistoryEntry[];
  future: HistoryEntry[];

  // ── UI state ──
  locale: EditorLocale;
  deviceMode: DeviceMode;
  activePanel: SidebarPanel;
  activePage: string;
  selection: EditorSelection;
  showAddSection: boolean;
  insertAfterSectionId: string | null;

  // ── Auto-save timer ──
  _autosaveTimer: ReturnType<typeof setTimeout> | null;
}

// ─── Store Actions ──────────────────────────────────────────────────────────

interface CustomizerActions {
  // ── Initialization ──
  initialize: (storeId: string) => Promise<void>;
  reset: () => void;

  // ── Draft mutations (all push to undo stack + trigger autosave) ──
  updateGlobalSetting: (key: string, value: unknown) => void;
  updateSectionSetting: (sectionId: string, key: string, value: unknown, groupId?: string) => void;
  updateBlockSetting: (sectionId: string, blockId: string, key: string, value: unknown, groupId?: string) => void;

  // ── Section CRUD ──
  addSection: (sectionType: string, presetIndex?: number) => void;
  removeSection: (sectionId: string) => void;
  moveSection: (sectionId: string, direction: "up" | "down") => void;
  reorderSections: (newOrder: string[]) => void;
  toggleSection: (sectionId: string) => void;
  duplicateSection: (sectionId: string) => void;

  // ── Block CRUD ──
  addBlock: (sectionId: string, blockType: string, groupId?: string) => void;
  removeBlock: (sectionId: string, blockId: string, groupId?: string) => void;
  moveBlock: (sectionId: string, blockId: string, direction: "up" | "down", groupId?: string) => void;
  reorderBlocks: (sectionId: string, newOrder: string[], groupId?: string) => void;
  toggleBlock: (sectionId: string, blockId: string, groupId?: string) => void;

  // ── Section Group operations ──
  updateSectionGroupSetting: (groupId: string, sectionId: string, key: string, value: unknown) => void;
  addSectionToGroup: (groupId: string, sectionType: string) => void;
  removeSectionFromGroup: (groupId: string, sectionId: string) => void;

  // ── Undo/redo ──
  undo: () => void;
  redo: () => void;

  // ── Save / Publish ──
  save: () => Promise<void>;
  publish: () => Promise<void>;
  discardDraft: () => Promise<void>;

  // ── UI state ──
  setLocale: (locale: EditorLocale) => void;
  setDeviceMode: (mode: DeviceMode) => void;
  setActivePanel: (panel: SidebarPanel) => void;
  setActivePage: (page: string) => void;
  setSelection: (selection: EditorSelection) => void;
  clearSelection: () => void;
  setShowAddSection: (show: boolean, insertAfter?: string | null) => void;
}

type CustomizerStore = CustomizerState & CustomizerActions;

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId(prefix = "s"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function cloneDeep<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ─── Initial State ──────────────────────────────────────────────────────────

const initialState: CustomizerState = {
  storeId: null,
  draft: null,
  schemas: null,
  isLoading: false,
  isSaving: false,
  isPublishing: false,
  error: null,
  isDirty: false,
  lastSavedAt: null,
  past: [],
  future: [],
  locale: "ar",
  deviceMode: "desktop",
  activePanel: "sections",
  activePage: "home",
  selection: { type: null, sectionId: null, blockId: null, groupId: null },
  showAddSection: false,
  insertAfterSectionId: null,
  _autosaveTimer: null,
};

// ─── Store ──────────────────────────────────────────────────────────────────

export const useCustomizerStore = create<CustomizerStore>()(
  immer((set, get) => {
    // ── Private: push current state to undo stack ──
    function pushHistory(label: string) {
      const { draft, past } = get();
      if (!draft) return;
      const entry: HistoryEntry = {
        data: cloneDeep(draft),
        label,
        timestamp: Date.now(),
      };
      set((state) => {
        state.past = [...state.past.slice(-(MAX_HISTORY - 1)), entry];
        state.future = [];
      });
    }

    // ── Private: schedule autosave ──
    function scheduleAutosave() {
      const timer = get()._autosaveTimer;
      if (timer) clearTimeout(timer);

      const newTimer = setTimeout(async () => {
        const { storeId, draft, isDirty } = get();
        if (!storeId || !draft || !isDirty) return;
        try {
          set((s) => { s.isSaving = true; });
          const result = await saveDraftV3(storeId, draft);
          set((s) => {
            s.isSaving = false;
            s.isDirty = false;
            s.lastSavedAt = result.saved_at;
          });
        } catch (err) {
          set((s) => { s.isSaving = false; });
          console.error("[V3 Autosave] Failed:", err);
        }
      }, AUTOSAVE_DEBOUNCE_MS);

      set((s) => { s._autosaveTimer = newTimer; });
    }

    // ── Private: mark dirty + schedule save ──
    function markDirty() {
      set((s) => { s.isDirty = true; });
      scheduleAutosave();
    }

    // ── Private: get the active template or section group ──
    function getActiveContainer(state: CustomizerState): PageTemplate | SectionGroup | null {
      if (!state.draft) return null;
      return state.draft.templates[state.activePage] ?? null;
    }

    // ── Private: resolve section from template or group ──
    function resolveSection(
      draft: ThemeSettingsV3,
      sectionId: string,
      groupId?: string,
    ): { container: PageTemplate | SectionGroup; section: SectionInstance } | null {
      if (groupId) {
        const group = draft.section_groups[groupId];
        if (!group?.sections[sectionId]) return null;
        return { container: group, section: group.sections[sectionId] };
      }
      for (const tpl of Object.values(draft.templates)) {
        if (tpl.sections[sectionId]) {
          return { container: tpl, section: tpl.sections[sectionId] };
        }
      }
      return null;
    }

    return {
      ...initialState,

      // ── Initialization ──────────────────────────────────────────────

      initialize: async (storeId: string) => {
        set((s) => { s.isLoading = true; s.error = null; s.storeId = storeId; });
        try {
          // Fetch draft and schemas in parallel
          const [draft, schemas] = await Promise.all([
            fetchDraftV3(storeId).catch(async () => {
              // If no V3 draft exists, initialize one
              return initializeV3(storeId);
            }),
            fetchSchemasV3(storeId),
          ]);
          set((s) => {
            s.draft = draft;
            s.schemas = schemas;
            s.isLoading = false;
            s.isDirty = false;
            s.past = [];
            s.future = [];
          });
        } catch (err) {
          set((s) => {
            s.isLoading = false;
            s.error = err instanceof Error ? err.message : "Failed to load editor";
          });
        }
      },

      reset: () => {
        const timer = get()._autosaveTimer;
        if (timer) clearTimeout(timer);
        set(initialState);
      },

      // ── Global Settings ─────────────────────────────────────────────

      updateGlobalSetting: (key: string, value: unknown) => {
        pushHistory(`Update global: ${key}`);
        set((s) => {
          if (!s.draft) return;
          s.draft.global_settings[key] = value;
        });
        markDirty();
      },

      // ── Section Settings ────────────────────────────────────────────

      updateSectionSetting: (sectionId: string, key: string, value: unknown, groupId?: string) => {
        pushHistory(`Update section setting: ${key}`);
        set((s) => {
          if (!s.draft) return;
          if (groupId) {
            const group = s.draft.section_groups[groupId];
            if (group?.sections[sectionId]) {
              group.sections[sectionId].settings[key] = value;
            }
          } else {
            const tpl = s.draft.templates[s.activePage];
            if (tpl?.sections[sectionId]) {
              tpl.sections[sectionId].settings[key] = value;
            }
          }
        });
        markDirty();
      },

      // ── Block Settings ──────────────────────────────────────────────

      updateBlockSetting: (sectionId: string, blockId: string, key: string, value: unknown, groupId?: string) => {
        pushHistory(`Update block setting: ${key}`);
        set((s) => {
          if (!s.draft) return;
          let section: SectionInstance | undefined;
          if (groupId) {
            section = s.draft.section_groups[groupId]?.sections[sectionId];
          } else {
            section = s.draft.templates[s.activePage]?.sections[sectionId];
          }
          if (section?.blocks?.[blockId]) {
            section.blocks[blockId].settings[key] = value;
          }
        });
        markDirty();
      },

      // ── Section CRUD ────────────────────────────────────────────────

      addSection: (sectionType: string, presetIndex: number = 0) => {
        const { schemas, draft, activePage, insertAfterSectionId } = get();
        if (!schemas || !draft) return;

        const schema = schemas.sections.find((s) => s.type === sectionType);
        if (!schema) return;

        pushHistory(`Add section: ${sectionType}`);

        const newId = generateId("sec");
        const defaults: Record<string, unknown> = {};
        schema.settings.forEach((s) => {
          if (s.default !== undefined) defaults[s.id] = s.default;
        });
        const preset = schema.presets?.[presetIndex];
        const presetSettings = preset?.settings ?? {};

        // Build default blocks from preset
        const blocks: Record<string, BlockInstance> = {};
        const blockOrder: string[] = [];
        if (preset?.blocks) {
          for (const presetBlock of preset.blocks) {
            const blockId = generateId("blk");
            const blockSchema = schema.blocks?.find((b) => b.type === presetBlock.type);
            const blockDefaults: Record<string, unknown> = {};
            blockSchema?.settings.forEach((s) => {
              if (s.default !== undefined) blockDefaults[s.id] = s.default;
            });
            blocks[blockId] = {
              id: blockId,
              type: presetBlock.type,
              settings: { ...blockDefaults, ...presetBlock.settings },
            };
            blockOrder.push(blockId);
          }
        }

        const newSection: SectionInstance = {
          type: sectionType,
          settings: { ...defaults, ...presetSettings },
          blocks: Object.keys(blocks).length > 0 ? blocks : undefined,
          block_order: blockOrder.length > 0 ? blockOrder : undefined,
        };

        set((s) => {
          if (!s.draft) return;
          const tpl = s.draft.templates[activePage];
          if (!tpl) return;
          tpl.sections[newId] = newSection;
          if (insertAfterSectionId) {
            const idx = tpl.order.indexOf(insertAfterSectionId);
            if (idx !== -1) {
              tpl.order.splice(idx + 1, 0, newId);
            } else {
              tpl.order.push(newId);
            }
          } else {
            tpl.order.push(newId);
          }
          s.selection = { type: "section", sectionId: newId, blockId: null, groupId: null };
          s.activePanel = "section-editor";
          s.showAddSection = false;
          s.insertAfterSectionId = null;
        });
        markDirty();
      },

      removeSection: (sectionId: string) => {
        pushHistory(`Remove section: ${sectionId}`);
        set((s) => {
          if (!s.draft) return;
          const tpl = s.draft.templates[s.activePage];
          if (!tpl) return;
          delete tpl.sections[sectionId];
          tpl.order = tpl.order.filter((id) => id !== sectionId);
          if (s.selection.sectionId === sectionId) {
            s.selection = { type: null, sectionId: null, blockId: null, groupId: null };
            s.activePanel = "sections";
          }
        });
        markDirty();
      },

      moveSection: (sectionId: string, direction: "up" | "down") => {
        pushHistory(`Move section ${direction}: ${sectionId}`);
        set((s) => {
          if (!s.draft) return;
          const tpl = s.draft.templates[s.activePage];
          if (!tpl) return;
          const idx = tpl.order.indexOf(sectionId);
          const target = direction === "up" ? idx - 1 : idx + 1;
          if (target < 0 || target >= tpl.order.length) return;
          [tpl.order[idx], tpl.order[target]] = [tpl.order[target], tpl.order[idx]];
        });
        markDirty();
      },

      reorderSections: (newOrder: string[]) => {
        pushHistory("Reorder sections");
        set((s) => {
          if (!s.draft) return;
          const tpl = s.draft.templates[s.activePage];
          if (tpl) tpl.order = newOrder;
        });
        markDirty();
      },

      toggleSection: (sectionId: string) => {
        pushHistory(`Toggle section: ${sectionId}`);
        set((s) => {
          if (!s.draft) return;
          const tpl = s.draft.templates[s.activePage];
          if (!tpl?.sections[sectionId]) return;
          tpl.sections[sectionId].disabled = !tpl.sections[sectionId].disabled;
        });
        markDirty();
      },

      duplicateSection: (sectionId: string) => {
        pushHistory(`Duplicate section: ${sectionId}`);
        set((s) => {
          if (!s.draft) return;
          const tpl = s.draft.templates[s.activePage];
          if (!tpl?.sections[sectionId]) return;
          const original = tpl.sections[sectionId];
          const newId = generateId("sec");
          tpl.sections[newId] = cloneDeep(original);
          const idx = tpl.order.indexOf(sectionId);
          tpl.order.splice(idx + 1, 0, newId);
          s.selection = { type: "section", sectionId: newId, blockId: null, groupId: null };
        });
        markDirty();
      },

      // ── Block CRUD ──────────────────────────────────────────────────

      addBlock: (sectionId: string, blockType: string, groupId?: string) => {
        pushHistory(`Add block: ${blockType}`);
        const { schemas } = get();
        set((s) => {
          if (!s.draft || !schemas) return;
          let section: SectionInstance | undefined;
          if (groupId) {
            section = s.draft.section_groups[groupId]?.sections[sectionId];
          } else {
            section = s.draft.templates[s.activePage]?.sections[sectionId];
          }
          if (!section) return;

          // Find block schema defaults
          const sectionSchema = schemas.sections.find((sc) => sc.type === section!.type);
          const blockSchema = sectionSchema?.blocks?.find((b) => b.type === blockType);
          const defaults: Record<string, unknown> = {};
          blockSchema?.settings.forEach((bs) => {
            if (bs.default !== undefined) defaults[bs.id] = bs.default;
          });

          // Check max_blocks limit
          const currentBlockCount = section.block_order?.length ?? 0;
          if (sectionSchema?.max_blocks && currentBlockCount >= sectionSchema.max_blocks) return;

          const blockId = generateId("blk");
          if (!section.blocks) section.blocks = {};
          if (!section.block_order) section.block_order = [];
          section.blocks[blockId] = { id: blockId, type: blockType, settings: defaults };
          section.block_order.push(blockId);

          s.selection = { type: "block", sectionId, blockId, groupId: groupId ?? null };
          s.activePanel = "block-editor";
        });
        markDirty();
      },

      removeBlock: (sectionId: string, blockId: string, groupId?: string) => {
        pushHistory(`Remove block: ${blockId}`);
        set((s) => {
          if (!s.draft) return;
          let section: SectionInstance | undefined;
          if (groupId) {
            section = s.draft.section_groups[groupId]?.sections[sectionId];
          } else {
            section = s.draft.templates[s.activePage]?.sections[sectionId];
          }
          if (!section?.blocks) return;
          delete section.blocks[blockId];
          section.block_order = (section.block_order ?? []).filter((id) => id !== blockId);
          if (s.selection.blockId === blockId) {
            s.selection = { type: "section", sectionId, blockId: null, groupId: groupId ?? null };
            s.activePanel = "section-editor";
          }
        });
        markDirty();
      },

      moveBlock: (sectionId: string, blockId: string, direction: "up" | "down", groupId?: string) => {
        pushHistory(`Move block ${direction}: ${blockId}`);
        set((s) => {
          if (!s.draft) return;
          let section: SectionInstance | undefined;
          if (groupId) {
            section = s.draft.section_groups[groupId]?.sections[sectionId];
          } else {
            section = s.draft.templates[s.activePage]?.sections[sectionId];
          }
          if (!section?.block_order) return;
          const order = section.block_order;
          const idx = order.indexOf(blockId);
          const target = direction === "up" ? idx - 1 : idx + 1;
          if (target < 0 || target >= order.length) return;
          [order[idx], order[target]] = [order[target], order[idx]];
        });
        markDirty();
      },

      reorderBlocks: (sectionId: string, newOrder: string[], groupId?: string) => {
        pushHistory("Reorder blocks");
        set((s) => {
          if (!s.draft) return;
          let section: SectionInstance | undefined;
          if (groupId) {
            section = s.draft.section_groups[groupId]?.sections[sectionId];
          } else {
            section = s.draft.templates[s.activePage]?.sections[sectionId];
          }
          if (section) section.block_order = newOrder;
        });
        markDirty();
      },

      toggleBlock: (sectionId: string, blockId: string, groupId?: string) => {
        pushHistory(`Toggle block: ${blockId}`);
        set((s) => {
          if (!s.draft) return;
          let section: SectionInstance | undefined;
          if (groupId) {
            section = s.draft.section_groups[groupId]?.sections[sectionId];
          } else {
            section = s.draft.templates[s.activePage]?.sections[sectionId];
          }
          if (section?.blocks?.[blockId]) {
            section.blocks[blockId].disabled = !section.blocks[blockId].disabled;
          }
        });
        markDirty();
      },

      // ── Section Group operations ────────────────────────────────────

      updateSectionGroupSetting: (groupId: string, sectionId: string, key: string, value: unknown) => {
        pushHistory(`Update group section setting: ${key}`);
        set((s) => {
          if (!s.draft) return;
          const group = s.draft.section_groups[groupId];
          if (group?.sections[sectionId]) {
            group.sections[sectionId].settings[key] = value;
          }
        });
        markDirty();
      },

      addSectionToGroup: (groupId: string, sectionType: string) => {
        const { schemas } = get();
        if (!schemas) return;
        const groupSchemas = schemas.section_groups[groupId];
        const schema = groupSchemas?.sections.find((s) => s.type === sectionType);
        if (!schema) return;

        pushHistory(`Add to group ${groupId}: ${sectionType}`);
        const newId = generateId("grp");
        const defaults: Record<string, unknown> = {};
        schema.settings.forEach((s) => {
          if (s.default !== undefined) defaults[s.id] = s.default;
        });

        set((s) => {
          if (!s.draft) return;
          const group = s.draft.section_groups[groupId];
          if (!group) return;
          group.sections[newId] = { type: sectionType, settings: defaults };
          group.order.push(newId);
        });
        markDirty();
      },

      removeSectionFromGroup: (groupId: string, sectionId: string) => {
        pushHistory(`Remove from group ${groupId}: ${sectionId}`);
        set((s) => {
          if (!s.draft) return;
          const group = s.draft.section_groups[groupId];
          if (!group) return;
          delete group.sections[sectionId];
          group.order = group.order.filter((id) => id !== sectionId);
        });
        markDirty();
      },

      // ── Undo / Redo ─────────────────────────────────────────────────

      undo: () => {
        const { past, draft } = get();
        if (past.length === 0 || !draft) return;
        const previous = past[past.length - 1];
        set((s) => {
          s.future.unshift({ data: cloneDeep(draft), label: "undo", timestamp: Date.now() });
          s.past.pop();
          s.draft = previous.data;
        });
        markDirty();
      },

      redo: () => {
        const { future, draft } = get();
        if (future.length === 0 || !draft) return;
        const next = future[0];
        set((s) => {
          s.past.push({ data: cloneDeep(draft), label: "redo", timestamp: Date.now() });
          s.future.shift();
          s.draft = next.data;
        });
        markDirty();
      },

      // ── Save / Publish ──────────────────────────────────────────────

      save: async () => {
        const { storeId, draft } = get();
        if (!storeId || !draft) return;
        // Cancel pending autosave
        const timer = get()._autosaveTimer;
        if (timer) clearTimeout(timer);
        try {
          set((s) => { s.isSaving = true; });
          const result = await saveDraftV3(storeId, draft);
          set((s) => {
            s.isSaving = false;
            s.isDirty = false;
            s.lastSavedAt = result.saved_at;
          });
        } catch (err) {
          set((s) => { s.isSaving = false; });
          throw err;
        }
      },

      publish: async () => {
        const { storeId, draft } = get();
        if (!storeId || !draft) return;
        // Save first, then publish
        const timer = get()._autosaveTimer;
        if (timer) clearTimeout(timer);
        try {
          set((s) => { s.isPublishing = true; });
          await saveDraftV3(storeId, draft);
          const result = await publishV3(storeId);
          set((s) => {
            s.isPublishing = false;
            s.isDirty = false;
            s.lastSavedAt = result.published_at;
          });
        } catch (err) {
          set((s) => { s.isPublishing = false; });
          throw err;
        }
      },

      discardDraft: async () => {
        const { storeId } = get();
        if (!storeId) return;
        try {
          set((s) => { s.isLoading = true; });
          const restored = await discardDraftV3(storeId);
          set((s) => {
            s.draft = restored;
            s.isLoading = false;
            s.isDirty = false;
            s.past = [];
            s.future = [];
          });
        } catch (err) {
          set((s) => { s.isLoading = false; });
          throw err;
        }
      },

      // ── UI State ────────────────────────────────────────────────────

      setLocale: (locale) => set((s) => { s.locale = locale; }),
      setDeviceMode: (mode) => set((s) => { s.deviceMode = mode; }),
      setActivePanel: (panel) => set((s) => { s.activePanel = panel; }),
      setActivePage: (page) => set((s) => { s.activePage = page; }),
      setSelection: (selection) => set((s) => { s.selection = selection; }),
      clearSelection: () => set((s) => {
        s.selection = { type: null, sectionId: null, blockId: null, groupId: null };
        s.activePanel = "sections";
      }),
      setShowAddSection: (show, insertAfter = null) => set((s) => {
        s.showAddSection = show;
        s.insertAfterSectionId = insertAfter ?? null;
      }),
    };
  }),
);
