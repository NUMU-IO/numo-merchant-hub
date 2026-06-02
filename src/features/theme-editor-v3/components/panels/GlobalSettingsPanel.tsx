/**
 * GlobalSettingsPanel — Theme Settings mode body.
 *
 * Shopify-parity: this is the panel a merchant sees when they switch
 * from Sections mode to Theme settings mode. Renders every entry from
 * `schemas.global_settings` (which the backend assembles from the
 * active theme's `settings_schema.json`).
 *
 * Examples of what lives here, per the V3 schema convention:
 *   - Brand: primary color, accent color, page background
 *   - Typography: heading font, body font
 *   - Layout: announcement bar toggle, frosted header toggle, etc.
 *   - Cart / Buttons / Inputs / Custom CSS (when the theme exposes them)
 *
 * Settings are grouped by `setting.group` via `SchemaFormV3`'s built-in
 * grouping; we just hand the whole list off and let the form take care
 * of section headings, `visible_if` conditional visibility, and locale
 * resolution.
 *
 * Edits route through `updateGlobalSetting(key, value)` in the
 * customizer store — same code path the live-preview roundtrip uses,
 * so every edit propagates to the storefront iframe within ~16ms
 * thanks to the Wave-3 `applyDraft` channel.
 */

import { ArrowLeft, Settings as SettingsIcon } from "lucide-react";

import { useCustomizerStore } from "../../store/customizerStore";
import { SchemaFormV3 } from "../inputs/SchemaFormV3";
import { SocialLinksEditor } from "./SocialLinksEditor";

export function GlobalSettingsPanel() {
  const draft = useCustomizerStore((s) => s.draft);
  const schemas = useCustomizerStore((s) => s.schemas);
  const locale = useCustomizerStore((s) => s.locale);
  const storeId = useCustomizerStore((s) => s.storeId);
  const updateGlobalSetting = useCustomizerStore(
    (s) => s.updateGlobalSetting,
  );
  const setActiveMode = useCustomizerStore((s) => s.setActiveMode);

  const settings = schemas?.global_settings ?? [];
  const values = (draft?.global_settings ?? {}) as Record<string, unknown>;
  const isAr = locale === "ar";

  return (
    <div className="flex h-full flex-col">
      {/* Header — same shape as SectionEditorPanel for visual consistency.
          The back arrow returns to Sections mode; this gives the merchant
          one always-visible escape hatch on top of the mode-switcher tabs. */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => setActiveMode("sections")}
          aria-label={isAr ? "العودة إلى الأقسام" : "Back to sections"}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <SettingsIcon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold truncate">
          {isAr ? "إعدادات الثيم" : "Theme settings"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {settings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "هذا الثيم لا يعرض إعدادات عامة قابلة للتعديل."
              : "This theme doesn't expose theme-level settings."}
          </p>
        ) : (
          <SchemaFormV3
            settings={settings}
            values={values}
            locale={locale}
            onChange={(key, value) => updateGlobalSetting(key, value)}
            storeId={storeId ?? undefined}
          />
        )}

        {/* Store-level social links — always available, even when the theme
            exposes no global settings. Drives the storefront footer icons. */}
        <SocialLinksEditor locale={locale} />
      </div>
    </div>
  );
}

export default GlobalSettingsPanel;
