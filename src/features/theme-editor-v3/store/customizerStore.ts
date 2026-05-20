/**
 * Theme Editor V3 — Zustand Store.
 *
 * Central state management for the V3 customizer. Handles:
 *  - Draft state (ThemeSettingsV3)
 *  - Auto-save with 3s debounce (Dual-Write to backend)
 *  - Undo/redo stack (50 entries; consecutive same-target writes coalesce)
 *  - Section/block CRUD operations
 *  - Editor UI state (selection, locale, device, panel)
 *  - Dirty tracking + concurrent-save dedup
 *
 * This store is completely independent of the V2 ThemeEditor.tsx state.
 * The old editor continues to work alongside this one.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  ThemeSettingsV3,
  ThemeSchemaBundle,
  NormalizedSchemas,
  SectionSchemaDefinition,
  SectionInstance,
  BlockInstance,
  SettingDefinition,
  EditorLocale,
  DeviceMode,
  EditorMode,
  SidebarPanel,
  EditorSelection,
} from "../types";
import {
  fetchDraftV3,
  saveDraftV3,
  publishV3,
  fetchSchemasV3,
  discardDraftV3,
  restoreVersionV3,
} from "../services/themeEditorV3Api";
import {
  appendUndoEntry,
  clearUndoStack,
} from "@/services/customizerUndoApi";
import { ApiError } from "@/lib/api-error";

/**
 * Recognize the 401-after-refresh-failure error that the V3 API service
 * raises when `noAutoRedirect401` is on. We treat both ApiError(401) and
 * any error whose `.status` field reads 401 as session-expired so
 * future wrappers don't have to thread `instanceof ApiError` through
 * every catch site.
 */
function isSessionExpiredError(err: unknown): boolean {
  if (err instanceof ApiError && err.status === 401) return true;
  if (
    err &&
    typeof err === "object" &&
    "status" in err &&
    (err as { status?: unknown }).status === 401
  ) {
    return true;
  }
  return false;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Max history entries; older ones are evicted FIFO. */
const MAX_HISTORY = 50;
/** Debounce window for autosave round-trips. */
const AUTOSAVE_DEBOUNCE_MS = 3000;
/** Time within which consecutive same-target writes coalesce into one undo
 *  entry. Avoids the "type one character → one entry" problem. */
const HISTORY_COALESCE_MS = 1500;

// ─── History Entry ──────────────────────────────────────────────────────────

interface HistoryEntry {
  data: ThemeSettingsV3;
  /** Stable key used to coalesce consecutive writes (e.g. setting path). */
  coalesceKey: string;
  label: string;
  timestamp: number;
}

// ─── Store State ────────────────────────────────────────────────────────────

interface CustomizerState {
  // Core data
  storeId: string | null;
  draft: ThemeSettingsV3 | null;
  schemas: NormalizedSchemas | null;

  // Loading / error
  isLoading: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  error: string | null;
  /** Flipped on by any V3 service call that 401s after the refresh
   *  attempt. The editor renders an inline "re-login" overlay instead
   *  of hard-navigating, so the in-memory draft + undo stack survive
   *  until the merchant signs back in (the autosave already pushed the
   *  draft to the server, so the worst case is the in-memory undo
   *  history is rebuilt from the latest published state on re-init). */
  sessionExpired: boolean;

  // Dirty tracking
  isDirty: boolean;
  lastSavedAt: string | null;

  // Undo/redo
  past: HistoryEntry[];
  future: HistoryEntry[];

  // UI state
  locale: EditorLocale;
  deviceMode: DeviceMode;
  /**
   * Top-level mode (Shopify-parity): Sections / Theme settings / App embeds.
   * `activePanel` is the sub-state inside the Sections mode. When mode flips,
   * the sidebar swaps to the matching root panel.
   */
  activeMode: EditorMode;
  activePanel: SidebarPanel;
  activePage: string;
  /**
   * P1.2 — Resource context preview. Some templates (`product`,
   * `collection`) only make sense when previewed against a SPECIFIC
   * resource — the section settings are the merchant's edits, but the
   * resource fields (title, images, price) come from the store data.
   * When the merchant flips to one of those templates we expose a
   * resource picker in the TopBar; the picked id flows into the
   * iframe URL via LivePreview's `previewUrl` builder.
   *
   * Per-template so the merchant can keep their selected product
   * while flipping to the collection template and back. Stored
   * locally in the editor (not persisted to the draft) — switching
   * the preview resource never marks the draft dirty.
   */
  previewResources: {
    productId: string | null;
    productLabel: string | null;
    collectionSlug: string | null;
    collectionLabel: string | null;
  };
  selection: EditorSelection;
  showAddSection: boolean;
  insertAfterSectionId: string | null;

  // Internal — autosave timer + in-flight save promise (dedup)
  _autosaveTimer: ReturnType<typeof setTimeout> | null;
  _savingPromise: Promise<void> | null;
}

// ─── Store Actions ──────────────────────────────────────────────────────────

interface CustomizerActions {
  // Initialization
  initialize: (storeId: string) => Promise<void>;
  reset: () => void;

  // Draft mutations (push to undo stack + trigger autosave)
  updateGlobalSetting: (key: string, value: unknown) => void;
  /**
   * P1.5 — Default wording / translation editor. Writes a single
   * locale-keyed translation to
   * `draft.global_settings.__translations[locale][key]`. Stored
   * under the reserved `__translations` namespace so the value lives
   * inside the existing global_settings map (no SDK type change
   * required) and themes that don't consume translations simply
   * ignore the key. The bundle reads
   * `themeSettings.global_settings.__translations?.[locale]` at mount
   * and passes it to `<NuMuProvider translations={...}>` so
   * `useTranslation(key, fallback)` returns the override.
   */
  updateTranslation: (key: string, locale: string, value: string) => void;
  updateSectionSetting: (
    sectionId: string,
    key: string,
    value: unknown,
    groupId?: string,
  ) => void;
  updateBlockSetting: (
    sectionId: string,
    blockId: string,
    key: string,
    value: unknown,
    groupId?: string,
  ) => void;

  // Section CRUD
  addSection: (sectionType: string, presetIndex?: number) => void;
  removeSection: (sectionId: string) => void;
  moveSection: (sectionId: string, direction: "up" | "down") => void;
  reorderSections: (newOrder: string[]) => void;
  toggleSection: (sectionId: string) => void;
  duplicateSection: (sectionId: string) => void;

  // Block CRUD
  addBlock: (sectionId: string, blockType: string, groupId?: string) => void;
  removeBlock: (
    sectionId: string,
    blockId: string,
    groupId?: string,
  ) => void;
  moveBlock: (
    sectionId: string,
    blockId: string,
    direction: "up" | "down",
    groupId?: string,
  ) => void;
  reorderBlocks: (
    sectionId: string,
    newOrder: string[],
    groupId?: string,
  ) => void;
  toggleBlock: (
    sectionId: string,
    blockId: string,
    groupId?: string,
  ) => void;

  // Section Group operations
  updateSectionGroupSetting: (
    groupId: string,
    sectionId: string,
    key: string,
    value: unknown,
  ) => void;
  addSectionToGroup: (groupId: string, sectionType: string) => void;
  removeSectionFromGroup: (groupId: string, sectionId: string) => void;

  // Undo/redo (computed via selectors `canUndo` / `canRedo` below)
  undo: () => void;
  redo: () => void;

  // Save / Publish
  save: () => Promise<void>;
  publish: (label?: string) => Promise<void>;
  discardDraft: () => Promise<void>;
  restoreVersion: (versionId: string) => Promise<void>;

  // UI state
  setLocale: (locale: EditorLocale) => void;
  setDeviceMode: (mode: DeviceMode) => void;
  /**
   * Switch the top-level editor mode. Side effects:
   *   - Clears the section/block selection so the panel doesn't render
   *     leftover state from a different mode.
   *   - Resets `activePanel` to the matching root panel for the mode
   *     (`sections` → "sections", `theme-settings` → "global-settings").
   */
  setActiveMode: (mode: EditorMode) => void;
  setActivePanel: (panel: SidebarPanel) => void;
  setActivePage: (page: string) => void;
  setSelection: (selection: EditorSelection) => void;
  clearSelection: () => void;
  setShowAddSection: (show: boolean, insertAfter?: string | null) => void;
  /**
   * P1.2 — Set the active preview resource for product/collection
   * templates. Pass `null` for `id` to clear (returns to first-
   * available auto-pick). The label is the merchant-facing name; we
   * keep it in state so the TopBar trigger can display it without
   * re-fetching.
   */
  setPreviewResource: (
    type: "product" | "collection",
    id: string | null,
    label?: string | null,
  ) => void;

  // Auth resilience: invoked by the inline re-login banner when the
  // merchant successfully re-authenticates (or wants to retry the
  // initial load after a 401 storm).
  clearSessionExpired: () => void;
  retryAfterReauth: () => Promise<void>;
}

type CustomizerStore = CustomizerState & CustomizerActions;

// ── Selectors (compose with useCustomizerStore in components/tests) ─────────
//
// Zustand's middleware doesn't preserve Object getters across set() calls,
// so we expose canUndo/canRedo as plain selectors. Use:
//   const canUndo = useCustomizerStore(selectCanUndo);
export const selectCanUndo = (s: CustomizerStore): boolean => s.past.length > 0;
export const selectCanRedo = (s: CustomizerStore): boolean =>
  s.future.length > 0;

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId(prefix = "s"): string {
  // crypto.randomUUID is widely available; fall back to a timestamped random.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${(crypto as Crypto).randomUUID().split("-")[0]}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/** Deep clone the JSON-serializable subset of `obj`. Settings are always
 *  JSON values (the backend stores them in a JSONB column) so the JSON
 *  round-trip is correct here, plus it handles Immer proxies that
 *  structuredClone refuses to clone. */
function cloneDeep<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Human-readable template name for a canonical template id. Used when
 * the merchant authors a template that wasn't pre-seeded — we mint a
 * fresh `PageTemplate` with a friendly `name` field so version history
 * and the customizer surfaces show "Product" rather than "product".
 *
 * Falls back to title-casing the id for any value not in the map (so a
 * future theme that ships an exotic template like "lookbook" still
 * gets a reasonable display name without an entry here).
 */
const TEMPLATE_LABELS: Record<string, string> = {
  home: "Home",
  product: "Product",
  collection: "Collection",
  cart: "Cart",
  checkout: "Checkout",
  "order-confirmation": "Order confirmation",
  profile: "Profile",
  page: "Page",
  blog: "Blog",
  "404": "404 — Not found",
  password: "Password",
  search: "Search",
};

function friendlyTemplateName(id: string): string {
  if (TEMPLATE_LABELS[id]) return TEMPLATE_LABELS[id];
  return id
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Normalize the backend `ThemeSchemaBundle` (settings_schema + section_schemas
 * map) into the editor's flatter shape (sections array + section_groups map).
 * The dashboard editor treats header/footer as virtual groups whose schemas
 * come from the same section_schemas pool, filtered by tag.
 *
 * Shape compatibility: legacy internal themes return
 *   `section_schemas: Record<type, def>`  (flat)
 * BYOT / external themes return
 *   `section_schemas: { sections: Record<type, def>, blocks: Record<...> }`
 *   (nested — the bundle's manifest.json shape, kept verbatim through the
 *   marketplace install pipeline).
 *
 * We accept both. The unwrap below peels the nested shape down to the flat
 * one before mapping; without it, BYOT themes produced a schemas object
 * where every "section" was actually `sections` / `blocks` containers,
 * leaving the customizer's section editor with no fields to render.
 */
function normalizeSchemas(raw: ThemeSchemaBundle): NormalizedSchemas {
  const rawSchemas = (raw.section_schemas ?? {}) as Record<string, unknown>;
  // Detect the BYOT-nested shape: a `sections` key whose value is itself
  // an object map of types → schema definitions (the schemas themselves
  // never carry a `sections` field).
  const isNested =
    rawSchemas.sections !== undefined &&
    typeof rawSchemas.sections === "object" &&
    rawSchemas.sections !== null &&
    !Array.isArray(rawSchemas.sections);
  const sectionsMap = (
    isNested ? (rawSchemas.sections as Record<string, SectionSchemaDefinition>) : (rawSchemas as Record<string, SectionSchemaDefinition>)
  );
  const sections: SectionSchemaDefinition[] = Object.entries(sectionsMap).map(
    ([type, def]) => ({ ...def, type: def.type ?? type }),
  );

  // Group eligibility: section schemas with tag === "header" / "footer"
  // are allowed in the corresponding section_group. Everything else lives
  // in templates only.
  const groupOf = (s: SectionSchemaDefinition): string | null =>
    s.tag === "header" || s.tag === "footer" ? s.tag : null;

  const headerSections = sections.filter((s) => groupOf(s) === "header");
  const footerSections = sections.filter((s) => groupOf(s) === "footer");
  const templateSections = sections.filter((s) => groupOf(s) === null);

  return {
    global_settings: flattenGlobalSettings(raw.settings_schema),
    sections: templateSections,
    section_groups: {
      header: { sections: headerSections },
      footer: { sections: footerSections },
    },
    theme_variants: raw.variants ?? [],
  };
}

/**
 * Normalize the two shapes a theme can ship its global settings in.
 *
 * 1. Flat: `[{ type, id, label, ... }, ...]` — already what the
 *    SchemaFormV3 expects. Pass through unchanged.
 * 2. Shopify-grouped: `[{ name, locales, settings: [...] }, ...]` —
 *    Empire's `settings_schema.json` uses this. Flatten: each child
 *    setting inherits its parent's `name` as `group`, and the parent's
 *    `locales.ar.name` becomes `group_locales.ar`. SchemaFormV3 already
 *    re-groups by the `group` key, so the visual hierarchy survives.
 *
 * Mixed input (some entries grouped, some flat) gets handled
 * element-by-element so a theme that adds a stray ungrouped setting at
 * the top of the file doesn't crash the editor — the ungrouped entry
 * just falls into the default "General" group.
 *
 * Why this lives in the customizer (not the backend or SDK normalize):
 *   - Backend ships `settings_schema.json` verbatim so themes don't have
 *     to know about a hidden flattening step.
 *   - SDK `resolveThemeSettings` only touches `draft` shapes, not the
 *     schema bundle.
 *   - The flatten contract is editor-internal — adapting it here keeps
 *     the per-theme JSON file in the format Shopify themes expect, which
 *     matters because most BYOT themes will be ports of Shopify themes.
 */
function flattenGlobalSettings(raw: unknown): SettingDefinition[] {
  if (!Array.isArray(raw)) return [];
  const out: SettingDefinition[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    // Shopify-grouped entries declare `settings: [...]` and either
    // omit `type` or carry a parent-only field like `name`. Treat
    // anything with a non-string `type` as the grouped shape.
    const isGrouped =
      Array.isArray(e.settings) && (e.type === undefined || typeof e.type !== "string");
    if (isGrouped) {
      const group = typeof e.name === "string" ? e.name : "General";
      const locales = (e.locales ?? {}) as { ar?: { name?: string }; en?: { name?: string } };
      const groupLocales = {
        ar: locales.ar?.name,
        en: locales.en?.name,
      };
      for (const child of e.settings as unknown[]) {
        if (!child || typeof child !== "object") continue;
        const c = child as Record<string, unknown>;
        // Skip schema entries that have no `id` (header/paragraph
        // dividers); the SettingInputV3 testId calc + the React key
        // both require a string id. Headers belong inside a group's
        // settings list but they're rendered separately by
        // SchemaFormV3's group heading — silently dropping them on
        // ingest is the cleanest fix for now. (A follow-up could
        // synthesize a stable id from index + label.)
        if (typeof c.id !== "string") continue;
        out.push({
          ...(c as SettingDefinition),
          group: (c.group as string | undefined) ?? group,
          group_locales:
            (c.group_locales as { ar?: string; en?: string } | undefined) ??
            groupLocales,
        });
      }
    } else {
      // Flat-shape entry. Skip if it lacks an `id` for the same reason.
      if (typeof e.id !== "string") continue;
      out.push(e as SettingDefinition);
    }
  }
  return out;
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
  sessionExpired: false,
  isDirty: false,
  lastSavedAt: null,
  past: [],
  future: [],
  locale: "en",
  deviceMode: "desktop",
  activeMode: "sections",
  activePanel: "sections",
  activePage: "home",
  previewResources: {
    productId: null,
    productLabel: null,
    collectionSlug: null,
    collectionLabel: null,
  },
  selection: { type: null, sectionId: null, blockId: null, groupId: null },
  showAddSection: false,
  insertAfterSectionId: null,
  _autosaveTimer: null,
  _savingPromise: null,
};

// ─── Store ──────────────────────────────────────────────────────────────────

export const useCustomizerStore = create<CustomizerStore>()(
  immer((set, get) => {
    /**
     * Push the *current* draft onto the undo stack, coalescing consecutive
     * writes that share `coalesceKey` within HISTORY_COALESCE_MS. Burst
     * keystrokes on the same setting collapse into one entry.
     *
     * Phase 6 — shadow-syncs each push to the server via
     * appendUndoEntry. Fire-and-forget: a transient network failure
     * doesn't block local undo (the client-side FIFO still works).
     * On next mount, the customizer rehydrates from the server.
     */
    function pushHistory(coalesceKey: string, label: string) {
      const { draft } = get();
      if (!draft) return;
      const now = Date.now();
      const entry: HistoryEntry = {
        data: cloneDeep(draft),
        coalesceKey,
        label,
        timestamp: now,
      };
      let coalesced = false;
      set((state) => {
        const last = state.past[state.past.length - 1];
        // Coalesce: same target within window → drop the prior entry,
        // pretend this entry is the only "before" snapshot for the chain.
        if (
          last &&
          last.coalesceKey === coalesceKey &&
          now - last.timestamp < HISTORY_COALESCE_MS
        ) {
          // Replace the previous entry's timestamp; the snapshot itself
          // already represents "before the burst", so we keep that data
          // and only update the timestamp + label.
          last.timestamp = now;
          last.label = label;
          coalesced = true;
          return;
        }
        state.past = [...state.past.slice(-(MAX_HISTORY - 1)), entry];
        state.future = [];
      });

      // Don't double-post coalesced bursts — the server already has
      // the prior entry for this chain, and the autosave will sync
      // the current draft state separately.
      if (coalesced) return;
      const { storeId, draft: currentDraft } = get();
      if (!storeId || !currentDraft) return;
      const themeId =
        (currentDraft as { theme_id?: string }).theme_id ||
        (currentDraft as { theme?: string }).theme ||
        "default";
      // Fire-and-forget. We don't await — the server stack is for
      // cross-tab rehydration, not for the synchronous undo path.
      void appendUndoEntry(storeId, {
        theme_id: themeId,
        action_label: label,
        forward: { snapshot: entry.data as unknown as Record<string, unknown> },
        inverse: {},
      }).catch(() => {
        // Silent — pre-cleanup pass might fail if there's no network;
        // local FIFO still works and the user can keep editing.
      });
    }

    /** Cancel any pending autosave (used on manual save/publish). */
    function cancelAutosaveTimer() {
      const timer = get()._autosaveTimer;
      if (timer) clearTimeout(timer);
      set((s) => {
        s._autosaveTimer = null;
      });
    }

    /**
     * Persist the current draft. Single in-flight promise: a concurrent
     * call awaits the same promise instead of issuing a new request.
     * Returns when the request settles.
     */
    async function performSave(): Promise<void> {
      const inflight = get()._savingPromise;
      if (inflight) return inflight;

      const { storeId, draft } = get();
      if (!storeId || !draft) return;

      const promise = (async () => {
        try {
          set((s) => {
            s.isSaving = true;
          });
          await saveDraftV3(storeId, draft);
          set((s) => {
            s.isSaving = false;
            s.isDirty = false;
            s.lastSavedAt = new Date().toISOString();
          });
        } catch (err) {
          set((s) => {
            s.isSaving = false;
            if (isSessionExpiredError(err)) s.sessionExpired = true;
          });
          throw err;
        } finally {
          set((s) => {
            s._savingPromise = null;
          });
        }
      })();

      set((s) => {
        s._savingPromise = promise;
      });
      return promise;
    }

    function scheduleAutosave() {
      cancelAutosaveTimer();
      const newTimer = setTimeout(() => {
        const { storeId, draft, isDirty } = get();
        if (!storeId || !draft || !isDirty) return;
        performSave().catch((err) => {
          // Non-fatal: autosaves should never throw out of the timer.
          console.error("[V3 Autosave] Failed:", err);
        });
      }, AUTOSAVE_DEBOUNCE_MS);
      set((s) => {
        s._autosaveTimer = newTimer;
      });
    }

    function markDirty() {
      set((s) => {
        s.isDirty = true;
      });
      scheduleAutosave();
    }

    return {
      ...initialState,

      // ── Initialization ───────────────────────────────────────────────

      initialize: async (storeId: string) => {
        // Guard re-init against the same store
        if (get().storeId === storeId && get().draft) return;

        set((s) => {
          s.isLoading = true;
          s.error = null;
          // Don't clobber `sessionExpired` here — `retryAfterReauth`
          // clears it explicitly once the merchant re-authenticates,
          // so the re-login overlay stays visible until they act.
          s.storeId = storeId;
        });
        try {
          const [draftRaw, schemasRaw] = await Promise.all([
            fetchDraftV3(storeId),
            fetchSchemasV3(storeId),
          ]);
          // Backend returns `{}` (empty dict) when the store has no V3 draft
          // *and* no legacy data to normalize. Treat as "needs a theme" by
          // surfacing an error the page can route on.
          const draftOk =
            draftRaw &&
            typeof draftRaw === "object" &&
            (draftRaw as ThemeSettingsV3).schema_version === 3;
          if (!draftOk) {
            set((s) => {
              s.isLoading = false;
              s.error =
                "No theme is active for this store yet. Install a theme from the marketplace, then re-open the editor.";
            });
            return;
          }
          set((s) => {
            const draft = draftRaw as ThemeSettingsV3;
            const schemas = normalizeSchemas(schemasRaw);
            // Seed schema defaults into draft.global_settings for any
            // key the merchant hasn't authored yet. Without this, color
            // pickers / font pickers / checkboxes render their
            // controlled-value fallback (#000000, empty string, false)
            // instead of the schema's declared `default` — so a fresh
            // store looks broken even though the storefront renders
            // correctly using the schema defaults at runtime.
            //
            // We do NOT mark the draft dirty here: this is a
            // hydration-time enrichment, not a merchant edit. Subsequent
            // edits will save the seeded values along with the change.
            if (!draft.global_settings) draft.global_settings = {};
            const gs = draft.global_settings as Record<string, unknown>;
            for (const def of schemas.global_settings) {
              if (def.default === undefined) continue;
              if (gs[def.id] === undefined) gs[def.id] = def.default;
            }
            s.draft = draft;
            s.schemas = schemas;
            s.isLoading = false;
            s.isDirty = false;
            s.past = [];
            s.future = [];
            s.lastSavedAt = new Date().toISOString();
          });
        } catch (err) {
          if (isSessionExpiredError(err)) {
            set((s) => {
              s.isLoading = false;
              s.sessionExpired = true;
            });
            return;
          }
          set((s) => {
            s.isLoading = false;
            s.error =
              err instanceof Error ? err.message : "Failed to load editor";
          });
        }
      },

      reset: () => {
        cancelAutosaveTimer();
        set(initialState);
      },

      // ── Global Settings ──────────────────────────────────────────────

      updateGlobalSetting: (key, value) => {
        pushHistory(`global:${key}`, `Update ${key}`);
        set((s) => {
          if (!s.draft) return;
          s.draft.global_settings[key] = value;
        });
        markDirty();
      },

      updateTranslation: (key, locale, value) => {
        pushHistory(`translation:${locale}:${key}`, `Update ${key} (${locale})`);
        set((s) => {
          if (!s.draft) return;
          // Reserved namespace under global_settings — themes that don't
          // consume translations simply ignore the key. The bundle's
          // mount() resolver picks `__translations[locale]` and passes
          // it to NuMuProvider's `translations` prop.
          const gs = s.draft.global_settings as Record<string, unknown>;
          const existing =
            (gs.__translations as Record<string, Record<string, string>>) ??
            {};
          const perLocale = { ...(existing[locale] ?? {}) };
          if (value.trim().length === 0) {
            // Empty value → delete the override so the theme's
            // default text shows through. Persisting empty strings
            // would create unintentional blank labels.
            delete perLocale[key];
          } else {
            perLocale[key] = value;
          }
          const next = { ...existing, [locale]: perLocale };
          // Clean up empty locale buckets entirely (so the JSON stays
          // tidy when the merchant clears every override for a locale).
          if (Object.keys(perLocale).length === 0) {
            delete (next as Record<string, unknown>)[locale];
          }
          gs.__translations = next;
        });
        markDirty();
      },

      // ── Section Settings ─────────────────────────────────────────────

      updateSectionSetting: (sectionId, key, value, groupId) => {
        pushHistory(
          `section:${groupId ?? "tpl"}:${sectionId}:${key}`,
          `Update section ${key}`,
        );
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

      // ── Block Settings ───────────────────────────────────────────────

      updateBlockSetting: (sectionId, blockId, key, value, groupId) => {
        pushHistory(
          `block:${groupId ?? "tpl"}:${sectionId}:${blockId}:${key}`,
          `Update block ${key}`,
        );
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

      // ── Section CRUD ─────────────────────────────────────────────────

      addSection: (sectionType, presetIndex = 0) => {
        const { schemas, draft, activePage, insertAfterSectionId } = get();
        if (!schemas || !draft) return;

        const schema = schemas.sections.find((s) => s.type === sectionType);
        if (!schema) return;

        pushHistory(`add-section:${Date.now()}`, `Add section ${sectionType}`);

        const newId = generateId("sec");
        const defaults: Record<string, unknown> = {};
        schema.settings.forEach((s) => {
          if (s.default !== undefined) defaults[s.id] = s.default;
        });
        const preset = schema.presets?.[presetIndex];
        const presetSettings = preset?.settings ?? {};

        const blocks: Record<string, BlockInstance> = {};
        const blockOrder: string[] = [];
        if (preset?.blocks) {
          for (const presetBlock of preset.blocks) {
            const blockId = generateId("blk");
            const blockSchema = schema.blocks?.find(
              (b) => b.type === presetBlock.type,
            );
            const blockDefaults: Record<string, unknown> = {};
            blockSchema?.settings.forEach((s) => {
              if (s.default !== undefined) blockDefaults[s.id] = s.default;
            });
            blocks[blockId] = {
              type: presetBlock.type,
              settings: { ...blockDefaults, ...(presetBlock.settings ?? {}) },
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
          // Step 3 — auto-create the template if it doesn't exist yet.
          // Themes ship a fixed canonical list of templates a merchant
          // can navigate to (TopBar `PAGES`). When the merchant lands
          // on a template that wasn't seeded at theme-install time
          // (most common: customer added a 'product' template post-
          // install) and clicks Add section, we mint an empty
          // PageTemplate on the fly. Without this, the previous
          // implementation silently no-op'd on the missing template
          // and the merchant saw "Add section" appear to do nothing.
          if (!s.draft.templates[activePage]) {
            s.draft.templates[activePage] = {
              name: friendlyTemplateName(activePage),
              sections: {},
              order: [],
            };
          }
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
          s.selection = {
            type: "section",
            sectionId: newId,
            blockId: null,
            groupId: null,
          };
          s.activePanel = "section-editor";
          s.showAddSection = false;
          s.insertAfterSectionId = null;
        });
        markDirty();
      },

      removeSection: (sectionId) => {
        pushHistory(`remove-section:${sectionId}`, `Remove section`);
        set((s) => {
          if (!s.draft) return;
          const tpl = s.draft.templates[s.activePage];
          if (!tpl) return;
          delete tpl.sections[sectionId];
          tpl.order = tpl.order.filter((id) => id !== sectionId);
          if (s.selection.sectionId === sectionId) {
            s.selection = {
              type: null,
              sectionId: null,
              blockId: null,
              groupId: null,
            };
            s.activePanel = "sections";
          }
        });
        markDirty();
      },

      moveSection: (sectionId, direction) => {
        pushHistory(
          `move-section:${sectionId}`,
          `Move section ${direction}`,
        );
        set((s) => {
          if (!s.draft) return;
          const tpl = s.draft.templates[s.activePage];
          if (!tpl) return;
          const idx = tpl.order.indexOf(sectionId);
          const target = direction === "up" ? idx - 1 : idx + 1;
          if (target < 0 || target >= tpl.order.length) return;
          [tpl.order[idx], tpl.order[target]] = [
            tpl.order[target],
            tpl.order[idx],
          ];
        });
        markDirty();
      },

      reorderSections: (newOrder) => {
        pushHistory(`reorder-sections:${Date.now()}`, "Reorder sections");
        set((s) => {
          if (!s.draft) return;
          const tpl = s.draft.templates[s.activePage];
          if (tpl) tpl.order = newOrder;
        });
        markDirty();
      },

      toggleSection: (sectionId) => {
        pushHistory(`toggle-section:${sectionId}`, `Toggle section`);
        set((s) => {
          if (!s.draft) return;
          const tpl = s.draft.templates[s.activePage];
          if (!tpl?.sections[sectionId]) return;
          tpl.sections[sectionId].disabled =
            !tpl.sections[sectionId].disabled;
        });
        markDirty();
      },

      duplicateSection: (sectionId) => {
        pushHistory(
          `duplicate-section:${sectionId}`,
          `Duplicate section`,
        );
        set((s) => {
          if (!s.draft) return;
          const tpl = s.draft.templates[s.activePage];
          if (!tpl?.sections[sectionId]) return;
          const original = tpl.sections[sectionId];
          const newId = generateId("sec");
          tpl.sections[newId] = cloneDeep(original);
          const idx = tpl.order.indexOf(sectionId);
          tpl.order.splice(idx + 1, 0, newId);
          s.selection = {
            type: "section",
            sectionId: newId,
            blockId: null,
            groupId: null,
          };
        });
        markDirty();
      },

      // ── Block CRUD ───────────────────────────────────────────────────

      addBlock: (sectionId, blockType, groupId) => {
        pushHistory(`add-block:${sectionId}:${Date.now()}`, `Add block`);
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

          const sectionSchema = schemas.sections.find(
            (sc) => sc.type === section!.type,
          );
          const blockSchema = sectionSchema?.blocks?.find(
            (b) => b.type === blockType,
          );
          const defaults: Record<string, unknown> = {};
          blockSchema?.settings.forEach((bs) => {
            if (bs.default !== undefined) defaults[bs.id] = bs.default;
          });

          const currentBlockCount = section.block_order?.length ?? 0;
          if (
            sectionSchema?.max_blocks &&
            currentBlockCount >= sectionSchema.max_blocks
          )
            return;

          const blockId = generateId("blk");
          if (!section.blocks) section.blocks = {};
          if (!section.block_order) section.block_order = [];
          section.blocks[blockId] = { type: blockType, settings: defaults };
          section.block_order.push(blockId);

          s.selection = {
            type: "block",
            sectionId,
            blockId,
            groupId: groupId ?? null,
          };
          s.activePanel = "block-editor";
        });
        markDirty();
      },

      removeBlock: (sectionId, blockId, groupId) => {
        pushHistory(`remove-block:${blockId}`, `Remove block`);
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
          section.block_order = (section.block_order ?? []).filter(
            (id) => id !== blockId,
          );
          if (s.selection.blockId === blockId) {
            s.selection = {
              type: "section",
              sectionId,
              blockId: null,
              groupId: groupId ?? null,
            };
            s.activePanel = "section-editor";
          }
        });
        markDirty();
      },

      moveBlock: (sectionId, blockId, direction, groupId) => {
        pushHistory(`move-block:${blockId}`, `Move block ${direction}`);
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

      reorderBlocks: (sectionId, newOrder, groupId) => {
        pushHistory(`reorder-blocks:${sectionId}`, "Reorder blocks");
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

      toggleBlock: (sectionId, blockId, groupId) => {
        pushHistory(`toggle-block:${blockId}`, "Toggle block");
        set((s) => {
          if (!s.draft) return;
          let section: SectionInstance | undefined;
          if (groupId) {
            section = s.draft.section_groups[groupId]?.sections[sectionId];
          } else {
            section = s.draft.templates[s.activePage]?.sections[sectionId];
          }
          if (section?.blocks?.[blockId]) {
            section.blocks[blockId].disabled =
              !section.blocks[blockId].disabled;
          }
        });
        markDirty();
      },

      // ── Section Group operations ─────────────────────────────────────

      updateSectionGroupSetting: (groupId, sectionId, key, value) => {
        pushHistory(
          `group-setting:${groupId}:${sectionId}:${key}`,
          `Update group ${key}`,
        );
        set((s) => {
          if (!s.draft) return;
          const group = s.draft.section_groups[groupId];
          if (group?.sections[sectionId]) {
            group.sections[sectionId].settings[key] = value;
          }
        });
        markDirty();
      },

      addSectionToGroup: (groupId, sectionType) => {
        const { schemas } = get();
        if (!schemas) return;
        const groupSchemas = schemas.section_groups[groupId];
        const schema = groupSchemas?.sections.find(
          (s) => s.type === sectionType,
        );
        if (!schema) return;

        pushHistory(
          `add-group-section:${groupId}:${Date.now()}`,
          `Add to ${groupId}`,
        );
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

      removeSectionFromGroup: (groupId, sectionId) => {
        pushHistory(
          `remove-group-section:${groupId}:${sectionId}`,
          `Remove from ${groupId}`,
        );
        set((s) => {
          if (!s.draft) return;
          const group = s.draft.section_groups[groupId];
          if (!group) return;
          delete group.sections[sectionId];
          group.order = group.order.filter((id) => id !== sectionId);
        });
        markDirty();
      },

      // ── Undo / Redo ──────────────────────────────────────────────────
      //
      // Note: undo/redo do NOT call markDirty(). Stepping through history
      // is not a "new change" — autosave should fire only when the user
      // actively edits after settling on a history position.

      undo: () => {
        const { past, draft } = get();
        if (past.length === 0 || !draft) return;
        const previous = past[past.length - 1];
        set((s) => {
          s.future.unshift({
            data: cloneDeep(draft),
            coalesceKey: "redo",
            label: previous.label,
            timestamp: Date.now(),
          });
          s.past.pop();
          s.draft = previous.data;
          s.isDirty = true;
        });
        // Snap-save the current draft so server state matches what the
        // user sees, but skip the autosave debounce queue — call directly.
        scheduleAutosave();
      },

      redo: () => {
        const { future, draft } = get();
        if (future.length === 0 || !draft) return;
        const next = future[0];
        set((s) => {
          s.past.push({
            data: cloneDeep(draft),
            coalesceKey: "undo",
            label: next.label,
            timestamp: Date.now(),
          });
          s.future.shift();
          s.draft = next.data;
          s.isDirty = true;
        });
        scheduleAutosave();
      },

      // ── Save / Publish ───────────────────────────────────────────────

      save: async () => {
        cancelAutosaveTimer();
        await performSave();
      },

      publish: async (label?: string) => {
        const { storeId, draft } = get();
        if (!storeId || !draft) return;

        cancelAutosaveTimer();
        try {
          set((s) => {
            s.isPublishing = true;
          });
          // Ensure the latest draft is on the server first (will dedup if
          // an autosave is already in flight).
          await performSave();
          // Forward the merchant-supplied label so the published version
          // row carries it (named-versions UX). Backend that hasn't
          // rolled out the label support yet drops it harmlessly.
          await publishV3(storeId, label?.trim() || undefined);
          set((s) => {
            s.isPublishing = false;
            s.isDirty = false;
            s.lastSavedAt = new Date().toISOString();
          });
          // Phase 6 — published state is the new baseline; older
          // undo entries are no longer reversible in any useful way
          // (publishing creates a version snapshot the merchant can
          // restore from). Clear the server-side stack so a tab
          // reopen doesn't show stale "Undo" options pointing at
          // pre-publish state.
          const themeId =
            (draft as { theme_id?: string }).theme_id ||
            (draft as { theme?: string }).theme ||
            "default";
          void clearUndoStack(storeId, themeId).catch(() => {
            // Non-fatal — the local stack is also cleared below.
          });
          set((s) => {
            s.past = [];
            s.future = [];
          });
        } catch (err) {
          set((s) => {
            s.isPublishing = false;
            if (isSessionExpiredError(err)) s.sessionExpired = true;
          });
          throw err;
        }
      },

      restoreVersion: async (versionId: string) => {
        const { storeId } = get();
        if (!storeId) return;
        cancelAutosaveTimer();
        try {
          set((s) => {
            s.isLoading = true;
          });
          const result = await restoreVersionV3(storeId, versionId);
          const restored = result.draft;
          if (restored && restored.schema_version === 3) {
            set((s) => {
              s.draft = restored;
              s.isLoading = false;
              // The backend wrote a fresh autosave row; treat as clean.
              s.isDirty = false;
              s.lastSavedAt = new Date().toISOString();
              s.past = [];
              s.future = [];
            });
          } else {
            set((s) => {
              s.isLoading = false;
            });
          }
        } catch (err) {
          set((s) => {
            s.isLoading = false;
            if (isSessionExpiredError(err)) s.sessionExpired = true;
          });
          throw err;
        }
      },

      discardDraft: async () => {
        const { storeId } = get();
        if (!storeId) return;
        cancelAutosaveTimer();
        try {
          set((s) => {
            s.isLoading = true;
          });
          const result = await discardDraftV3(storeId);
          const restored = (result.published ?? null) as
            | ThemeSettingsV3
            | null;
          set((s) => {
            if (restored && (restored as ThemeSettingsV3).schema_version === 3) {
              s.draft = restored;
            }
            s.isLoading = false;
            s.isDirty = false;
            s.past = [];
            s.future = [];
          });
        } catch (err) {
          set((s) => {
            s.isLoading = false;
            if (isSessionExpiredError(err)) s.sessionExpired = true;
          });
          throw err;
        }
      },

      // ── UI State ─────────────────────────────────────────────────────

      setLocale: (locale) =>
        set((s) => {
          s.locale = locale;
        }),
      setDeviceMode: (mode) =>
        set((s) => {
          s.deviceMode = mode;
        }),
      setActiveMode: (mode) =>
        set((s) => {
          s.activeMode = mode;
          // Reset selection so the previous mode's leftover state
          // doesn't render through into the new mode's panel.
          s.selection = {
            type: null,
            sectionId: null,
            blockId: null,
            groupId: null,
          };
          // Route each mode to its root panel.
          if (mode === "sections") {
            s.activePanel = "sections";
          } else if (mode === "theme-settings") {
            s.activePanel = "global-settings";
            s.selection = {
              type: "global",
              sectionId: null,
              blockId: null,
              groupId: null,
            };
          }
          // App embeds mode has no sub-panels; the parent component
          // renders its own placeholder. activePanel stays untouched.
        }),
      setActivePanel: (panel) =>
        set((s) => {
          s.activePanel = panel;
        }),
      setActivePage: (page) =>
        set((s) => {
          s.activePage = page;
        }),
      setSelection: (selection) =>
        set((s) => {
          s.selection = selection;
        }),
      clearSelection: () =>
        set((s) => {
          s.selection = {
            type: null,
            sectionId: null,
            blockId: null,
            groupId: null,
          };
          s.activePanel = "sections";
        }),
      setShowAddSection: (show, insertAfter = null) =>
        set((s) => {
          s.showAddSection = show;
          s.insertAfterSectionId = insertAfter ?? null;
        }),

      setPreviewResource: (type, id, label = null) =>
        set((s) => {
          if (type === "product") {
            s.previewResources.productId = id;
            s.previewResources.productLabel = label;
          } else {
            s.previewResources.collectionSlug = id;
            s.previewResources.collectionLabel = label;
          }
        }),

      clearSessionExpired: () =>
        set((s) => {
          s.sessionExpired = false;
        }),

      retryAfterReauth: async () => {
        // Caller has presumably re-authenticated (via a popup or
        // /login redirect). Re-initialise from server — the in-memory
        // draft we still hold can be stale relative to the latest
        // published state, so we re-fetch and let the user start
        // again from the canonical baseline.
        const sid = get().storeId;
        set((s) => {
          s.sessionExpired = false;
          s.draft = null;
          s.schemas = null;
          s.past = [];
          s.future = [];
          s.isDirty = false;
          s.error = null;
          s.storeId = null; // force initialize to re-run
        });
        if (sid) await get().initialize(sid);
      },
    };
  }),
);
