/**
 * SchemaForm — renders an array of SectionSettingDefinition[] grouped by
 * their `group` field, with each group getting a heading and its controls.
 */

import { useMemo } from "react";
import type { SectionSettingDefinition } from "@/services/themeApi";
import { SettingControl } from "./SettingControl";

export interface SchemaFormProps {
  settings: SectionSettingDefinition[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
}

interface SettingGroup {
  name: string;
  nameAr?: string;
  settings: SectionSettingDefinition[];
}

export function SchemaForm({ settings, values, onChange }: SchemaFormProps) {
  const groups = useMemo(() => groupSettings(settings), [settings]);

  return (
    <div className="space-y-6">
      {groups.map((group, idx) => (
        <div key={group.name} className="space-y-4">
          {/* Group separator + heading */}
          {idx > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">
                {group.nameAr || group.name}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}

          {idx === 0 && (
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {group.nameAr || group.name}
            </h3>
          )}

          {/* Settings within the group */}
          <div className="space-y-4">
            {group.settings.map((setting) => (
              <SettingControl
                key={setting.key}
                setting={setting}
                value={values[setting.key]}
                onChange={onChange}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group settings by their `group` field, preserving order of first appearance.
// ---------------------------------------------------------------------------

function groupSettings(settings: SectionSettingDefinition[]): SettingGroup[] {
  const map = new Map<string, SettingGroup>();

  for (const s of settings) {
    const key = s.group || "General";
    if (!map.has(key)) {
      map.set(key, {
        name: key,
        nameAr: s.groupAr,
        settings: [],
      });
    }
    map.get(key)!.settings.push(s);
  }

  return Array.from(map.values());
}
