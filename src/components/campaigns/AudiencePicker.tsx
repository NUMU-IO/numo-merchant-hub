/**
 * Recipient/audience picker for the marketing campaign Create dialog.
 *
 * Two layers:
 *   1. Preset chips — All opted-in / High value / Recent buyers / Lapsed
 *      / New customers. Picking one immediately updates the count.
 *   2. Advanced filter accordion — explicit fields (min spend, days
 *      since last order, tag-match, marketing-consent override). Values
 *      typed here override the preset's defaults (e.g. pick "Lapsed"
 *      then bump `inactive_days` to 120).
 *
 * Live recipient count is fetched from the backend's
 * `/marketing/campaigns/audience/estimate` endpoint with a 400ms debounce
 * — the merchant sees "Will send to ~N recipients" before clicking
 * Save / Send.
 *
 * The picker is fully controlled — the parent dialog owns the filter
 * state so it can include it in the `createCampaign` POST.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  estimateAudience,
  type AudienceFilter,
  type AudiencePresetKey,
  type CampaignChannel,
} from "@/services/campaignApi";

const PRESETS: {
  key: AudiencePresetKey;
  label: { en: string; ar: string };
  hint: { en: string; ar: string };
}[] = [
  {
    key: "all_opted_in",
    label: { en: "All opted-in", ar: "كل من وافقوا" },
    hint: { en: "Everyone with marketing consent", ar: "كل من يقبلون التسويق" },
  },
  {
    key: "high_value",
    label: { en: "High value", ar: "عملاء مميّزون" },
    hint: { en: "Spent EGP 5,000+ lifetime", ar: "أنفقوا 5,000 ج+" },
  },
  {
    key: "recent_buyers",
    label: { en: "Recent buyers", ar: "اشتروا مؤخراً" },
    hint: { en: "Ordered in last 30 days", ar: "طلب في آخر 30 يوم" },
  },
  {
    key: "lapsed",
    label: { en: "Lapsed", ar: "متوقفون" },
    hint: { en: "Bought once, inactive 90d+", ar: "اشتروا واختفوا 90 يوم+" },
  },
  {
    key: "new_customers",
    label: { en: "New customers", ar: "عملاء جدد" },
    hint: { en: "Joined in last 30 days", ar: "انضموا في آخر 30 يوم" },
  },
];

interface AudiencePickerProps {
  storeId: string;
  channel: CampaignChannel;
  isAr: boolean;
  value: AudienceFilter | null;
  onChange: (next: AudienceFilter | null) => void;
}

export function AudiencePicker({
  storeId,
  channel,
  isAr,
  value,
  onChange,
}: AudiencePickerProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filter = useMemo<AudienceFilter>(() => value ?? {}, [value]);

  // ── Live estimate with debounce ────────────────────────────────────
  // Re-fire whenever the filter or channel changes. 400ms feels right —
  // typing a number keeps the count quiet until the merchant pauses,
  // and preset chip clicks update in under half a second.
  useEffect(() => {
    if (!storeId) return;
    setError(null);
    const handle = setTimeout(async () => {
      setEstimating(true);
      try {
        const res = await estimateAudience(storeId, channel, filter);
        setCount(res.estimated_count);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to estimate");
        setCount(null);
      } finally {
        setEstimating(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [storeId, channel, filter]);

  // ── Field helpers ──────────────────────────────────────────────────
  const setField = <K extends keyof AudienceFilter>(
    key: K,
    val: AudienceFilter[K],
  ) => {
    const next: AudienceFilter = { ...filter, [key]: val };
    // Empty strings → null so the backend doesn't think we set "" as a filter
    if (val === "" || val === undefined) {
      delete (next as Record<string, unknown>)[key];
    }
    onChange(Object.keys(next).length === 0 ? null : next);
  };

  const setPreset = (preset: AudiencePresetKey | null) => {
    if (preset === null) {
      onChange(null);
      return;
    }
    // Preset replaces the field overrides so picking a chip after typing
    // custom values gives a predictable result. Merchant can re-open
    // Advanced to layer overrides on top.
    onChange({ preset });
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {isAr ? "المستلمون" : "Recipients"}
        </Label>
        {/* Live count — the whole reason this picker exists. */}
        <div className="flex items-center gap-1.5 text-xs">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          {estimating ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : error ? (
            <span className="text-destructive">
              {isAr ? "تعذّر الحساب" : "Estimate failed"}
            </span>
          ) : count !== null ? (
            <span className="font-medium tabular-nums">
              {isAr
                ? `سيُرسل لـ ${count.toLocaleString("ar-EG")}`
                : `Will send to ${count.toLocaleString()}`}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      </div>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => {
          const active = filter.preset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setPreset(active ? null : p.key)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-foreground/40",
              )}
              title={isAr ? p.hint.ar : p.hint.en}
            >
              {isAr ? p.label.ar : p.label.en}
            </button>
          );
        })}
      </div>

      {/* Advanced toggle */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => setAdvancedOpen((o) => !o)}
      >
        {advancedOpen ? (
          <ChevronUp className="me-1 h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="me-1 h-3.5 w-3.5" />
        )}
        {isAr ? "فلاتر متقدمة" : "Advanced filters"}
        {hasOverrides(filter) && (
          <Badge variant="secondary" className="ms-2 h-4 px-1.5 text-[10px]">
            {overrideCount(filter)}
          </Badge>
        )}
      </Button>

      {advancedOpen && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <FieldRow
            label={isAr ? "اشتروا خلال (يوم)" : "Ordered within (days)"}
            value={filter.ordered_within_days ?? ""}
            onChange={(v) =>
              setField("ordered_within_days", v ? Number(v) : null)
            }
            placeholder="30"
          />
          <FieldRow
            label={isAr ? "غير نشط منذ (يوم)" : "Inactive since (days)"}
            value={filter.inactive_days ?? ""}
            onChange={(v) => setField("inactive_days", v ? Number(v) : null)}
            placeholder="90"
          />
          <FieldRow
            label={isAr ? "إنفاق أكثر من (ج)" : "Total spent over (EGP)"}
            value={
              filter.min_total_spent_cents
                ? Math.floor(filter.min_total_spent_cents / 100)
                : ""
            }
            onChange={(v) =>
              setField(
                "min_total_spent_cents",
                v ? Number(v) * 100 : null,
              )
            }
            placeholder="5000"
          />
          <FieldRow
            label={isAr ? "عدد طلبات أكثر من" : "Order count over"}
            value={filter.min_total_orders ?? ""}
            onChange={(v) => setField("min_total_orders", v ? Number(v) : null)}
            placeholder="3"
          />
          <FieldRow
            label={
              isAr ? "انضموا خلال (يوم)" : "Joined within (days)"
            }
            value={filter.created_within_days ?? ""}
            onChange={(v) =>
              setField("created_within_days", v ? Number(v) : null)
            }
            placeholder="30"
          />
          <div className="space-y-1">
            <Label className="text-[11px]">
              {isAr ? "وسوم (مفصولة بفاصلة)" : "Tags (comma-separated)"}
            </Label>
            <Input
              className="h-8 text-xs"
              value={(filter.tags_any ?? []).join(", ")}
              onChange={(e) => {
                const tags = e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean);
                setField("tags_any", tags.length ? tags : null);
              }}
              placeholder="vip, wholesale"
            />
          </div>
          <div className="col-span-1 flex items-center justify-between rounded border bg-background p-2 sm:col-span-2">
            <div className="space-y-0.5">
              <Label className="text-xs">
                {isAr
                  ? "اقتصر على من قبلوا التسويق"
                  : "Only customers who accepted marketing"}
              </Label>
              <p className="text-[10px] text-muted-foreground">
                {isAr
                  ? "أوقف هذا فقط لرسائل إدارية داخلية — مطلب قانوني للحملات التسويقية."
                  : "Off only for internal admin sends — legal requirement for marketing broadcasts."}
              </p>
            </div>
            <Switch
              checked={filter.accepts_marketing ?? true}
              onCheckedChange={(v) => setField("accepts_marketing", v)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Input
        type="number"
        min={0}
        className="h-8 text-xs"
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function hasOverrides(f: AudienceFilter): boolean {
  return overrideCount(f) > 0;
}

function overrideCount(f: AudienceFilter): number {
  let n = 0;
  if (f.ordered_within_days) n++;
  if (f.inactive_days) n++;
  if (f.created_within_days) n++;
  if (f.min_total_spent_cents) n++;
  if (f.max_total_spent_cents) n++;
  if (f.min_total_orders) n++;
  if (f.max_total_orders) n++;
  if (f.tags_any && f.tags_any.length) n++;
  if (f.accepts_marketing === false) n++;
  return n;
}
