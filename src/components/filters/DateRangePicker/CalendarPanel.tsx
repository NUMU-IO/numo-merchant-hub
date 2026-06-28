/**
 * Two-month range calendar that drives the picker's custom selection.
 * Wraps shadcn/react-day-picker's `Calendar` with locale + RTL.
 */

import type { DateRange as RdpRange } from "react-day-picker";
import { ar as arLocale, enUS } from "date-fns/locale";

import { Calendar } from "@/components/ui/calendar";

import type { Lang } from "./format";

interface CalendarPanelProps {
  start: Date;
  end: Date;
  defaultMonth?: Date;
  lang: Lang;
  onChange: (start: Date, end: Date) => void;
}

export function CalendarPanel({
  start,
  end,
  defaultMonth,
  lang,
  onChange,
}: CalendarPanelProps) {
  const handleSelect = (next: RdpRange | undefined) => {
    if (!next?.from) return;
    const to = next.to ?? next.from;
    onChange(next.from, to);
  };

  return (
    <Calendar
      mode="range"
      numberOfMonths={2}
      defaultMonth={defaultMonth ?? start}
      selected={{ from: start, to: end }}
      onSelect={handleSelect}
      locale={lang === "ar" ? arLocale : enUS}
      dir={lang === "ar" ? "rtl" : "ltr"}
      showOutsideDays
      className="p-3"
    />
  );
}
