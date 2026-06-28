/**
 * Pure preset math. Every function takes `now` so callers can
 * pin the clock in tests and so the picker recomputes after
 * the popover crosses midnight.
 */

import {
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subHours,
  subMonths,
  subQuarters,
  subWeeks,
  subYears,
} from "date-fns";

import { lastBfcm } from "./bfcm";
import type { DateRange, Granularity, LastN, PresetKey } from "./types";

/** Auto-bucket choice based on span length, so charts never blow
 *  up rendering 8 760 hourly points for a year-long range. */
export function granularityForSpan(start: Date, end: Date): Granularity {
  const hours = (end.getTime() - start.getTime()) / 3_600_000;
  if (hours <= 48) return "hour";
  if (hours <= 90 * 24) return "day";
  if (hours <= 365 * 24) return "week";
  return "month";
}

function build(
  preset: PresetKey,
  start: Date,
  end: Date,
  now: Date,
  lastN?: LastN,
): DateRange {
  return {
    preset,
    start,
    end,
    lastN,
    granularity: granularityForSpan(start, end),
    includeToday: end.getTime() >= startOfDay(now).getTime(),
  };
}

export function todayRange(now: Date): DateRange {
  return build("today", startOfDay(now), endOfDay(now), now);
}

export function yesterdayRange(now: Date): DateRange {
  const y = subDays(now, 1);
  return build("yesterday", startOfDay(y), endOfDay(y), now);
}

export function lastNRange(
  n: number,
  unit: LastN["unit"],
  now: Date,
  includeToday: boolean,
): DateRange {
  const safeN = Math.max(1, Math.floor(n));
  const endBase = includeToday ? now : subDays(now, 1);
  const end = unit === "hour" ? endBase : endOfDay(endBase);
  let start: Date;
  switch (unit) {
    case "hour":
      start = subHours(end, safeN - 1);
      start.setMinutes(0, 0, 0);
      break;
    case "day":
      start = startOfDay(subDays(end, safeN - 1));
      break;
    case "week":
      start = startOfDay(subWeeks(end, safeN));
      break;
    case "month":
      start = startOfDay(subMonths(end, safeN));
      break;
    case "year":
      start = startOfDay(subYears(end, safeN));
      break;
  }
  return build("last-n", start, end, now, { n: safeN, unit });
}

// Period-to-date

export function wtdRange(now: Date): DateRange {
  // weekStartsOn: 0 = Sunday, matches Shopify.
  return build(
    "wtd",
    startOfWeek(now, { weekStartsOn: 0 }),
    endOfDay(now),
    now,
  );
}

export function mtdRange(now: Date): DateRange {
  return build("mtd", startOfMonth(now), endOfDay(now), now);
}

export function qtdRange(now: Date): DateRange {
  return build("qtd", startOfQuarter(now), endOfDay(now), now);
}

export function ytdRange(now: Date): DateRange {
  return build("ytd", startOfYear(now), endOfDay(now), now);
}

// Previous full period

export function lastWeekRange(now: Date): DateRange {
  const lastWeek = subWeeks(now, 1);
  return build(
    "last-week",
    startOfWeek(lastWeek, { weekStartsOn: 0 }),
    endOfWeek(lastWeek, { weekStartsOn: 0 }),
    now,
  );
}

export function lastMonthRange(now: Date): DateRange {
  const lm = subMonths(now, 1);
  return build("last-month", startOfMonth(lm), endOfMonth(lm), now);
}

export function lastQuarterRange(now: Date): DateRange {
  const lq = subQuarters(now, 1);
  return build("last-quarter", startOfQuarter(lq), endOfQuarter(lq), now);
}

export function lastYearRange(now: Date): DateRange {
  const ly = subYears(now, 1);
  return build("last-year", startOfYear(ly), endOfYear(ly), now);
}

// Quarters of the current year

export function quarterRange(
  q: 1 | 2 | 3 | 4,
  now: Date,
): DateRange {
  const year = now.getFullYear();
  const start = new Date(year, (q - 1) * 3, 1);
  const end = endOfMonth(new Date(year, (q - 1) * 3 + 2, 1));
  const key = (`q${q}` as const) satisfies PresetKey;
  return build(key, start, end, now);
}

// BFCM

export function bfcmRange(now: Date): DateRange {
  const { start, end } = lastBfcm(now);
  return build("bfcm", start, end, now);
}

export function bfcmPrevRange(now: Date): DateRange {
  const { start, end } = lastBfcm(subYears(now, 1));
  return build("bfcm-prev", start, end, now);
}

// Custom — caller supplies the picked dates verbatim. By default the
// range is snapped to whole-day boundaries; pass ``preserveTime`` to
// honour the hour/minute on each endpoint (used by the time picker).
export function customRange(
  start: Date,
  end: Date,
  now: Date,
  preserveTime = false,
): DateRange {
  return build(
    "custom",
    preserveTime ? start : startOfDay(start),
    preserveTime ? end : endOfDay(end),
    now,
  );
}

/** Default range used when no URL state is present.
 *
 * `includeToday: true` because the orders/activity lists this drives
 * are transactional, not BI: merchants expect "last 30 days" to mean
 * "today + the 29 days before it." Excluding today silently dropped
 * orders placed today from the list and looked like missing data
 * (e.g. "I just placed a test order, where is it?"). The dashboard
 * analytics views that genuinely want yesterday-as-end opt in via
 * the chip toggle instead. */
export function defaultRange(now: Date): DateRange {
  return lastNRange(30, "day", now, true);
}
