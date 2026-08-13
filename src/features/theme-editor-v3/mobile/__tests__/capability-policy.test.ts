/**
 * The Mobile Lite Editor's safety net.
 *
 * `SettingInputV3`'s `default:` case renders a plain text input for unknown
 * setting types. On desktop that is a tolerable fallback; on mobile it would
 * ship a broken control that writes garbage into a merchant's LIVE theme. The
 * only thing preventing that is this policy being default-deny — so it is
 * asserted here rather than assumed.
 */
import { describe, expect, it } from "vitest";

import {
  classifySettingType,
  partitionSettingsForMobile,
  isDecorative,
  MOBILE_CAPABILITY_TIERS,
} from "../capability-policy";
import type { SettingDefinition } from "../../types";

/** The full SettingInputType union (31) + the 3 renderer-only extras. */
const ALL_KNOWN_TYPES = [
  "text", "textarea", "richtext", "inline_richtext", "number", "range",
  "range_with_unit", "color", "checkbox", "select", "radio", "font",
  "image_picker", "url", "header", "paragraph", "html", "date", "time",
  "video_picker", "product", "collection", "page_picker", "blog_picker",
  "link_list_picker", "variant_picker", "product_list", "collection_list",
  "color_scheme", "color_scheme_group", "file_upload",
  "font_picker", "icon", "icon_picker",
] as const;

/** Measured usage across all 16 shipped themes — see 1b-schema-audit.md. */
const TYPES_USED_BY_REAL_THEMES = [
  "text", "header", "checkbox", "url", "textarea", "range", "image_picker",
  "select", "color", "link_list_picker", "number", "video_picker", "product",
  "richtext", "product_list", "font", "font_picker", "paragraph",
] as const;

const setting = (type: string, extra: Partial<SettingDefinition> = {}): SettingDefinition =>
  ({ id: `s_${type}`, type, label: type, ...extra }) as SettingDefinition;

describe("capability policy — classification", () => {
  it("classifies every known type deterministically", () => {
    for (const type of ALL_KNOWN_TYPES) {
      expect(["mobile", "desktop-only", "unsupported"]).toContain(classifySettingType(type));
    }
  });

  it("allows exactly the audited Tier A + Tier B types on mobile", () => {
    const allowed = [...MOBILE_CAPABILITY_TIERS.tierA, ...MOBILE_CAPABILITY_TIERS.tierB];
    for (const type of allowed) expect(classifySettingType(type)).toBe("mobile");
    expect(MOBILE_CAPABILITY_TIERS.tierA).toHaveLength(11);
  });

  it("marks the 4 audited Tier C types desktop-only", () => {
    expect(MOBILE_CAPABILITY_TIERS.tierC).toHaveLength(4);
    for (const type of MOBILE_CAPABILITY_TIERS.tierC) {
      expect(classifySettingType(type)).toBe("desktop-only");
    }
  });

  it("DEFAULT-DENIES an unknown type — the whole point of the policy", () => {
    expect(classifySettingType("some_future_type")).toBe("unsupported");
    expect(classifySettingType("")).toBe("unsupported");
    expect(classifySettingType("html")).toBe("unsupported");
  });

  it("covers every type real themes actually ship", () => {
    for (const type of TYPES_USED_BY_REAL_THEMES) {
      // Each is consciously mobile or desktop-only — never silently unsupported.
      expect(classifySettingType(type)).not.toBe("unsupported");
    }
  });

  it("flags header/paragraph as decorative, not editable", () => {
    expect(isDecorative(setting("header"))).toBe(true);
    expect(isDecorative(setting("paragraph"))).toBe(true);
    expect(isDecorative(setting("text"))).toBe(false);
  });
});

describe("capability policy — partitioning", () => {
  it("renders NO control for unsupported types", () => {
    const { mobile, desktopOnly, editableCount } = partitionSettingsForMobile(
      [setting("html"), setting("color_scheme_group"), setting("totally_made_up")],
      {},
    );
    // color_scheme_group is unused by every theme, so it is not even Tier C.
    expect(mobile).toHaveLength(0);
    expect(desktopOnly).toHaveLength(0);
    expect(editableCount).toBe(0);
  });

  it("separates mobile, desktop-only and unsupported in one pass", () => {
    const { mobile, desktopOnly, editableCount } = partitionSettingsForMobile(
      [
        setting("text"),
        setting("header"), // decorative → mobile but not editable
        setting("richtext"), // Tier C
        setting("html"), // unsupported
        setting("color"),
      ],
      {},
    );
    expect(mobile.map((s) => s.type)).toEqual(["text", "header", "color"]);
    expect(desktopOnly.map((s) => s.type)).toEqual(["richtext"]);
    expect(editableCount).toBe(2); // text + color; header excluded
  });

  it("honours visible_if exactly as the desktop editor does", () => {
    const settings = [
      setting("checkbox", { id: "show_cta" }),
      setting("text", { id: "cta_label", visible_if: "show_cta" } as Partial<SettingDefinition>),
    ];
    expect(partitionSettingsForMobile(settings, { show_cta: false }).editableCount).toBe(1);
    expect(partitionSettingsForMobile(settings, { show_cta: true }).editableCount).toBe(2);
  });

  it("survives an empty or missing schema", () => {
    expect(partitionSettingsForMobile(undefined, {}).editableCount).toBe(0);
    expect(partitionSettingsForMobile([], {}).mobile).toHaveLength(0);
  });
});
