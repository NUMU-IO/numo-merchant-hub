/**
 * Two-pane governorate picker.
 *
 * Left pane: governorates available to assign (filtered to those not
 * already in another active zone and not in the current selection).
 * Right pane: governorates assigned to this zone.
 *
 * Bulk action: "Select all in Logistics Zone: …" pulls from the
 * canonical LogisticsZone preset groupings.
 */

import { useMemo, useState } from "react";
import { ChevronRight, ChevronLeft, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  useReferenceGovernorates,
  useShippingCoverage,
} from "@/hooks/useShippingZones";
import type { Governorate, LogisticsZone } from "@/services/shippingApi";

interface Props {
  storeId: string | undefined;
  /** ISO 3166-2 codes currently assigned to this zone (controlled). */
  selectedCodes: string[];
  /** Called when the selection changes. */
  onChange: (codes: string[]) => void;
  /**
   * Zone being edited, if any. When set, governorates already attached
   * to THIS zone remain selectable (otherwise coverage conflict filter
   * would incorrectly exclude them).
   */
  currentZoneId?: string;
}

const LOGISTICS_ZONE_LABELS: Record<
  LogisticsZone,
  { en: string; ar: string }
> = {
  greater_cairo: { en: "Greater Cairo", ar: "القاهرة الكبرى" },
  delta: { en: "Delta", ar: "الدلتا" },
  canal_sinai: { en: "Canal & Sinai", ar: "القناة وسيناء" },
  upper_egypt: { en: "Upper Egypt", ar: "الصعيد" },
  remote: { en: "Remote", ar: "المناطق النائية" },
};

export function GovernoratePicker({
  storeId,
  selectedCodes,
  onChange,
  currentZoneId,
}: Props) {
  const { language, isRTL } = useLanguage();
  const { data: governorates = [] } = useReferenceGovernorates(
    language === "ar" ? "ar" : "en",
  );
  // Coverage is used to visually indicate which governorates are
  // already covered by OTHER active zones. We don't hard-block the
  // selection in the UI — the backend will 409 on conflict, but we
  // surface it here as a disabled state + tooltip.
  const { data: coverage } = useShippingCoverage(storeId);

  const [search, setSearch] = useState("");
  const [bulkZone, setBulkZone] = useState<LogisticsZone | "">("");

  const selectedSet = useMemo(() => new Set(selectedCodes), [selectedCodes]);
  /** Codes covered by OTHER zones (excluding the zone being edited). */
  const conflictSet = useMemo(() => {
    if (!coverage) return new Set<string>();
    // Rough approximation: any covered code that isn't in our selection
    // belongs to another zone. True when editing a zone that has already
    // been saved; for new zones, `selectedCodes` is already excluded.
    const set = new Set(coverage.covered);
    for (const c of selectedCodes) set.delete(c);
    return set;
  }, [coverage, selectedCodes]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return governorates;
    return governorates.filter(
      (g) =>
        g.name.toLowerCase().includes(needle) ||
        g.code.toLowerCase().includes(needle) ||
        g.name_en.toLowerCase().includes(needle) ||
        g.name_ar.includes(needle),
    );
  }, [governorates, search]);

  const available = filtered.filter((g) => !selectedSet.has(g.code));
  const selected = governorates.filter((g) => selectedSet.has(g.code));

  function add(code: string) {
    if (selectedSet.has(code)) return;
    onChange([...selectedCodes, code]);
  }
  function remove(code: string) {
    onChange(selectedCodes.filter((c) => c !== code));
  }
  function addAllVisible() {
    const addable = available.filter((g) => !conflictSet.has(g.code)).map((g) => g.code);
    if (addable.length === 0) return;
    onChange([...new Set([...selectedCodes, ...addable])]);
  }
  function removeAll() {
    onChange([]);
  }

  function applyBulkZone() {
    if (!bulkZone) return;
    const toAdd = governorates
      .filter((g) => g.default_zone === bulkZone && !conflictSet.has(g.code))
      .map((g) => g.code);
    if (toAdd.length === 0) return;
    onChange([...new Set([...selectedCodes, ...toAdd])]);
  }

  const ArrowAdd = isRTL ? ChevronLeft : ChevronRight;
  const ArrowRemove = isRTL ? ChevronRight : ChevronLeft;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label className="mb-1 block text-xs">
            {language === "ar" ? "بحث" : "Search"}
          </Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={language === "ar" ? "ابحث عن محافظة" : "Search governorates"}
          />
        </div>
        <div className="w-full sm:w-60">
          <Label className="mb-1 block text-xs">
            {language === "ar"
              ? "إضافة مجموعة لوجستية"
              : "Add logistics zone"}
          </Label>
          <div className="flex gap-2">
            <Select
              value={bulkZone}
              onValueChange={(v) => setBulkZone(v as LogisticsZone)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue
                  placeholder={language === "ar" ? "اختر" : "Choose"}
                />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LOGISTICS_ZONE_LABELS) as LogisticsZone[]).map(
                  (z) => (
                    <SelectItem key={z} value={z}>
                      {LOGISTICS_ZONE_LABELS[z][language === "ar" ? "ar" : "en"]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={applyBulkZone}
              disabled={!bulkZone}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Pane
          title={
            language === "ar"
              ? `متاحة (${available.length})`
              : `Available (${available.length})`
          }
          footerAction={
            available.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addAllVisible}
              >
                {language === "ar" ? "إضافة الكل" : "Add all"}
              </Button>
            ) : null
          }
        >
          {available.length === 0 ? (
            <EmptyState>
              {language === "ar" ? "لا توجد نتائج" : "No matches"}
            </EmptyState>
          ) : (
            <ul className="divide-y">
              {available.map((g) => {
                const conflict = conflictSet.has(g.code);
                return (
                  <li
                    key={g.code}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm">{g.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {g.code}
                        {conflict && (
                          <span className="ml-1 text-destructive">
                            {language === "ar"
                              ? "· مستخدمة في منطقة أخرى"
                              : "· already in another zone"}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={conflict}
                      onClick={() => add(g.code)}
                      aria-label={language === "ar" ? "إضافة" : "Add"}
                    >
                      <ArrowAdd className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Pane>

        <Pane
          title={
            language === "ar"
              ? `مختارة (${selected.length})`
              : `Assigned (${selected.length})`
          }
          footerAction={
            selected.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeAll}
              >
                {language === "ar" ? "مسح الكل" : "Clear"}
              </Button>
            ) : null
          }
        >
          {selected.length === 0 ? (
            <EmptyState>
              {language === "ar"
                ? "لم يتم اختيار أي محافظة"
                : "No governorates assigned yet"}
            </EmptyState>
          ) : (
            <ul className="divide-y">
              {selected.map((g: Governorate) => (
                <li
                  key={g.code}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm">{g.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {g.code}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(g.code)}
                    aria-label={language === "ar" ? "حذف" : "Remove"}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Pane>
      </div>
    </div>
  );
}

function Pane({
  title,
  children,
  footerAction,
}: {
  title: string;
  children: React.ReactNode;
  footerAction?: React.ReactNode;
}) {
  return (
    <div className="flex h-72 flex-col rounded-lg border bg-background">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">{title}</span>
        {footerAction}
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}
