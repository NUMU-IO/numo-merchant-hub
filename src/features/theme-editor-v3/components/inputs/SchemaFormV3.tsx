/**
 * SchemaFormV3 — Schema-driven form generator.
 *
 * Renders an array of SettingDefinition[] as grouped form controls.
 * Supports bilingual labels (EN/AR) via the editor locale.
 * All input types are handled by the SettingInputV3 component.
 *
 * Conditional visibility (`visible_if`) is evaluated here against the
 * current `values` map: a setting whose expression evaluates falsy is
 * skipped from the rendered output. Group separators are emitted only
 * for groups that have at least one visible setting so the form
 * doesn't show empty group headings.
 * All 14 input types are handled by the SettingInputV3 component.
 */

import { useMemo } from "react";
import type { SettingDefinition, EditorLocale } from "../../types";
import { SettingInputV3 } from "./SettingInputV3";
import { evaluateVisibleIf, type VisibleIfShape } from "./visible-if";

export interface SchemaFormV3Props {
  settings: SettingDefinition[];
  values: Record<string, unknown>;
  locale: EditorLocale;
  onChange: (key: string, value: unknown) => void;
  storeId?: string;
}

interface SettingGroup {
  name: string;
  localizedName: string;
  settings: SettingDefinition[];
}

function groupSettings(settings: SettingDefinition[], locale: EditorLocale): SettingGroup[] {
  const map = new Map<string, SettingGroup>();

  for (const s of settings) {
    const groupKey = s.group || "general";
    if (!map.has(groupKey)) {
      const localizedName =
        locale === "ar"
          ? s.group_locales?.ar || s.group || "عام"
          : s.group_locales?.en || s.group || "General";
      map.set(groupKey, { name: groupKey, localizedName, settings: [] });
    }
    map.get(groupKey)!.settings.push(s);
  }

  return Array.from(map.values());
}

export function SchemaFormV3({ settings, values, locale, onChange, storeId }: SchemaFormV3Props) {
  const groups = useMemo(() => groupSettings(settings, locale), [settings, locale]);

  // Filter each group's settings against `visible_if` BEFORE rendering
  // so groups whose only setting is currently hidden don't show empty
  // headings. The dependency on `values` is intentional — re-running on
  // every change is cheap (linear in setting count) and avoids stale
  // visibility when a sibling setting flips.
  //
  // NB: this hook MUST be called unconditionally before any early
  // return (rules-of-hooks). The empty-settings short-circuit below
  // accepts a one-render visibleGroups computation as the cost.
  const visibleGroups = useMemo(() => {
    return groups
      .map((g) => ({
        ...g,
        settings: g.settings.filter((s) =>
          evaluateVisibleIf(
            (s as { visible_if?: VisibleIfShape }).visible_if,
            values,
          ),
        ),
      }))
      .filter((g) => g.settings.length > 0);
  }, [groups, values]);

  if (settings.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {locale === "ar" ? "لا توجد إعدادات قابلة للتعديل." : "No configurable settings."}
      </p>
    );
  }

  if (visibleGroups.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {locale === "ar"
          ? "لا توجد إعدادات مرئية حالياً."
          : "No visible settings under current conditions."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {visibleGroups.map((group, idx) => (
        <div key={group.name} className="space-y-4">
          {/* Group separator */}
          {idx > 0 && <div className="h-px bg-border" />}

          {/* Group heading */}
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.localizedName}
          </h3>

          {/* Settings within the group */}
          <div className="space-y-4">
            {group.settings.map((setting) => (
              <SettingInputV3
                key={setting.id}
                setting={setting}
                value={values[setting.id]}
                locale={locale}
                onChange={(val) => onChange(setting.id, val)}
                storeId={storeId}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
