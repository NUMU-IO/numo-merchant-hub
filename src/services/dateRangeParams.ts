/**
 * Wire-format helpers for sending a DateRange to the backend.
 * Every analytics endpoint accepts the same trio:
 *   start_date=<ISO>&end_date=<ISO>&granularity=<g>
 *
 * The backend's get_date_range_window dependency parses those
 * and ignores any leftover `days=` param, so the legacy URL still
 * works for one release.
 */

import type { DateRange } from "@/components/filters/DateRangePicker";

export function dateRangeQuery(range: DateRange): URLSearchParams {
  const qs = new URLSearchParams();
  qs.set("start_date", range.start.toISOString());
  qs.set("end_date", range.end.toISOString());
  qs.set("granularity", range.granularity);
  return qs;
}

/** Stable React Query key fragment for a range. */
export function dateRangeKey(range: DateRange): string[] {
  return [
    range.start.toISOString(),
    range.end.toISOString(),
    range.granularity,
  ];
}
