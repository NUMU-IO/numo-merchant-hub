/**
 * Start/end time inputs (HH:MM, native `<input type="time">`) that
 * sit in the picker header. Editing either input rewrites the range
 * with new wall-clock hours/minutes — granularity then auto-flips to
 * "hour" via ``granularityForSpan`` if the span shrinks below 48 h.
 *
 * Native ``input[type=time]`` honours locale formatting (12 h vs
 * 24 h) per the browser's preferences, so we don't manually format.
 */

import { setHours, setMinutes, setSeconds } from "date-fns";

import { Input } from "@/components/ui/input";

import { granularityForSpan } from "./presets";
import type { DateRange } from "./types";
import type { Lang } from "./format";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toHHMM(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseHHMM(value: string): { h: number; m: number } | null {
  const match = /^([0-2]\d):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const h = Number.parseInt(match[1], 10);
  const m = Number.parseInt(match[2], 10);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

function applyHHMM(d: Date, hhmm: { h: number; m: number }, endOfMinute: boolean) {
  return setSeconds(setMinutes(setHours(d, hhmm.h), hhmm.m), endOfMinute ? 59 : 0);
}

interface TimeRangeInputsProps {
  value: DateRange;
  lang: Lang;
  onChange: (range: DateRange) => void;
}

export function TimeRangeInputs({ value, lang, onChange }: TimeRangeInputsProps) {
  const isAr = lang === "ar";

  const commit = (which: "start" | "end", raw: string) => {
    const parsed = parseHHMM(raw);
    if (!parsed) return;
    if (which === "start") {
      const nextStart = applyHHMM(value.start, parsed, false);
      const nextEnd = nextStart > value.end ? nextStart : value.end;
      onChange({
        ...value,
        start: nextStart,
        end: nextEnd,
        preset: "custom",
        granularity: granularityForSpan(nextStart, nextEnd),
      });
    } else {
      const nextEnd = applyHHMM(value.end, parsed, true);
      const nextStart = nextEnd < value.start ? nextEnd : value.start;
      onChange({
        ...value,
        start: nextStart,
        end: nextEnd,
        preset: "custom",
        granularity: granularityForSpan(nextStart, nextEnd),
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">
        {isAr ? "من" : "From"}
      </span>
      <Input
        type="time"
        value={toHHMM(value.start)}
        onChange={(e) => commit("start", e.target.value)}
        step={60}
        className="h-8 w-[7.5rem] text-sm"
        aria-label={isAr ? "وقت البداية" : "Start time"}
      />
      <span className="text-xs text-muted-foreground">
        {isAr ? "إلى" : "To"}
      </span>
      <Input
        type="time"
        value={toHHMM(value.end)}
        onChange={(e) => commit("end", e.target.value)}
        step={60}
        className="h-8 w-[7.5rem] text-sm"
        aria-label={isAr ? "وقت النهاية" : "End time"}
      />
    </div>
  );
}
