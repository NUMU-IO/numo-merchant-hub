/**
 * URL-synced date range hook. Single source of truth for the
 * filter: every page that mounts it shares the picker's state
 * via the URL, so refresh / back-forward / share-link all
 * survive without any extra glue.
 *
 * Wire-format:
 *   ?from=ISO&to=ISO&preset=<PresetKey>&g=<Granularity>&n=<int>&u=<unit>
 *
 *   - `from` / `to` are required for any non-default state.
 *   - `preset` is the label hint; missing or unknown ⇒ "custom".
 *   - `g` overrides the auto-derived granularity (chart toolbar).
 *   - `n` / `u` only present when preset === "last-n".
 *
 * Writes are coalesced with rAF so a fast typer doesn't flood
 * history. We always use `replace: true` because the picker is
 * a filter, not a navigation event.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";

import { defaultRange, granularityForSpan } from "./presets";
import type {
  DateRange,
  Granularity,
  LastNUnit,
  PresetKey,
} from "./types";

const PRESET_KEYS: readonly PresetKey[] = [
  "today",
  "yesterday",
  "last-n",
  "wtd",
  "mtd",
  "qtd",
  "ytd",
  "last-week",
  "last-month",
  "last-quarter",
  "last-year",
  "q1",
  "q2",
  "q3",
  "q4",
  "bfcm",
  "bfcm-prev",
  "custom",
];

const GRANULARITIES: readonly Granularity[] = [
  "hour",
  "day",
  "week",
  "month",
  "quarter",
  "year",
];

const LAST_N_UNITS: readonly LastNUnit[] = [
  "hour",
  "day",
  "week",
  "month",
  "year",
];

function parseDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parsePreset(v: string | null): PresetKey {
  if (v && (PRESET_KEYS as readonly string[]).includes(v))
    return v as PresetKey;
  return "custom";
}

function parseGranularity(
  v: string | null,
  fallback: Granularity,
): Granularity {
  if (v && (GRANULARITIES as readonly string[]).includes(v))
    return v as Granularity;
  return fallback;
}

function parseLastN(
  n: string | null,
  u: string | null,
): { n: number; unit: LastNUnit } | undefined {
  if (!n || !u) return undefined;
  const parsed = Number.parseInt(n, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  if (!(LAST_N_UNITS as readonly string[]).includes(u)) return undefined;
  return { n: parsed, unit: u as LastNUnit };
}

function rangeFromParams(
  params: URLSearchParams,
  now: Date,
): DateRange {
  const start = parseDate(params.get("from"));
  const end = parseDate(params.get("to"));
  if (!start || !end || start.getTime() > end.getTime()) {
    return defaultRange(now);
  }
  const preset = parsePreset(params.get("preset"));
  const granularity = parseGranularity(
    params.get("g"),
    granularityForSpan(start, end),
  );
  const lastN =
    preset === "last-n" ? parseLastN(params.get("n"), params.get("u")) : undefined;
  return {
    start,
    end,
    preset,
    granularity,
    lastN,
    includeToday: end.getTime() >= now.setHours(0, 0, 0, 0),
  };
}

function paramsFromRange(range: DateRange): Record<string, string> {
  const out: Record<string, string> = {
    from: range.start.toISOString(),
    to: range.end.toISOString(),
    preset: range.preset,
    g: range.granularity,
  };
  if (range.lastN) {
    out.n = String(range.lastN.n);
    out.u = range.lastN.unit;
  }
  return out;
}

export interface UseDateRangeUrlStateResult {
  range: DateRange;
  setRange: (next: DateRange) => void;
}

export function useDateRangeUrlState(): UseDateRangeUrlStateResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<DateRange | null>(null);

  // Pin "now" per render so the derived range stays stable inside
  // the same commit; the URL hash itself triggers recomputation
  // when query params actually change.
  const range = useMemo(
    () => rangeFromParams(searchParams, new Date()),
    [searchParams],
  );

  const setRange = useCallback(
    (next: DateRange) => {
      pendingRef.current = next;
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const r = pendingRef.current;
        pendingRef.current = null;
        if (!r) return;
        setSearchParams(
          (prev) => {
            const merged = new URLSearchParams(prev);
            Object.entries(paramsFromRange(r)).forEach(([k, v]) =>
              merged.set(k, v),
            );
            // Clear stale last-n params when leaving that preset.
            if (r.preset !== "last-n") {
              merged.delete("n");
              merged.delete("u");
            }
            return merged;
          },
          { replace: true },
        );
      });
    },
    [setSearchParams],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return { range, setRange };
}
