import { Checkbox } from "@/components/ui/checkbox";

import type { Lang } from "./format";

interface IncludeTodayToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  lang: Lang;
}

export function IncludeTodayToggle({
  checked,
  onChange,
  lang,
}: IncludeTodayToggleProps) {
  return (
    <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        aria-label={lang === "ar" ? "تضمين اليوم" : "Include today"}
      />
      <span>{lang === "ar" ? "تضمين اليوم" : "Include today"}</span>
    </label>
  );
}
