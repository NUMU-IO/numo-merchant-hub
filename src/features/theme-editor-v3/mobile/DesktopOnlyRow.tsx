/**
 * A setting that exists but cannot be edited on a phone.
 *
 * Shown rather than hidden on purpose: a merchant who edits on both a laptop
 * and a phone must not conclude that settings "disappeared" on mobile, or that
 * their theme lost options. Disabled + labelled is honest; silently dropping it
 * is not.
 *
 * Only Tier-C types reach here (richtext, link_list_picker, video_picker,
 * product_list — 26 settings across the whole 16-theme catalogue). Genuinely
 * unsupported types render nothing at all.
 */
import { Monitor } from "lucide-react";

import type { SettingDefinition, EditorLocale } from "../types";

function label(setting: SettingDefinition, locale: EditorLocale): string {
  return (
    (locale === "ar" ? setting.locales?.ar?.label : setting.locales?.en?.label) ||
    setting.label ||
    setting.id
  );
}

export function DesktopOnlyRow({
  setting,
  locale,
}: {
  setting: SettingDefinition;
  locale: EditorLocale;
}) {
  const isAr = locale === "ar";
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5 opacity-70"
      aria-disabled
    >
      <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
        {label(setting, locale)}
      </span>
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {isAr ? "على الكمبيوتر" : "Desktop only"}
      </span>
    </div>
  );
}
