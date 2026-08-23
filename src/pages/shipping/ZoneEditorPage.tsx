/**
 * Zone editor page.
 *
 * `/shipping/zones/new`          → create mode (empty form)
 * `/shipping/zones/:zoneId`      → edit mode (hydrated from API)
 *
 * Three sections per the design doc:
 *   A. Identity — name(s), ETA, COD toggle + fee
 *   B. Coverage — governorate picker (two-pane)
 *   C. Rates    — rate cards (stacked, one per rate)
 *
 * On save:
 *   - Create: POST zone → POST rates sequentially (backend needs
 *     zone_id first).
 *   - Edit:  PATCH zone + diff of rates (create new, update existing,
 *     soft-delete removed). Kept simple here: we PATCH zone always,
 *     and for rates we sequence `create`/`update`/`delete` as needed.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { GovernoratePicker } from "@/components/shipping/GovernoratePicker";
import {
  RateCardEditor,
  type RateDraft,
} from "@/components/shipping/RateCardEditor";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  useCreateShippingRate,
  useCreateShippingZone,
  useDeleteShippingRate,
  useShippingZone,
  useUpdateShippingRate,
  useUpdateShippingZone,
} from "@/hooks/useShippingZones";
import type {
  RateConfig,
  ShippingRate,
} from "@/services/shippingApi";

function newDraftRate(): RateDraft {
  return {
    label: "Standard",
    label_ar: null,
    rate_type: "flat",
    config: { type: "flat", amount_cents: 5000 },
    is_active: true,
    sort_order: 0,
  };
}

function rateToDraft(r: ShippingRate): RateDraft {
  // Hydrate the discriminator into the config for the editor.
  const raw = { ...(r.config || {}), type: r.rate_type } as unknown as RateConfig;
  return {
    id: r.id,
    label: r.label,
    label_ar: r.label_ar,
    rate_type: r.rate_type,
    config: raw,
    is_active: r.is_active,
    sort_order: r.sort_order,
  };
}

function useCurrency(): string {
  const { currentStore } = useDashboardStore();
  type StoreWithCurrency = { currency?: string | null; default_currency?: string | null };
  const s = (currentStore ?? {}) as StoreWithCurrency;
  return s.currency ?? s.default_currency ?? "EGP";
}

export default function ZoneEditorPage() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const navigate = useNavigate();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const currency = useCurrency();

  const params = useParams<{ zoneId?: string }>();
  const isNew = !params.zoneId || params.zoneId === "new";
  const zoneId = isNew ? undefined : params.zoneId;

  const { data: zone, isLoading: isLoadingZone } = useShippingZone(storeId, zoneId);

  // ─── Local form state ──────────────────────────────────────────────
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [etaMin, setEtaMin] = useState(2);
  const [etaMax, setEtaMax] = useState(5);
  const [isActive, setIsActive] = useState(true);
  const [codEnabled, setCodEnabled] = useState(true);
  const [codFee, setCodFee] = useState(0);
  const [govCodes, setGovCodes] = useState<string[]>([]);
  const [rateDrafts, setRateDrafts] = useState<RateDraft[]>([newDraftRate()]);
  const [deletedRateIds, setDeletedRateIds] = useState<string[]>([]);

  // Hydrate form when an existing zone loads.
  useEffect(() => {
    if (!zone) return;
    setName(zone.name);
    setNameAr(zone.name_ar ?? "");
    setEtaMin(zone.estimated_days_min);
    setEtaMax(zone.estimated_days_max);
    setIsActive(zone.is_active);
    setCodEnabled(zone.cod_enabled);
    setCodFee(zone.cod_fee_cents);
    setGovCodes([...zone.governorate_codes]);
    setRateDrafts(
      zone.rates.length > 0 ? zone.rates.map(rateToDraft) : [newDraftRate()],
    );
    setDeletedRateIds([]);
  }, [zone]);

  // ─── Mutations ────────────────────────────────────────────────────
  const createZone = useCreateShippingZone(storeId);
  const updateZone = useUpdateShippingZone(storeId, zoneId);
  const createRate = useCreateShippingRate(storeId, zoneId);
  const updateRate = useUpdateShippingRate(storeId, zoneId);
  const deleteRate = useDeleteShippingRate(storeId, zoneId);

  // ─── Validation ───────────────────────────────────────────────────
  const errors = useMemo(() => {
    const e: string[] = [];
    if (!name.trim()) e.push(ar ? "الاسم مطلوب" : "Name is required");
    if (etaMax < etaMin)
      e.push(ar ? "وقت التسليم غير صحيح" : "ETA max must be ≥ min");
    if (govCodes.length === 0)
      e.push(ar ? "اختر محافظة واحدة على الأقل" : "Add at least one governorate");
    if (rateDrafts.filter((r) => r.is_active).length === 0)
      e.push(ar ? "أضف سعر واحد على الأقل" : "Add at least one active rate");
    rateDrafts.forEach((r, i) => {
      if (!r.label.trim())
        e.push(
          ar
            ? `السعر رقم ${i + 1}: الاسم مطلوب`
            : `Rate ${i + 1}: label is required`,
        );
    });
    return e;
  }, [ar, name, etaMin, etaMax, govCodes, rateDrafts]);

  const isSaving =
    createZone.isPending ||
    updateZone.isPending ||
    createRate.isPending ||
    updateRate.isPending ||
    deleteRate.isPending;

  // ─── Save ─────────────────────────────────────────────────────────
  async function handleSave() {
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    try {
      let currentZoneId = zoneId;
      if (isNew) {
        const created = await createZone.mutateAsync({
          name,
          name_ar: nameAr.trim() === "" ? null : nameAr,
          governorate_codes: govCodes,
          estimated_days_min: etaMin,
          estimated_days_max: etaMax,
          cod_enabled: codEnabled,
          cod_fee_cents: codFee,
          is_active: isActive,
        });
        currentZoneId = created.id;
      } else {
        await updateZone.mutateAsync({
          name,
          name_ar: nameAr.trim() === "" ? null : nameAr,
          governorate_codes: govCodes,
          estimated_days_min: etaMin,
          estimated_days_max: etaMax,
          cod_enabled: codEnabled,
          cod_fee_cents: codFee,
          is_active: isActive,
        });
      }

      // Rates: sequence create / update / delete. Per-call error propagates.
      for (const id of deletedRateIds) {
        await deleteRate.mutateAsync(id);
      }
      for (const r of rateDrafts) {
        // Ensure the discriminator matches rate_type; backend strips
        // `type` from the payload on write (it lives in its own column).
        const body = {
          label: r.label,
          label_ar: r.label_ar,
          config: { ...r.config, type: r.rate_type } as RateConfig,
          is_active: r.is_active,
          sort_order: r.sort_order,
        };
        if (r.id) {
          await updateRate.mutateAsync({ rateId: r.id, body });
        } else {
          // On new-zone path, `useCreateShippingRate(storeId, zoneId)` was
          // bound to the previous (undefined) zoneId; call the API directly.
          const { createShippingRate } = await import("@/services/shippingApi");
          await createShippingRate(storeId!, currentZoneId!, body);
        }
      }

      toast.success(ar ? "تم الحفظ" : "Saved");
      navigate("/shipping/zones");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error(message);
    }
  }

  if (!storeId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {ar ? "اختر متجرًا أولًا" : "Select a store first"}
      </div>
    );
  }
  if (!isNew && isLoadingZone) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link to="/shipping/zones">
              <ArrowLeft className="mr-1 h-4 w-4" />
              {ar ? "العودة" : "Back"}
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isNew
              ? ar
                ? "منطقة شحن جديدة"
                : "New shipping zone"
              : ar
              ? "تعديل منطقة الشحن"
              : "Edit shipping zone"}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1 h-4 w-4" />
          )}
          {ar ? "حفظ" : "Save"}
        </Button>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          <ul className="list-disc space-y-0.5 ps-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* A. Identity */}
      <Card>
        <CardHeader>
          <CardTitle>{ar ? "الهوية" : "Identity"}</CardTitle>
          <CardDescription>
            {ar ? "اسم المنطقة وإعداداتها الأساسية" : "Zone name and base settings"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">
                {ar ? "الاسم (إنجليزي) *" : "Name (English) *"}
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Greater Cairo"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">
                {ar ? "الاسم (عربي)" : "Name (Arabic)"}
              </Label>
              <Input
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="القاهرة الكبرى"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="mb-1 block text-xs">
                {ar ? "الحد الأدنى للتسليم (أيام)" : "ETA min (days)"}
              </Label>
              <Input
                type="number"
                min={0}
                max={365}
                value={etaMin}
                onChange={(e) => setEtaMin(Number(e.target.value || 0))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">
                {ar ? "الحد الأقصى للتسليم (أيام)" : "ETA max (days)"}
              </Label>
              <Input
                type="number"
                min={0}
                max={365}
                value={etaMax}
                onChange={(e) => setEtaMax(Number(e.target.value || 0))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">
                {ar ? "الترتيب" : "Sort order"}
              </Label>
              <Input
                type="number"
                min={0}
                value={0}
                readOnly
                disabled
                aria-label={ar ? "اسحب للترتيب في الجدول" : "Drag to reorder in table"}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                aria-label={ar ? "مفعّلة" : "Active"}
              />
              <Label className="text-sm">{ar ? "المنطقة مفعّلة" : "Zone is active"}</Label>
              {!isActive && (
                <Badge variant="outline" className="text-xs">
                  {ar ? "معطّلة" : "Disabled"}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={codEnabled}
                onCheckedChange={setCodEnabled}
                aria-label={ar ? "الدفع عند الاستلام" : "Cash on delivery"}
              />
              <Label className="text-sm">
                {ar ? "السماح بالدفع عند الاستلام" : "Allow cash on delivery"}
              </Label>
            </div>
            {codEnabled && (
              <div className="flex items-end gap-2">
                <div>
                  <Label className="mb-1 block text-xs">
                    {ar ? `رسوم الدفع عند الاستلام (${currency})` : `COD fee (${currency})`}
                  </Label>
                  <MoneyInput
                    cents={codFee}
                    onChangeCents={setCodFee}
                    currency={currency}
                    className="w-36"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* B. Coverage */}
      <Card>
        <CardHeader>
          <CardTitle>
            {ar
              ? `التغطية (${govCodes.length}/27)`
              : `Coverage (${govCodes.length}/27)`}
          </CardTitle>
          <CardDescription>
            {ar
              ? "اختر المحافظات التي تغطيها هذه المنطقة."
              : "Choose the governorates this zone covers."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GovernoratePicker
            storeId={storeId}
            selectedCodes={govCodes}
            onChange={setGovCodes}
            currentZoneId={zoneId}
          />
        </CardContent>
      </Card>

      {/* C. Rates */}
      <Card>
        <CardHeader>
          <CardTitle>{ar ? "الأسعار" : "Rates"}</CardTitle>
          <CardDescription>
            {ar
              ? "أضف سعرًا أو أكثر — كل سعر يظهر كخيار عند الدفع (مثل قياسي + سريع)."
              : "Add one or more rates — each appears as a checkout option (e.g. Standard + Express)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rateDrafts.map((draft, i) => (
            <RateCardEditor
              key={draft.id ?? `draft-${i}`}
              draft={draft}
              currency={currency}
              onChange={(next) =>
                setRateDrafts((list) => list.map((d, idx) => (idx === i ? next : d)))
              }
              onRemove={
                rateDrafts.length > 1
                  ? () => {
                      const removed = rateDrafts[i];
                      if (removed.id) {
                        setDeletedRateIds((prev) => [...prev, removed.id!]);
                      }
                      setRateDrafts((list) => list.filter((_, idx) => idx !== i));
                    }
                  : undefined
              }
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setRateDrafts((list) => [
                ...list,
                { ...newDraftRate(), label: "Express", sort_order: list.length },
              ])
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            {ar ? "إضافة سعر آخر" : "Add another rate"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
