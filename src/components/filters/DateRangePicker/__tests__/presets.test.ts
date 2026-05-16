import { describe, expect, it } from "vitest";

import {
  bfcmPrevRange,
  bfcmRange,
  granularityForSpan,
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
} from "../presets";

// Fixed clock so preset math is deterministic. Local-noon avoids
// the test breaking under non-UTC timezones (date-fns operates in
// local time).
const NOW = new Date(2026, 4, 15, 12, 0, 0); // May 15 2026, 12:00 local

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("presets", () => {
  it("today is start-of-day to end-of-day", () => {
    const r = todayRange(NOW);
    expect(r.preset).toBe("today");
    expect(ymd(r.start)).toBe("2026-05-15");
    expect(ymd(r.end)).toBe("2026-05-15");
    expect(r.start.getHours()).toBe(0);
  });

  it("yesterday is a single full day before today", () => {
    const r = yesterdayRange(NOW);
    expect(r.preset).toBe("yesterday");
    const dayMs = 86_400_000;
    expect(r.end.getTime() - r.start.getTime()).toBeGreaterThan(dayMs - 100);
    expect(r.end.getTime() - r.start.getTime()).toBeLessThan(dayMs + 100);
  });

  it("last-30 days excludes today by default", () => {
    const r = lastNRange(30, "day", NOW, false);
    expect(r.preset).toBe("last-n");
    expect(r.lastN).toEqual({ n: 30, unit: "day" });
    // includeToday=false ⇒ end at yesterday 23:59:59
    expect(r.end < NOW).toBe(true);
  });

  it("last-30 days includes today when toggled", () => {
    const r = lastNRange(30, "day", NOW, true);
    expect(r.includeToday).toBe(true);
  });

  it("WTD starts on Sunday and ends today", () => {
    const r = wtdRange(NOW);
    // 2026-05-15 is a Friday; Sunday of that week is 2026-05-10
    expect(ymd(r.start)).toBe("2026-05-10");
  });

  it("MTD starts on the 1st", () => {
    const r = mtdRange(NOW);
    expect(r.start.getDate()).toBe(1);
    expect(r.start.getMonth()).toBe(NOW.getMonth());
  });

  it("QTD starts on Apr 1 in mid-May", () => {
    const r = qtdRange(NOW);
    expect(r.start.getMonth()).toBe(3); // April (0-indexed)
    expect(r.start.getDate()).toBe(1);
  });

  it("YTD starts on Jan 1", () => {
    const r = ytdRange(NOW);
    expect(r.start.getMonth()).toBe(0);
    expect(r.start.getDate()).toBe(1);
    expect(r.start.getFullYear()).toBe(2026);
  });

  it("last week is the previous Sun–Sat", () => {
    const r = lastWeekRange(NOW);
    // 2026-05-15 Friday ⇒ last week is 2026-05-03 (Sun) … 2026-05-09 (Sat)
    expect(ymd(r.start)).toBe("2026-05-03");
    expect(ymd(r.end)).toBe("2026-05-09");
  });

  it("last month is the previous calendar month", () => {
    const r = lastMonthRange(NOW);
    expect(r.start.getMonth()).toBe(3); // April
    expect(r.end.getMonth()).toBe(3);
  });

  it("last quarter from Q2 = Q1", () => {
    const r = lastQuarterRange(NOW);
    expect(r.start.getMonth()).toBe(0); // Jan
    expect(r.end.getMonth()).toBe(2); // Mar
  });

  it("last year is the previous calendar year", () => {
    const r = lastYearRange(NOW);
    expect(r.start.getFullYear()).toBe(2025);
    expect(r.end.getFullYear()).toBe(2025);
  });

  it("Q3 of current year is Jul 1 – Sep 30", () => {
    const r = quarterRange(3, NOW);
    expect(r.start.getMonth()).toBe(6); // Jul
    expect(r.end.getMonth()).toBe(8); // Sep
    expect(r.end.getDate()).toBe(30);
  });

  it("BFCM picks the most-recent fully-elapsed window", () => {
    // In May 2026, BFCM hasn't happened yet ⇒ use 2025's window.
    const r = bfcmRange(NOW);
    expect(r.preset).toBe("bfcm");
    expect(r.start.getFullYear()).toBe(2025);
    expect(r.start.getMonth()).toBe(10); // November
  });

  it("BFCM previous shifts a year earlier", () => {
    const r = bfcmPrevRange(NOW);
    expect(r.start.getFullYear()).toBe(2024);
  });

  it("granularity scales with span length", () => {
    const day = 86_400_000;
    expect(granularityForSpan(new Date(0), new Date(48 * 3_600_000))).toBe("hour");
    expect(granularityForSpan(new Date(0), new Date(30 * day))).toBe("day");
    expect(granularityForSpan(new Date(0), new Date(180 * day))).toBe("week");
    expect(granularityForSpan(new Date(0), new Date(400 * day))).toBe("month");
  });
});
