/**
 * Shared types for the Shopify-style date range filter.
 *
 * A DateRange always carries a concrete [start, end] window plus
 * the preset that produced it so the trigger button can show
 * "Last 30 days" instead of a date string. Presets are pure
 * functions (`presets.ts`) — the same input `now` always yields
 * the same range, which makes the picker safe to memoize and easy
 * to test.
 */

export type Granularity =
  | "hour"
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year";

export type LastNUnit = "hour" | "day" | "week" | "month" | "year";

export type PresetKey =
  | "today"
  | "yesterday"
  | "last-n"
  | "wtd"
  | "mtd"
  | "qtd"
  | "ytd"
  | "last-week"
  | "last-month"
  | "last-quarter"
  | "last-year"
  | "q1"
  | "q2"
  | "q3"
  | "q4"
  | "bfcm"
  | "bfcm-prev"
  | "custom";

export interface LastN {
  n: number;
  unit: LastNUnit;
}

export interface DateRange {
  /** Inclusive start of the window. */
  start: Date;
  /** Inclusive end of the window. */
  end: Date;
  /** Which preset produced this range; "custom" for free-form picks. */
  preset: PresetKey;
  /** Populated only when preset === "last-n". */
  lastN?: LastN;
  /** Bucketing hint for charts. Auto-derived from span length. */
  granularity: Granularity;
  /** True when the range's end is today (or later). Drives the
   *  "Include today" checkbox state in the picker UI. */
  includeToday: boolean;
}
