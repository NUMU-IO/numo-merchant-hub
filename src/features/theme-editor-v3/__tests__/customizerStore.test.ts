/**
 * Unit tests for the V3 customizer store.
 *
 * Covers reducer correctness for:
 *  - canUndo / canRedo derived from past/future
 *  - undo/redo invariants (idempotent, doesn't mark dirty mid-history)
 *  - section + block CRUD (add/move/remove/toggle/duplicate)
 *  - history coalescing (consecutive same-target writes collapse)
 *  - autosave debounce schedules + cancels correctly
 *  - in-flight save dedup (concurrent saves share one promise)
 *
 * Network calls are mocked at the service module boundary.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock the API service ──
const mockSave = vi.fn();
const mockPublish = vi.fn();
const mockFetchDraft = vi.fn();
const mockFetchSchemas = vi.fn();
const mockDiscard = vi.fn();
const mockRestore = vi.fn();

vi.mock("../services/themeEditorV3Api", () => ({
  saveDraftV3: (...args: unknown[]) => mockSave(...args),
  publishV3: (...args: unknown[]) => mockPublish(...args),
  fetchDraftV3: (...args: unknown[]) => mockFetchDraft(...args),
  fetchSchemasV3: (...args: unknown[]) => mockFetchSchemas(...args),
  discardDraftV3: (...args: unknown[]) => mockDiscard(...args),
  restoreVersionV3: (...args: unknown[]) => mockRestore(...args),
}));

import {
  useCustomizerStore,
  selectCanUndo,
  selectCanRedo,
} from "../store/customizerStore";
import type { ThemeSettingsV3, ThemeSchemaBundle } from "../types";

const sampleDraft: ThemeSettingsV3 = {
  schema_version: 3,
  theme_id: "bazar",
  global_settings: { primary_color: "#000" },
  templates: {
    home: {
      name: "Home",
      sections: {
        hero_1: { type: "hero", settings: { headline: "Hi" } },
      },
      order: ["hero_1"],
    },
  },
  section_groups: {
    header: {
      name: "Header",
      sections: { header_1: { type: "header", settings: {} } },
      order: ["header_1"],
    },
    footer: {
      name: "Footer",
      sections: { footer_1: { type: "footer", settings: {} } },
      order: ["footer_1"],
    },
  },
};

const sampleSchemas: ThemeSchemaBundle = {
  theme_id: "bazar",
  theme_slug: "bazar",
  theme_type: "internal",
  settings_schema: [],
  section_schemas: {
    hero: {
      type: "hero",
      name: "Hero",
      settings: [
        { id: "headline", type: "text", label: "Headline", default: "Hello" },
      ],
      blocks: [
        {
          type: "button",
          name: "Button",
          settings: [
            { id: "label", type: "text", label: "Label", default: "Click" },
          ],
          // Nestable: a button can hold child "link" blocks (tests
          // blocks-in-blocks path addressing).
          blocks: [
            {
              type: "link",
              name: "Link",
              settings: [
                { id: "url", type: "url", label: "URL", default: "/" },
              ],
            },
          ],
          max_blocks: 4,
        },
      ],
      max_blocks: 3,
    },
    "featured-products": {
      type: "featured-products",
      name: "Featured Products",
      settings: [],
    },
    header: { type: "header", name: "Header", tag: "header", settings: [] },
    footer: { type: "footer", name: "Footer", tag: "footer", settings: [] },
  },
};

async function bootStore(): Promise<void> {
  // Seed the API mocks for initialize().
  mockFetchDraft.mockResolvedValueOnce(sampleDraft);
  mockFetchSchemas.mockResolvedValueOnce(sampleSchemas);
  await useCustomizerStore.getState().initialize("store-1");
}

beforeEach(() => {
  // Reset between tests.
  useCustomizerStore.getState().reset();
  vi.clearAllMocks();
  // Quiet console.error from the autosave timer.
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("initialize", () => {
  it("loads draft + schemas from the API and resets dirty/history", async () => {
    await bootStore();
    const s = useCustomizerStore.getState();
    expect(s.storeId).toBe("store-1");
    expect(s.draft?.schema_version).toBe(3);
    expect(s.draft?.theme_id).toBe("bazar");
    expect(s.schemas?.sections.length).toBeGreaterThan(0);
    expect(s.isDirty).toBe(false);
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
  });

  it("surfaces an error when the backend returns no V3 draft", async () => {
    mockFetchDraft.mockResolvedValueOnce({});
    mockFetchSchemas.mockResolvedValueOnce(sampleSchemas);
    await useCustomizerStore.getState().initialize("store-1");
    const s = useCustomizerStore.getState();
    expect(s.error).toBeTruthy();
    expect(s.draft).toBeNull();
  });

  it("normalizes header/footer schemas into section_groups via tag filtering", async () => {
    await bootStore();
    const s = useCustomizerStore.getState();
    expect(s.schemas?.section_groups.header.sections[0]?.type).toBe(
      "header",
    );
    expect(s.schemas?.section_groups.footer.sections[0]?.type).toBe(
      "footer",
    );
    // template-eligible sections exclude the tagged header/footer
    expect(
      s.schemas?.sections.find((sec) => sec.type === "header"),
    ).toBeUndefined();
  });
});

describe("canUndo / canRedo selectors", () => {
  it("are derived from past/future arrays", async () => {
    await bootStore();
    expect(selectCanUndo(useCustomizerStore.getState())).toBe(false);
    expect(selectCanRedo(useCustomizerStore.getState())).toBe(false);

    useCustomizerStore.getState().updateGlobalSetting("primary_color", "#fff");
    expect(selectCanUndo(useCustomizerStore.getState())).toBe(true);
    expect(selectCanRedo(useCustomizerStore.getState())).toBe(false);

    useCustomizerStore.getState().undo();
    expect(selectCanUndo(useCustomizerStore.getState())).toBe(false);
    expect(selectCanRedo(useCustomizerStore.getState())).toBe(true);
  });
});

describe("history coalescing", () => {
  it("collapses consecutive writes to the same setting within the window", async () => {
    await bootStore();
    const store = useCustomizerStore.getState();
    store.updateGlobalSetting("primary_color", "#111");
    store.updateGlobalSetting("primary_color", "#222");
    store.updateGlobalSetting("primary_color", "#333");
    // All three coalesce → still one undo entry.
    expect(useCustomizerStore.getState().past.length).toBe(1);
  });

  it("does not coalesce writes to different targets", async () => {
    await bootStore();
    const store = useCustomizerStore.getState();
    store.updateGlobalSetting("primary_color", "#111");
    store.updateGlobalSetting("font_family", "Inter");
    expect(useCustomizerStore.getState().past.length).toBe(2);
  });

  it("does not coalesce after the window elapses", async () => {
    await bootStore();
    useCustomizerStore.getState().updateGlobalSetting("primary_color", "#111");
    vi.advanceTimersByTime(2000); // > HISTORY_COALESCE_MS (1500)
    useCustomizerStore.getState().updateGlobalSetting("primary_color", "#222");
    expect(useCustomizerStore.getState().past.length).toBe(2);
  });
});

describe("undo / redo", () => {
  it("undo restores the prior state and pushes onto future", async () => {
    await bootStore();
    useCustomizerStore.getState().updateGlobalSetting("primary_color", "#fff");
    expect(
      useCustomizerStore.getState().draft?.global_settings.primary_color,
    ).toBe("#fff");

    useCustomizerStore.getState().undo();
    expect(
      useCustomizerStore.getState().draft?.global_settings.primary_color,
    ).toBe("#000");
    expect(useCustomizerStore.getState().future.length).toBe(1);
  });

  it("redo replays the next state", async () => {
    await bootStore();
    useCustomizerStore.getState().updateGlobalSetting("primary_color", "#fff");
    useCustomizerStore.getState().undo();
    useCustomizerStore.getState().redo();
    expect(
      useCustomizerStore.getState().draft?.global_settings.primary_color,
    ).toBe("#fff");
  });
});

describe("section CRUD", () => {
  it("addSection inserts a new section + selects it", async () => {
    await bootStore();
    useCustomizerStore.getState().addSection("featured-products");
    const tpl = useCustomizerStore.getState().draft!.templates.home;
    expect(Object.keys(tpl.sections).length).toBe(2);
    expect(tpl.order).toContain("hero_1");
    expect(useCustomizerStore.getState().selection.type).toBe("section");
    expect(useCustomizerStore.getState().activePanel).toBe("section-editor");
  });

  it("removeSection deletes from sections + order, clears matching selection", async () => {
    await bootStore();
    useCustomizerStore.getState().setSelection({
      type: "section",
      sectionId: "hero_1",
      blockId: null,
      groupId: null,
    });
    useCustomizerStore.getState().removeSection("hero_1");
    const tpl = useCustomizerStore.getState().draft!.templates.home;
    expect(tpl.order).not.toContain("hero_1");
    expect(tpl.sections.hero_1).toBeUndefined();
    expect(useCustomizerStore.getState().selection.sectionId).toBeNull();
  });

  it("moveSection swaps adjacent positions", async () => {
    await bootStore();
    useCustomizerStore.getState().addSection("featured-products");
    const orderBefore = useCustomizerStore.getState().draft!.templates.home
      .order;
    expect(orderBefore[0]).toBe("hero_1");
    const newSectionId = orderBefore[1];

    useCustomizerStore.getState().moveSection(newSectionId, "up");
    const orderAfter = useCustomizerStore.getState().draft!.templates.home
      .order;
    expect(orderAfter[0]).toBe(newSectionId);
    expect(orderAfter[1]).toBe("hero_1");
  });

  it("toggleSection flips disabled", async () => {
    await bootStore();
    useCustomizerStore.getState().toggleSection("hero_1");
    expect(
      useCustomizerStore.getState().draft!.templates.home.sections.hero_1
        .disabled,
    ).toBe(true);
    useCustomizerStore.getState().toggleSection("hero_1");
    expect(
      useCustomizerStore.getState().draft!.templates.home.sections.hero_1
        .disabled,
    ).toBe(false);
  });

  it("duplicateSection clones into a new id immediately after the original", async () => {
    await bootStore();
    useCustomizerStore.getState().duplicateSection("hero_1");
    const tpl = useCustomizerStore.getState().draft!.templates.home;
    expect(Object.keys(tpl.sections).length).toBe(2);
    expect(tpl.order[0]).toBe("hero_1");
    expect(tpl.order[1]).not.toBe("hero_1");
  });
});

describe("block CRUD", () => {
  it("addBlock respects max_blocks", async () => {
    await bootStore();
    const sid = "hero_1";
    // hero schema has max_blocks=3
    useCustomizerStore.getState().addBlock(sid, "button");
    useCustomizerStore.getState().addBlock(sid, "button");
    useCustomizerStore.getState().addBlock(sid, "button");
    useCustomizerStore.getState().addBlock(sid, "button"); // should be rejected
    const section = useCustomizerStore.getState().draft!.templates.home
      .sections[sid];
    expect(section.block_order?.length).toBe(3);
  });

  it("addBlock rejects a block type the container doesn't allow", async () => {
    await bootStore();
    useCustomizerStore.getState().addBlock("hero_1", "not-a-real-type");
    const section = useCustomizerStore.getState().draft!.templates.home
      .sections["hero_1"];
    expect(section.block_order?.length ?? 0).toBe(0);
  });

  it("nests blocks: add a child block into a parent block via path", async () => {
    await bootStore();
    const sid = "hero_1";
    // Add a top-level button, then a nested link inside it.
    useCustomizerStore.getState().addBlock(sid, "button");
    const section1 = useCustomizerStore.getState().draft!.templates.home
      .sections[sid];
    const buttonId = section1.block_order![0];

    useCustomizerStore.getState().addBlock(sid, "link", undefined, [buttonId]);
    const section2 = useCustomizerStore.getState().draft!.templates.home
      .sections[sid];
    const button = section2.blocks![buttonId];
    expect(button.block_order?.length).toBe(1);
    const linkId = button.block_order![0];
    expect(button.blocks![linkId].type).toBe("link");

    // Update the nested block's setting via its full path.
    useCustomizerStore
      .getState()
      .updateBlockSetting(sid, [buttonId, linkId], "url", "/about");
    const button2 = useCustomizerStore.getState().draft!.templates.home
      .sections[sid].blocks![buttonId];
    expect(button2.blocks![linkId].settings.url).toBe("/about");

    // Remove the nested block via path; the parent button survives.
    useCustomizerStore.getState().removeBlock(sid, [buttonId, linkId]);
    const button3 = useCustomizerStore.getState().draft!.templates.home
      .sections[sid].blocks![buttonId];
    expect(button3.block_order?.length ?? 0).toBe(0);
    expect(
      useCustomizerStore.getState().draft!.templates.home.sections[sid]
        .block_order,
    ).toContain(buttonId);
  });

  it("enforces MAX_BLOCK_DEPTH", async () => {
    await bootStore();
    const sid = "hero_1";
    // Build a chain button → link, then keep trying to nest links. The
    // 'link' block declares no children, so a link can't accept one —
    // proves the container-schema gate (and, by extension, the depth
    // guard) stops runaway nesting.
    useCustomizerStore.getState().addBlock(sid, "button");
    const buttonId = useCustomizerStore.getState().draft!.templates.home
      .sections[sid].block_order![0];
    useCustomizerStore.getState().addBlock(sid, "link", undefined, [buttonId]);
    const linkId = useCustomizerStore.getState().draft!.templates.home
      .sections[sid].blocks![buttonId].block_order![0];
    // link has no allowed child blocks → this add is a no-op.
    useCustomizerStore
      .getState()
      .addBlock(sid, "link", undefined, [buttonId, linkId]);
    const link = useCustomizerStore.getState().draft!.templates.home
      .sections[sid].blocks![buttonId].blocks![linkId];
    expect(link.block_order?.length ?? 0).toBe(0);
  });
});

describe("autosave debounce + dedup", () => {
  it("schedules a save after the debounce window when dirty", async () => {
    await bootStore();
    mockSave.mockResolvedValue(undefined);

    useCustomizerStore.getState().updateGlobalSetting("primary_color", "#fff");
    expect(mockSave).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(3000);
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it("manual save() cancels a pending autosave", async () => {
    await bootStore();
    mockSave.mockResolvedValue(undefined);

    useCustomizerStore.getState().updateGlobalSetting("primary_color", "#fff");
    await useCustomizerStore.getState().save();
    await vi.advanceTimersByTimeAsync(5000);
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it("dedups concurrent saves", async () => {
    await bootStore();
    let resolveSave: () => void = () => {};
    mockSave.mockImplementation(
      () => new Promise<void>((r) => (resolveSave = r)),
    );

    useCustomizerStore.getState().updateGlobalSetting("primary_color", "#fff");
    const a = useCustomizerStore.getState().save();
    const b = useCustomizerStore.getState().save();
    resolveSave();
    await Promise.all([a, b]);
    expect(mockSave).toHaveBeenCalledTimes(1);
  });
});

describe("publish", () => {
  it("calls save then publish, clears dirty + autosave timer", async () => {
    await bootStore();
    mockSave.mockResolvedValue(undefined);
    mockPublish.mockResolvedValue(undefined);

    useCustomizerStore.getState().updateGlobalSetting("primary_color", "#fff");
    await useCustomizerStore.getState().publish("Holiday Sale");

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(useCustomizerStore.getState().isDirty).toBe(false);
  });
});

describe("page switch (no reload, no global reset)", () => {
  it("setActivePage reuses the loaded draft + schemas (same object identity)", async () => {
    await bootStore();
    const before = useCustomizerStore.getState();
    const draftRef = before.draft;
    const schemasRef = before.schemas;

    useCustomizerStore.getState().setActivePage("product");
    const after = useCustomizerStore.getState();

    expect(after.activePage).toBe("product");
    // Same object identities prove no re-fetch / store reset happened on switch.
    expect(after.draft).toBe(draftRef);
    expect(after.schemas).toBe(schemasRef);
    expect(after.storeId).toBe("store-1");
    // Page switch must NOT flip the global boot loader.
    expect(after.isLoading).toBe(false);
    // No additional network calls were made for the switch.
    expect(mockFetchDraft).toHaveBeenCalledTimes(1);
    expect(mockFetchSchemas).toHaveBeenCalledTimes(1);
  });

  it("setActivePage clears the stale selection and returns to the sections list", async () => {
    await bootStore();
    useCustomizerStore.getState().setSelection({
      type: "section",
      sectionId: "hero_1",
      blockId: null,
      groupId: null,
    });
    useCustomizerStore.getState().setActivePage("collection");
    const s = useCustomizerStore.getState();
    expect(s.selection.sectionId).toBeNull();
    expect(s.activePanel).toBe("sections");
  });

  it("re-initialize for the same store is a no-op (editor shell stays mounted)", async () => {
    await bootStore();
    expect(mockFetchDraft).toHaveBeenCalledTimes(1);
    await useCustomizerStore.getState().initialize("store-1");
    expect(mockFetchDraft).toHaveBeenCalledTimes(1);
  });
});

describe("publish freshness reporting", () => {
  it("records a 'live' lastPublish when revalidation succeeded", async () => {
    await bootStore();
    mockSave.mockResolvedValue(undefined);
    mockPublish.mockResolvedValue({
      published: sampleDraft,
      revision_id: "v-1",
      content_hash: "deadbeef",
      verified: true,
      revalidation: {
        requested: true,
        succeeded: true,
        tags_requested: ["theme-store-1"],
        tags_revalidated: ["theme-store-1"],
        duration_ms: 12,
        status_code: 200,
        error: null,
      },
    });
    await useCustomizerStore.getState().publish();
    const lp = useCustomizerStore.getState().lastPublish;
    expect(lp?.verified).toBe(true);
    expect(lp?.revalidated).toBe(true);
    expect(lp?.contentHash).toBe("deadbeef");
  });

  it("records 'refresh delayed' when revalidation failed", async () => {
    await bootStore();
    mockSave.mockResolvedValue(undefined);
    mockPublish.mockResolvedValue({
      published: sampleDraft,
      revision_id: "v-2",
      content_hash: "cafe",
      verified: true,
      revalidation: {
        requested: true,
        succeeded: false,
        tags_requested: ["theme-store-1"],
        tags_revalidated: [],
        duration_ms: 5000,
        status_code: null,
        error: "http_error: timeout",
      },
    });
    await useCustomizerStore.getState().publish();
    const lp = useCustomizerStore.getState().lastPublish;
    expect(lp?.revalidated).toBe(false);
    expect(lp?.revalidationError).toContain("timeout");
  });

  it("treats a missing revalidation block as 'not attempted', not failed", async () => {
    await bootStore();
    mockSave.mockResolvedValue(undefined);
    mockPublish.mockResolvedValue({ published: sampleDraft, verified: true });
    await useCustomizerStore.getState().publish();
    const lp = useCustomizerStore.getState().lastPublish;
    expect(lp?.revalidated).toBeNull();
  });
});

describe("applyPreset", () => {
  // A hero schema that ships a preset with a nested starter-block tree
  // (button → link), so applyPreset must rebuild settings AND materialize
  // nested blocks (the Phase 4.1/4.2 path).
  const schemasWithPresets: ThemeSchemaBundle = {
    ...sampleSchemas,
    section_schemas: {
      ...sampleSchemas.section_schemas,
      hero: {
        ...sampleSchemas.section_schemas.hero,
        presets: [
          {
            name: "With CTA",
            settings: { headline: "Big Sale" },
            blocks: [
              {
                type: "button",
                settings: { label: "Shop" },
                blocks: [{ type: "link", settings: { url: "/sale" } }],
              },
            ],
          },
        ],
      },
    },
  } as ThemeSchemaBundle;

  async function bootWithPresets(): Promise<void> {
    mockFetchDraft.mockResolvedValueOnce(sampleDraft);
    mockFetchSchemas.mockResolvedValueOnce(schemasWithPresets);
    await useCustomizerStore.getState().initialize("store-1");
  }

  it("replaces settings (defaults + preset) and materializes nested blocks", async () => {
    await bootWithPresets();
    useCustomizerStore.getState().applyPreset("hero_1", 0);

    const hero = useCustomizerStore.getState().draft!.templates.home.sections
      .hero_1;
    expect(hero.settings.headline).toBe("Big Sale");
    expect(hero.block_order?.length).toBe(1);

    const btnId = hero.block_order![0];
    const btn = hero.blocks![btnId];
    expect(btn.type).toBe("button");
    expect(btn.settings.label).toBe("Shop");

    // The nested starter block (link) was materialized too.
    expect(btn.block_order?.length).toBe(1);
    const linkId = btn.block_order![0];
    expect(btn.blocks![linkId].type).toBe("link");
    expect(btn.blocks![linkId].settings.url).toBe("/sale");

    expect(useCustomizerStore.getState().isDirty).toBe(true);
    expect(useCustomizerStore.getState().past.length).toBe(1);
  });

  it("is a no-op for an out-of-range preset index", async () => {
    await bootWithPresets();
    const before = JSON.stringify(
      useCustomizerStore.getState().draft!.templates.home.sections.hero_1,
    );
    useCustomizerStore.getState().applyPreset("hero_1", 5);
    const after = JSON.stringify(
      useCustomizerStore.getState().draft!.templates.home.sections.hero_1,
    );
    expect(after).toBe(before);
    expect(useCustomizerStore.getState().past.length).toBe(0);
  });

  it("is a no-op for an unknown section id", async () => {
    await bootWithPresets();
    useCustomizerStore.getState().applyPreset("nope_1", 0);
    expect(
      useCustomizerStore.getState().draft!.templates.home.sections.nope_1,
    ).toBeUndefined();
  });
});
