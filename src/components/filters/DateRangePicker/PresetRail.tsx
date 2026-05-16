/**
 * Left-side preset rail. Renders Shopify's preset groups:
 * Today / Yesterday, Last (N), Period to date, Last (period),
 * Quarters, BFCM, Custom range. Active preset highlights to match
 * the screenshot.
 */

import { cn } from "@/lib/utils";

import { presetLabel, type Lang } from "./format";
import {
  bfcmPrevRange,
  bfcmRange,
  customRange,
  lastMonthRange,
  lastNRange,
  lastQuarterRange,
  lastWeekRange,
  lastYearRange,
  mtdRange,
  qtdRange,
  quarterRange,
  todayRange,
  wtdRange,
  ytdRange,
  yesterdayRange,
} from "./presets";
import type { DateRange, PresetKey } from "./types";

interface PresetRailProps {
  value: DateRange;
  now: Date;
  lang: Lang;
  onSelect: (range: DateRange) => void;
}

interface PresetButtonProps {
  preset: PresetKey;
  active: boolean;
  label: string;
  onClick: () => void;
}

function PresetButton({ active, label, onClick }: PresetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-start px-3 py-1.5 rounded-md text-sm transition-colors",
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

export function PresetRail({
  value,
  now,
  lang,
  onSelect,
}: PresetRailProps) {
  const active = value.preset;

  const make = (k: PresetKey, build: () => DateRange) => ({
    key: k,
    label: presetLabel(k, lang),
    active: active === k,
    onClick: () => onSelect(build()),
  });

  const groups: PresetButtonProps[][] = [
    [
      make("today", () => todayRange(now)),
      make("yesterday", () => yesterdayRange(now)),
    ],
    [
      make("last-n", () =>
        // Carry over current N/unit if user is on Last-N already,
        // otherwise default to 30 days.
        lastNRange(
          value.lastN?.n ?? 30,
          value.lastN?.unit ?? "day",
          now,
          value.includeToday,
        ),
      ),
    ],
    [
      make("wtd", () => wtdRange(now)),
      make("mtd", () => mtdRange(now)),
      make("qtd", () => qtdRange(now)),
      make("ytd", () => ytdRange(now)),
    ],
    [
      make("last-week", () => lastWeekRange(now)),
      make("last-month", () => lastMonthRange(now)),
      make("last-quarter", () => lastQuarterRange(now)),
      make("last-year", () => lastYearRange(now)),
    ],
    [
      make("q1", () => quarterRange(1, now)),
      make("q2", () => quarterRange(2, now)),
      make("q3", () => quarterRange(3, now)),
      make("q4", () => quarterRange(4, now)),
    ],
    [
      make("bfcm", () => bfcmRange(now)),
      make("bfcm-prev", () => bfcmPrevRange(now)),
    ],
    [
      make("custom", () => customRange(value.start, value.end, now)),
    ],
  ];

  return (
    <nav className="w-44 shrink-0 border-e border-border py-2 ps-2 pe-1 space-y-3 overflow-y-auto">
      {groups.map((g, i) => (
        <div key={i} className="space-y-0.5">
          {g.map((b) => (
            <PresetButton key={b.preset} {...b} />
          ))}
        </div>
      ))}
    </nav>
  );
}
