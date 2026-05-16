/**
 * The heavy interior of the popover: preset rail, "Last N" input,
 * "Include today" toggle, two-month calendar, footer summary +
 * Cancel/Apply. Lazy-loaded by DateRangePicker so the
 * react-day-picker + date-fns locale bundle only ships when a
 * merchant actually opens the picker.
 */

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import { CalendarPanel } from "./CalendarPanel";
import { dateRangeSummary, type Lang } from "./format";
import { IncludeTodayToggle } from "./IncludeTodayToggle";
import { LastNInput } from "./LastNInput";
import { PresetRail } from "./PresetRail";
import { customRange, lastNRange } from "./presets";
import { TimeRangeInputs } from "./TimeRangeInputs";
import type { DateRange } from "./types";

interface DateRangePickerContentProps {
  value: DateRange;
  lang: Lang;
  onApply: (range: DateRange) => void;
  onCancel: () => void;
}

export default function DateRangePickerContent({
  value,
  lang,
  onApply,
  onCancel,
}: DateRangePickerContentProps) {
  // Pin "now" for the lifetime of this popover. Recomputed every
  // open via the React.lazy chunk re-instantiating this component
  // (the parent unmounts on close).
  const now = useMemo(() => new Date(), []);
  const [draft, setDraft] = useState<DateRange>(value);

  // Sync if the parent's committed value changes underneath (e.g.
  // the URL was edited by hand while the popover stayed open).
  useEffect(() => setDraft(value), [value]);

  const handleIncludeTodayChange = (checked: boolean) => {
    if (draft.preset === "last-n" && draft.lastN) {
      setDraft(
        lastNRange(draft.lastN.n, draft.lastN.unit, now, checked),
      );
      return;
    }
    // For non-Last-N presets the checkbox simply reflects whether
    // today is currently inside the window; toggling it forces a
    // custom range with the matching end date.
    const end = checked ? now : new Date(now.getTime() - 86_400_000);
    setDraft(customRange(draft.start, end, now));
  };

  const isAr = lang === "ar";

  return (
    <div
      className="flex w-[760px] max-w-[95vw] flex-col"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="flex h-[440px]">
        <PresetRail
          value={draft}
          now={now}
          lang={lang}
          onSelect={setDraft}
        />

        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 border-b">
            {draft.preset === "last-n" ? (
              <LastNInput
                value={draft}
                includeToday={draft.includeToday}
                now={now}
                lang={lang}
                onChange={setDraft}
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                {dateRangeSummary(draft, lang)}
              </div>
            )}
            <IncludeTodayToggle
              checked={draft.includeToday}
              onChange={handleIncludeTodayChange}
              lang={lang}
            />
          </div>

          {/* Time range row — always visible so merchants can refine
              a "today" / "yesterday" / custom range down to the hour. */}
          <div className="flex items-center justify-between gap-3 px-4 py-2 border-b">
            <TimeRangeInputs value={draft} lang={lang} onChange={setDraft} />
            <span className="text-[11px] text-muted-foreground">
              {isAr ? "بتوقيت المتجر" : "Store time"}
            </span>
          </div>

          <div className="flex-1 overflow-auto">
            <CalendarPanel
              start={draft.start}
              end={draft.end}
              lang={lang}
              onChange={(s, e) => {
                // Preserve the user's chosen times across day clicks.
                const ns = new Date(s);
                ns.setHours(
                  draft.start.getHours(),
                  draft.start.getMinutes(),
                  0,
                  0,
                );
                const ne = new Date(e);
                ne.setHours(
                  draft.end.getHours(),
                  draft.end.getMinutes(),
                  59,
                  999,
                );
                setDraft(customRange(ns, ne, now, true));
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t bg-muted/20">
        <span className="text-xs text-muted-foreground">
          {dateRangeSummary(draft, lang)}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button size="sm" onClick={() => onApply(draft)}>
            {isAr ? "تطبيق" : "Apply"}
          </Button>
        </div>
      </div>
    </div>
  );
}
