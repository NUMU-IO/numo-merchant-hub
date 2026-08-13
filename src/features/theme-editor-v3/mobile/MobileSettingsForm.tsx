/**
 * Renders one schema's settings for mobile.
 *
 * Shared by the section sheet and the theme-settings sheet, so the capability
 * policy is applied in exactly one place.
 *
 * Two deliberate choices:
 *
 *  • It calls `SettingInputV3` DIRECTLY rather than going through
 *    `SchemaFormV3`. SchemaFormV3's job is grouping by `setting.group`, and the
 *    schema audit found that ZERO of 3,040 settings across all 16 themes set
 *    that field — so its grouping collapses to one bucket and buys nothing
 *    here. Going direct also avoids inheriting desktop spacing.
 *
 *  • It does NOT special-case `header`/`paragraph`. `SettingInputV3` already
 *    renders those as dividers/help text internally (SettingDivider), so they
 *    pass straight through and give the flat list its only structure — which
 *    matters, because `header` is 18% of all settings in the catalogue.
 */
import { SettingInputV3 } from "../components/inputs/SettingInputV3";
import type { SettingDefinition, EditorLocale } from "../types";
import { partitionSettingsForMobile } from "./capability-policy";
import { DesktopOnlyRow } from "./DesktopOnlyRow";

interface MobileSettingsFormProps {
  settings: readonly SettingDefinition[] | undefined;
  values: Record<string, unknown>;
  locale: EditorLocale;
  storeId?: string;
  onChange: (key: string, value: unknown) => void;
  /** Copy for the "nothing to edit here" case. */
  emptyLabel: string;
}

export function MobileSettingsForm({
  settings,
  values,
  locale,
  storeId,
  onChange,
  emptyLabel,
}: MobileSettingsFormProps) {
  const isAr = locale === "ar";
  const { mobile, desktopOnly, editableCount } = partitionSettingsForMobile(settings, values);

  if (editableCount === 0 && desktopOnly.length === 0) {
    return <p className="px-1 py-6 text-center text-[13px] text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-4">
      {mobile.map((setting, i) => (
        <SettingInputV3
          // Decorative settings (header/paragraph) may share an id or have
          // none, so the index is part of the key.
          key={`${setting.id ?? setting.type}-${i}`}
          setting={setting}
          value={setting.id ? values[setting.id] : undefined}
          locale={locale}
          storeId={storeId}
          onChange={(value) => setting.id && onChange(setting.id, value)}
        />
      ))}

      {desktopOnly.length > 0 && (
        <div className="space-y-2 border-t border-border/60 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isAr
              ? `${desktopOnly.length} إعداد محتاج كمبيوتر`
              : `${desktopOnly.length} setting${desktopOnly.length === 1 ? "" : "s"} need a desktop`}
          </p>
          {desktopOnly.map((setting) => (
            <DesktopOnlyRow key={setting.id ?? setting.label} setting={setting} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
