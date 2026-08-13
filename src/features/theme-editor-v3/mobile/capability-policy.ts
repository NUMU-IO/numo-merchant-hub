/**
 * Mobile Lite Editor — capability policy.
 *
 * The single source of truth for what the mobile editor may render. Pure
 * functions, no React, so it is trivially unit-testable.
 *
 * ─── DEFAULT-DENY ────────────────────────────────────────────────────────────
 * Anything not explicitly allowlisted is "unsupported" and renders NOTHING.
 * That includes setting types added to `SettingInputType` after this file was
 * written. This matters because `SettingInputV3`'s `default:` case falls back
 * to a plain text input for unknown types — acceptable on desktop, but on a
 * phone it would ship a broken control that silently writes garbage into a
 * merchant's live theme.
 *
 * ─── THE LIST IS MEASURED, NOT GUESSED ───────────────────────────────────────
 * Derived from `docs/Plans/PWA/1b-schema-audit.md`: all 16 shipped themes,
 * 3,040 setting definitions. Only 18 distinct types are used by ANY real theme,
 * and 11 of those cover 98.85% of every setting in the catalogue. 14 of the
 * union's 31 members are used by no theme at all — so V1 builds no control for
 * them and default-deny handles them for free.
 *
 * Keep this in lock-step with `PWA overview.md` §9d. If implementation shows a
 * type is misclassified, change BOTH in the same PR.
 */
import type { SettingDefinition, SettingInputType } from "../types";
import { evaluateVisibleIf, type VisibleIfShape } from "../components/inputs/visible-if";

export type MobileCapability = "mobile" | "desktop-only" | "unsupported";

/**
 * Tier A — the V1 allowlist. 11 types, 3,005 / 3,040 real settings (98.85%).
 * Counts are the measured usage across all 16 themes.
 */
const TIER_A: ReadonlySet<string> = new Set([
  "text", //         1185 — headings, button labels; 39% of everything
  "header", //        555 — decorative divider (SettingInputV3 renders it)
  "checkbox", //      319 — visibility toggles; strongest signal in the data
  "url", //           242 — button and nav links
  "textarea", //      226 — body copy
  "range", //         179 — spacing/size; all 179 have valid min/max
  "image_picker", //  147 — the highest-value mobile action
  "select", //         76 — presets; 0 have empty options, counts 2–8
  "color", //          63 — native <input type=color>, verified touch-safe
  "number", //         12
  "paragraph", //       1 — decorative help text
]);

/**
 * Tier B — cheap additions, +9 settings, brings coverage to 99.14%.
 * `font_picker` is rendered by SettingInputV3 but is NOT in the union — a
 * latent typing hole tracked separately. It is allowlisted here because real
 * themes ship it and it works.
 */
const TIER_B: ReadonlySet<string> = new Set(["font", "font_picker", "product"]);

/**
 * Tier C — real controls that are genuinely unusable or unsafe on a touch
 * screen. 4 types, 26 settings (0.86%). Rendered as a disabled "edit on
 * desktop" row so the merchant knows the setting exists rather than wondering
 * why the phone shows fewer options than the computer.
 */
const TIER_C: ReadonlySet<string> = new Set([
  "link_list_picker", // 13 — nested menu editing
  "video_picker", //      6
  "richtext", //          4 — full WYSIWYG toolbar
  "product_list", //      3 — multi-select + reorder
]);

/** Decorative types: allowed on mobile, but they are not editable fields. */
const DECORATIVE: ReadonlySet<string> = new Set(["header", "paragraph"]);

export function classifySettingType(type: string): MobileCapability {
  if (TIER_A.has(type) || TIER_B.has(type)) return "mobile";
  if (TIER_C.has(type)) return "desktop-only";
  return "unsupported"; // default-deny
}

/** `header` / `paragraph` render as dividers, not inputs. */
export function isDecorative(setting: SettingDefinition): boolean {
  return DECORATIVE.has(setting.type);
}

export function classifySetting(setting: SettingDefinition): MobileCapability {
  return classifySettingType(setting.type);
}

export interface PartitionedSettings {
  /** Renderable on mobile, in schema order (decoratives included). */
  mobile: SettingDefinition[];
  /** Real settings that exist but need a desktop. Shown disabled. */
  desktopOnly: SettingDefinition[];
  /** Count of mobile entries that are actually EDITABLE (excludes dividers). */
  editableCount: number;
}

/**
 * Split a schema's settings for mobile rendering.
 *
 * `visible_if` is evaluated with the SAME helper the desktop editor uses, so a
 * conditionally-hidden field stays hidden on mobile too. A field hidden by
 * `visible_if` is dropped entirely — it is not "desktop-only", it simply does
 * not apply right now.
 */
export function partitionSettingsForMobile(
  settings: readonly SettingDefinition[] | undefined,
  values: Record<string, unknown>,
): PartitionedSettings {
  const mobile: SettingDefinition[] = [];
  const desktopOnly: SettingDefinition[] = [];
  let editableCount = 0;

  for (const setting of settings ?? []) {
    const visible = evaluateVisibleIf(
      (setting as { visible_if?: VisibleIfShape }).visible_if,
      values,
    );
    if (!visible) continue;

    switch (classifySetting(setting)) {
      case "mobile":
        mobile.push(setting);
        if (!isDecorative(setting)) editableCount += 1;
        break;
      case "desktop-only":
        desktopOnly.push(setting);
        break;
      default:
        // unsupported → rendered nowhere, deliberately.
        break;
    }
  }

  return { mobile, desktopOnly, editableCount };
}

/**
 * Exposed for tests and for the §9d table. Not used at runtime — the classifier
 * is the runtime path.
 */
export const MOBILE_CAPABILITY_TIERS = {
  tierA: [...TIER_A] as readonly string[],
  tierB: [...TIER_B] as readonly string[],
  tierC: [...TIER_C] as readonly string[],
} as const;

/** Compile-time nudge: every union member should be consciously classified. */
export type KnownSettingType = SettingInputType;
