import { describe, expect, it } from "vitest";

import { chartDayLabel, formatDate } from "@/lib/format-date";

describe("dates in the merchant's language", () => {
  it("relabels English and ISO chart days in Arabic, with Latin digits", () => {
    expect(chartDayLabel("Aug 29", "ar")).toBe("29 أغسطس");
    expect(chartDayLabel("2026-08-29", "ar")).toBe("29 أغسطس");
    expect(chartDayLabel("2026-08-29", "en")).toBe("Aug 29");
    expect(chartDayLabel("14:00", "ar")).toBe("14:00");
  });

  it("orders Arabic dates day-month-year", () => {
    expect(formatDate("2024-01-01T12:00:00", "ar", { year: "numeric", month: "long", day: "numeric" })).toBe(
      "1 يناير 2024",
    );
  });
});
