/**
 * Rate card editor — one card per rate, with type selector and
 * per-type form fields.
 *
 * Controlled component: parent holds an array of rate drafts and
 * re-renders on every change. Validation is best-effort here (min
 * amounts, sorted bands on save); backend is the authority.
 *
 * Rate types supported in MVP:
 *   - flat              → one amount field
 *   - free_over         → amount + threshold with live preview
 *   - weight_band       → editable band table + optional per-extra-kg
 *   - carrier_api       → schema-only; not wired in MVP (hidden from type menu)
 */

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import type {
  RateConfig,
  RateConfigFlat,
  RateConfigFreeOver,
  RateConfigWeightBand,
  RateType,
  WeightBand,
} from "@/services/shippingApi";

/**
 * Working shape in the editor. Mirrors `ShippingRate` but without a
 * persisted `id` for draft rates. Persisted rates carry `id: string`;
 * new ones use `undefined` and the page knows to POST instead of PATCH.
 */
export interface RateDraft {
  id?: string;
  label: string;
  label_ar: string | null;
  rate_type: RateType;
  config: RateConfig;
  is_active: boolean;
  sort_order: number;
}

interface Props {
  draft: RateDraft;
  onChange: (next: RateDraft) => void;
  onRemove?: () => void;
  /** Currency code used for live previews (e.g. "EGP"). */
  currency?: string;
}

const MVP_TYPES: { value: RateType; en: string; ar: string }[] = [
  { value: "flat", en: "Flat rate", ar: "سعر ثابت" },
  { value: "free_over", en: "Free over threshold", ar: "شحن مجاني فوق مبلغ" },
  { value: "weight_band", en: "Weight bands", ar: "حسب الوزن" },
];

/**
 * When the merchant switches rate_type, rebuild the config with a
 * sensible default so downstream form inputs have something to bind to.
 */
function defaultConfigFor(type: RateType): RateConfig {
  switch (type) {
    case "flat":
      return { type: "flat", amount_cents: 5000 };
    case "free_over":
      return {
        type: "free_over",
        amount_cents: 5000,
        free_when_subtotal_gte_cents: 50000,
      };
    case "weight_band":
      return {
        type: "weight_band",
        bands: [
          { max_weight_g: 3000, amount_cents: 5000 },
          { max_weight_g: null, amount_cents: 7000, per_extra_kg_cents: 1000 },
        ],
      };
    case "carrier_api":
      return { type: "carrier_api", carrier: "bosta", service_code: "STANDARD" };
  }
}

export function RateCardEditor({ draft, onChange, onRemove, currency = "EGP" }: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";

  function updateType(next: RateType) {
    onChange({
      ...draft,
      rate_type: next,
      config: defaultConfigFor(next),
    });
  }

  function updateConfig(patch: Partial<RateConfig>) {
    onChange({
      ...draft,
      // Partial patch merged into the typed config — validated by the
      // backend Pydantic model on save. TS can't statically prove the
      // merged shape stays within the discriminated union, so we route
      // through `unknown`.
      config: {
        ...(draft.config as unknown as Record<string, unknown>),
        ...patch,
      } as unknown as RateConfig,
    });
  }

  return (
    <div className="space-y-3 rounded-lg border bg-background p-4">
      {/* Header row: active toggle + label(s) + remove */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={draft.is_active}
            onCheckedChange={(v) => onChange({ ...draft, is_active: v })}
            aria-label={ar ? "تفعيل" : "Active"}
          />
          <Label className="text-xs">{ar ? "مفعّلة" : "Active"}</Label>
        </div>
        <div className="min-w-[10rem] flex-1">
          <Label className="mb-1 block text-xs">
            {ar ? "الاسم (إنجليزي)" : "Label (English)"}
          </Label>
          <Input
            value={draft.label}
            onChange={(e) => onChange({ ...draft, label: e.target.value })}
            placeholder="Standard"
          />
        </div>
        <div className="min-w-[10rem] flex-1">
          <Label className="mb-1 block text-xs">
            {ar ? "الاسم (عربي)" : "Label (Arabic)"}
          </Label>
          <Input
            value={draft.label_ar ?? ""}
            onChange={(e) =>
              onChange({
                ...draft,
                label_ar: e.target.value.trim() === "" ? null : e.target.value,
              })
            }
            placeholder="قياسي"
          />
        </div>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            aria-label={ar ? "حذف" : "Remove"}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Type switcher */}
      <div>
        <Label className="mb-1 block text-xs">
          {ar ? "نوع السعر" : "Rate type"}
        </Label>
        <Select value={draft.rate_type} onValueChange={(v) => updateType(v as RateType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MVP_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {ar ? t.ar : t.en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Per-type fields */}
      {draft.rate_type === "flat" && (
        <FlatFields
          config={draft.config as RateConfigFlat}
          currency={currency}
          onPatch={updateConfig}
        />
      )}
      {draft.rate_type === "free_over" && (
        <FreeOverFields
          config={draft.config as RateConfigFreeOver}
          currency={currency}
          onPatch={updateConfig}
        />
      )}
      {draft.rate_type === "weight_band" && (
        <WeightBandFields
          config={draft.config as RateConfigWeightBand}
          currency={currency}
          onPatch={updateConfig}
        />
      )}
    </div>
  );
}

// ─── Per-type sub-forms ─────────────────────────────────────────────

function FlatFields({
  config,
  currency,
  onPatch,
}: {
  config: RateConfigFlat;
  currency: string;
  onPatch: (patch: Partial<RateConfig>) => void;
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  return (
    <div>
      <Label className="mb-1 block text-xs">
        {ar ? `المبلغ (${currency})` : `Amount (${currency})`}
      </Label>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={(config.amount_cents / 100).toFixed(2)}
        onChange={(e) =>
          onPatch({ amount_cents: Math.round(Number(e.target.value || 0) * 100) })
        }
      />
    </div>
  );
}

function FreeOverFields({
  config,
  currency,
  onPatch,
}: {
  config: RateConfigFreeOver;
  currency: string;
  onPatch: (patch: Partial<RateConfig>) => void;
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const thresholdMajor = (config.free_when_subtotal_gte_cents / 100).toFixed(2);
  const amountMajor = (config.amount_cents / 100).toFixed(2);
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1 block text-xs">
            {ar ? `الشحن تحت الحد (${currency})` : `Shipping below threshold (${currency})`}
          </Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={amountMajor}
            onChange={(e) =>
              onPatch({ amount_cents: Math.round(Number(e.target.value || 0) * 100) })
            }
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs">
            {ar ? `حد الشحن المجاني (${currency})` : `Free-shipping threshold (${currency})`}
          </Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={thresholdMajor}
            onChange={(e) =>
              onPatch({
                free_when_subtotal_gte_cents: Math.round(
                  Number(e.target.value || 0) * 100,
                ),
              })
            }
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {ar
          ? `العملاء الذين ينفقون ${thresholdMajor} ${currency} أو أكثر يحصلون على شحن مجاني.`
          : `Customers spending ≥ ${thresholdMajor} ${currency} get free shipping.`}
      </p>
    </div>
  );
}

function WeightBandFields({
  config,
  currency,
  onPatch,
}: {
  config: RateConfigWeightBand;
  currency: string;
  onPatch: (patch: Partial<RateConfig>) => void;
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const bands = useMemo(() => config.bands ?? [], [config.bands]);

  function setBand(index: number, next: WeightBand) {
    const copy = [...bands];
    copy[index] = next;
    onPatch({ bands: copy } as Partial<RateConfigWeightBand>);
  }
  function addBand() {
    const last = bands[bands.length - 1];
    const proposedMax =
      last && typeof last.max_weight_g === "number" ? last.max_weight_g + 2000 : 5000;
    onPatch({
      bands: [...bands, { max_weight_g: proposedMax, amount_cents: 5000 }],
    } as Partial<RateConfigWeightBand>);
  }
  function removeBand(index: number) {
    onPatch({ bands: bands.filter((_, i) => i !== index) } as Partial<RateConfigWeightBand>);
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1 text-start">
                {ar ? "الحد الأقصى للوزن (كجم)" : "Max weight (kg)"}
              </th>
              <th className="py-1 text-start">
                {ar ? `السعر (${currency})` : `Price (${currency})`}
              </th>
              <th className="py-1 text-start">
                {ar ? "إضافة لكل كجم زائد" : "Per extra kg"}
              </th>
              <th className="py-1">
                <span className="sr-only">
                  {ar ? "إجراءات" : "Actions"}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {bands.map((b, i) => {
              const isOpenEnded = b.max_weight_g === null;
              return (
                <tr key={i} className="border-t">
                  <td className="py-1 pr-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.1"
                        disabled={isOpenEnded}
                        value={
                          b.max_weight_g === null ? "" : (b.max_weight_g / 1000).toFixed(1)
                        }
                        onChange={(e) =>
                          setBand(i, {
                            ...b,
                            max_weight_g: Math.round(
                              Number(e.target.value || 0) * 1000,
                            ),
                          })
                        }
                        placeholder={isOpenEnded ? (ar ? "مفتوح" : "Open-ended") : undefined}
                        className="h-8 w-24"
                      />
                      <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={isOpenEnded}
                          onChange={(e) =>
                            setBand(i, {
                              ...b,
                              max_weight_g: e.target.checked ? null : 5000,
                              per_extra_kg_cents: e.target.checked
                                ? b.per_extra_kg_cents ?? 0
                                : null,
                            })
                          }
                        />
                        {ar ? "مفتوح" : "∞"}
                      </label>
                    </div>
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={(b.amount_cents / 100).toFixed(2)}
                      onChange={(e) =>
                        setBand(i, {
                          ...b,
                          amount_cents: Math.round(Number(e.target.value || 0) * 100),
                        })
                      }
                      className="h-8 w-24"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    {isOpenEnded ? (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={((b.per_extra_kg_cents ?? 0) / 100).toFixed(2)}
                        onChange={(e) =>
                          setBand(i, {
                            ...b,
                            per_extra_kg_cents: Math.round(
                              Number(e.target.value || 0) * 100,
                            ),
                          })
                        }
                        className="h-8 w-24"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-1">
                    {bands.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeBand(i)}
                        aria-label={ar ? "حذف" : "Remove"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addBand}>
        <Plus className="mr-1 h-4 w-4" /> {ar ? "إضافة شريحة" : "Add band"}
      </Button>
      <p className="text-xs text-muted-foreground">
        {ar
          ? "يتم التقييم بأول شريحة مطابقة. اترك الشريحة الأخيرة مفتوحة لتغطية الأوزان الكبيرة."
          : "First matching band wins. Leave the final band open-ended to cover heavier orders."}
      </p>
    </div>
  );
}
