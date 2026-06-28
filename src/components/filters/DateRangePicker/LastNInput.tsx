/**
 * "Last [N] [Days ▾]" editor used by the picker. Mirrors the
 * Shopify control with a numeric input + unit dropdown. Updates
 * are reported as a fresh range so the parent can keep its
 * single-source-of-truth invariant.
 */

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { lastNUnitLabel, type Lang } from "./format";
import { lastNRange } from "./presets";
import type { DateRange, LastNUnit } from "./types";

const UNITS: readonly LastNUnit[] = [
  "hour",
  "day",
  "week",
  "month",
  "year",
];

interface LastNInputProps {
  value: DateRange;
  includeToday: boolean;
  now: Date;
  lang: Lang;
  onChange: (range: DateRange) => void;
}

export function LastNInput({
  value,
  includeToday,
  now,
  lang,
  onChange,
}: LastNInputProps) {
  const n = value.lastN?.n ?? 30;
  const unit: LastNUnit = value.lastN?.unit ?? "day";
  const [draft, setDraft] = useState(String(n));

  // Sync local draft when an outside preset click rewrites the
  // range (e.g. user picked "Today" then came back to Last N).
  useEffect(() => {
    setDraft(String(n));
  }, [n]);

  const commit = (next: number, nextUnit: LastNUnit) => {
    onChange(lastNRange(next, nextUnit, now, includeToday));
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground shrink-0">
        {lang === "ar" ? "آخر" : "Last"}
      </span>
      <Input
        type="number"
        min={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const parsed = Number.parseInt(draft, 10);
          const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : n;
          setDraft(String(safe));
          if (safe !== n) commit(safe, unit);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="h-9 w-20 text-sm"
      />
      <Select
        value={unit}
        onValueChange={(v) => commit(n, v as LastNUnit)}
      >
        <SelectTrigger className="h-9 w-32 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {UNITS.map((u) => (
            <SelectItem key={u} value={u}>
              {lastNUnitLabel(u, n, lang)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
