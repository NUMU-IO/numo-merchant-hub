/**
 * Controlled-state hook for callers that don't want URL sync
 * (e.g. modals, embedded reports). Mirrors useDateRangeUrlState
 * for swap-out compatibility.
 */

import { useState } from "react";

import { defaultRange } from "./presets";
import type { DateRange } from "./types";

export interface UseDateRangeResult {
  range: DateRange;
  setRange: (next: DateRange) => void;
}

export function useDateRange(initial?: DateRange): UseDateRangeResult {
  const [range, setRange] = useState<DateRange>(
    () => initial ?? defaultRange(new Date()),
  );
  return { range, setRange };
}
