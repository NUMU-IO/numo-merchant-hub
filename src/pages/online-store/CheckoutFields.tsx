import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  GripVertical,
  Loader2,
  Lock,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { showError } from "@/lib/show-error";
import {
  type CheckoutFieldsConfig,
  type CustomFieldSetting,
  type CustomFieldType,
  type IdentityConfig,
  getCheckoutFields,
  updateCheckoutFields,
} from "@/services/checkoutFieldsApi";

// Keep in sync with backend LOCKED_ENABLED in src/core/checkout_fields.py.
// These fields can never be disabled — merchants can only toggle `required`.
const LOCKED_ENABLED = new Set([
  "first_name",
  "phone",
  "address",
  "governorate",
]);

const STANDARD_FIELD_ORDER: string[] = [
  "first_name",
  "last_name",
  "phone",
  "email",
  "governorate",
  "area",
  "address",
  "landmark",
  "notes",
];

const FIELD_LABELS: Record<
  string,
  { en: string; ar: string; hint?: { en: string; ar: string } }
> = {
  first_name: { en: "First name", ar: "الاسم الأول" },
  last_name: { en: "Last name", ar: "اسم العيلة" },
  phone: { en: "Phone number", ar: "رقم الموبايل" },
  email: { en: "Email", ar: "الإيميل" },
  governorate: { en: "Governorate", ar: "المحافظة" },
  area: { en: "Area", ar: "المنطقة" },
  address: { en: "Detailed address", ar: "العنوان بالتفصيل" },
  landmark: { en: "Landmark", ar: "علامة مميزة" },
  notes: { en: "Order notes", ar: "ملاحظات الطلب" },
};

const TYPE_LABELS: Record<CustomFieldType, { en: string; ar: string }> = {
  text: { en: "Short text", ar: "نص قصير" },
  textarea: { en: "Long text", ar: "نص طويل" },
  number: { en: "Number", ar: "رقم" },
  select: { en: "Dropdown", ar: "قائمة اختيارات" },
  checkbox: { en: "Checkbox", ar: "بوكس اختيار" },
};

function newCustomField(position: number): CustomFieldSetting {
  return {
    id: crypto.randomUUID(),
    label: "",
    label_ar: "",
    type: "text",
    required: false,
    placeholder: "",
    options: null,
    position,
  };
}

export default function CheckoutFields() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["checkout-fields", storeId],
    queryFn: () => getCheckoutFields(storeId as string),
    enabled: !!storeId,
  });

  const [config, setConfig] = useState<CheckoutFieldsConfig | null>(null);

  useEffect(() => {
    if (data) setConfig(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (next: CheckoutFieldsConfig) =>
      updateCheckoutFields(storeId as string, next),
    onSuccess: (saved) => {
      setConfig(saved);
      queryClient.invalidateQueries({ queryKey: ["checkout-fields", storeId] });
      toast.success(isAr ? "اتحفظ" : "Saved");
    },
    onError: (err) => showError(err, isAr ? "الحفظ فشل" : "Failed to save"),
  });

  const dirty = useMemo(() => {
    if (!data || !config) return false;
    return JSON.stringify(data) !== JSON.stringify(config);
  }, [data, config]);

  // ── Standard field editors ───────────────────────────────────────
  const setStandard = (
    key: string,
    patch: Partial<{ enabled: boolean; required: boolean }>,
  ) => {
    setConfig((c) => {
      if (!c) return c;
      const current = c.standard_fields[key] ?? {
        enabled: true,
        required: false,
      };
      const next = { ...current, ...patch };
      if (LOCKED_ENABLED.has(key)) next.enabled = true;
      // Required implies enabled — keep the pair coherent.
      if (next.required) next.enabled = true;
      return { ...c, standard_fields: { ...c.standard_fields, [key]: next } };
    });
  };

  // ── Identity (phone verification + save-cart nudge) editors ─────
  const setIdentity = (patch: Partial<IdentityConfig>) => {
    setConfig((c) => {
      if (!c?.identity) return c;
      return { ...c, identity: { ...c.identity, ...patch } };
    });
  };

  // ── Custom field editors ─────────────────────────────────────────
  const addCustom = () => {
    setConfig((c) => {
      if (!c) return c;
      if (c.custom_fields.length >= 10) {
        toast.info(isAr ? "أقصى حاجة ١٠ بيانات" : "10 custom fields max");
        return c;
      }
      return {
        ...c,
        custom_fields: [
          ...c.custom_fields,
          newCustomField(c.custom_fields.length),
        ],
      };
    });
  };

  const updateCustom = (idx: number, patch: Partial<CustomFieldSetting>) => {
    setConfig((c) => {
      if (!c) return c;
      const next = c.custom_fields.map((f, i) =>
        i === idx ? { ...f, ...patch } : f,
      );
      return { ...c, custom_fields: next };
    });
  };

  const removeCustom = (idx: number) => {
    setConfig((c) => {
      if (!c) return c;
      const next = c.custom_fields
        .filter((_, i) => i !== idx)
        .map((f, i) => ({ ...f, position: i }));
      return { ...c, custom_fields: next };
    });
  };

  const moveCustom = (idx: number, dir: -1 | 1) => {
    setConfig((c) => {
      if (!c) return c;
      const target = idx + dir;
      if (target < 0 || target >= c.custom_fields.length) return c;
      const next = [...c.custom_fields];
      [next[idx], next[target]] = [next[target], next[idx]];
      return {
        ...c,
        custom_fields: next.map((f, i) => ({ ...f, position: i })),
      };
    });
  };

  const save = () => {
    if (!config) return;
    for (const f of config.custom_fields) {
      if (!f.label.trim()) {
        toast.error(
          isAr
            ? "كل الحقول الزيادة محتاجة اسم"
            : "Every custom field needs a label",
        );
        return;
      }
      if (f.type === "select" && (!f.options || f.options.length === 0)) {
        toast.error(
          isAr
            ? `ضيف اختيارات للبيان "${f.label}"`
            : `Add options to "${f.label}"`,
        );
        return;
      }
    }
    mutation.mutate(config);
  };

  if (!storeId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {isAr ? "اختار متجر الأول" : "Select a store first"}
      </div>
    );
  }

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/settings"
            className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {isAr ? "الإعدادات" : "Settings"}
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
            {isAr ? "بيانات الدفع" : "Checkout fields"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAr
              ? "اختار المطلوبة من العميل وهو بيشتري وضيف حقول زيادة."
              : "Choose which fields are required at checkout and add your own custom fields."}
          </p>
        </div>
        <Button
          onClick={save}
          disabled={!dirty || mutation.isPending}
          className="gap-2"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isAr ? "إحفظ" : "Save"}
        </Button>
      </div>

      {/* Standard fields */}
      <section className="rounded-xl border">
        <div className="border-b p-4">
          <h2 className="text-sm font-semibold">
            {isAr ? "البيانات الأساسية" : "Standard fields"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isAr
              ? "اختار إيه اللي يظهر للعميل وإيه اللي إجباري."
              : "Choose what shows to the customer and what's required."}
          </p>
        </div>
        <div className="divide-y">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-6 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <span>{isAr ? "البيان" : "Field"}</span>
            <span className="w-16 text-center">{isAr ? "باين" : "Shown"}</span>
            <span className="w-16 text-center">
              {isAr ? "إجباري" : "Required"}
            </span>
          </div>
          {STANDARD_FIELD_ORDER.map((key) => {
            const setting = config.standard_fields[key] ?? {
              enabled: true,
              required: false,
            };
            const locked = LOCKED_ENABLED.has(key);
            const meta = FIELD_LABELS[key];
            return (
              <div
                key={key}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-6 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm">
                    {isAr ? meta.ar : meta.en}
                    {locked && (
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  {meta.hint && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {isAr ? meta.hint.ar : meta.hint.en}
                    </p>
                  )}
                </div>
                <div className="flex w-16 justify-center">
                  <Switch
                    checked={setting.enabled}
                    disabled={locked}
                    onCheckedChange={(v) => setStandard(key, { enabled: v })}
                  />
                </div>
                <div className="flex w-16 justify-center">
                  <Switch
                    checked={setting.required}
                    disabled={!setting.enabled && !locked}
                    onCheckedChange={(v) => setStandard(key, { required: v })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Customer verification (phone-first identity) — only rendered when
          the backend returned the block (older backends omit it). */}
      {config.identity && (
        <section className="rounded-xl border">
          <div className="border-b p-4">
            <h2 className="text-sm font-semibold">
              {isAr ? "تأكيد هوية العميل" : "Customer verification"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isAr
                ? "تأكيد رقم الموبايل بكود واتساب قبل إتمام الطلب — بيقلل الطلبات الوهمية وبيخلي السلات المتسابة قابلة للاسترجاع."
                : "Verify the customer's phone with a WhatsApp code before they can place an order — cuts fake COD orders and makes abandoned carts recoverable."}
            </p>
          </div>
          <div className="divide-y">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm">
                  {isAr ? "طلب تأكيد الرقم عند الدفع" : "Require phone verification at checkout"}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {isAr
                    ? "العميل لازم يأكد رقمه بكود واتساب قبل ما يأكد الطلب."
                    : "The customer must verify via a WhatsApp code before submitting the order."}
                </p>
              </div>
              <Switch
                checked={config.identity.require_verification}
                onCheckedChange={(v) => setIdentity({ require_verification: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm">
                  {isAr ? "رسالة «احفظ سلتك»" : '"Save your cart" prompt'}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {isAr
                    ? "بنطلب رقم الواتساب أثناء التسوق عشان نقدر نرجّع العميل لو ساب السلة."
                    : "Ask for the WhatsApp number mid-shopping so you can win back shoppers who leave their cart."}
                </p>
              </div>
              <Switch
                checked={config.identity.nudge_enabled}
                onCheckedChange={(v) => setIdentity({ nudge_enabled: v })}
              />
            </div>
            {config.identity.nudge_enabled && (
              <div className="grid grid-cols-1 gap-4 px-4 py-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs">
                    {isAr ? "أقل عدد منتجات" : "Min items in cart"}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    className="mt-1"
                    value={config.identity.nudge_min_items}
                    onChange={(e) =>
                      setIdentity({
                        nudge_min_items: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">
                    {isAr ? "أقل قيمة للسلة (جنيه)" : "Min cart value (EGP)"}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    className="mt-1"
                    value={Math.round(config.identity.nudge_min_value_cents / 100)}
                    onChange={(e) =>
                      setIdentity({
                        nudge_min_value_cents:
                          Math.max(0, Number(e.target.value) || 0) * 100,
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">
                    {isAr ? "التأخير (ثواني)" : "Delay (seconds)"}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={3600}
                    className="mt-1"
                    value={config.identity.nudge_delay_seconds}
                    onChange={(e) =>
                      setIdentity({
                        nudge_delay_seconds: Math.min(
                          3600,
                          Math.max(0, Number(e.target.value) || 0),
                        ),
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Custom fields */}
      <section className="rounded-xl border">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-sm font-semibold">
              {isAr ? "بيانات زيادة" : "Custom fields"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isAr
                ? "لحد ١٠ بيانات زيادة، وبتتحفظ مع الطلب."
                : "Up to 10 extra fields, stored on each order."}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={addCustom}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {isAr ? "ضيف بيان" : "Add field"}
          </Button>
        </div>

        {config.custom_fields.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {isAr ? "لسه مضفتش أي بيانات زيادة." : "No custom fields yet."}
          </p>
        ) : (
          <div className="divide-y">
            {config.custom_fields.map((f, idx) => (
              <div key={f.id ?? idx} className="grid gap-3 p-4">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col items-center pt-1 text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => moveCustom(idx, -1)}
                      disabled={idx === 0}
                      className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">
                        {isAr ? "الاسم (إنجليزي)" : "Label"}
                      </Label>
                      <Input
                        value={f.label}
                        maxLength={80}
                        onChange={(e) =>
                          updateCustom(idx, { label: e.target.value })
                        }
                        placeholder={
                          isAr ? "مثال: ملاحظة للسائق" : "e.g., Note to driver"
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">
                        {isAr ? "الاسم (عربي)" : "Label (Arabic)"}
                      </Label>
                      <Input
                        value={f.label_ar ?? ""}
                        maxLength={80}
                        onChange={(e) =>
                          updateCustom(idx, { label_ar: e.target.value })
                        }
                        dir="rtl"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">
                        {isAr ? "النوع" : "Type"}
                      </Label>
                      <Select
                        value={f.type}
                        onValueChange={(v) =>
                          updateCustom(idx, {
                            type: v as CustomFieldType,
                            options: v === "select" ? (f.options ?? []) : null,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(TYPE_LABELS) as CustomFieldType[]).map(
                            (t) => (
                              <SelectItem key={t} value={t}>
                                {isAr ? TYPE_LABELS[t].ar : TYPE_LABELS[t].en}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">
                        {isAr ? "تلميح داخل الحقل" : "Placeholder"}
                      </Label>
                      <Input
                        value={f.placeholder ?? ""}
                        maxLength={120}
                        onChange={(e) =>
                          updateCustom(idx, { placeholder: e.target.value })
                        }
                      />
                    </div>
                    {f.type === "select" && (
                      <div className="sm:col-span-2">
                        <Label className="text-xs">
                          {isAr
                            ? "الخيارات (كل سطر خيار)"
                            : "Options (one per line)"}
                        </Label>
                        <textarea
                          value={(f.options ?? []).join("\n")}
                          onChange={(e) =>
                            updateCustom(idx, {
                              options: e.target.value
                                .split("\n")
                                .map((o) => o.trim())
                                .filter(Boolean)
                                .slice(0, 20),
                            })
                          }
                          rows={Math.min(
                            6,
                            Math.max(3, (f.options ?? []).length + 1),
                          )}
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                          placeholder={
                            isAr ? "صباحًا\nبعد الظهر" : "Morning\nAfternoon"
                          }
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => removeCustom(idx)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pl-6 pt-1">
                  <span className="text-xs text-muted-foreground">
                    {isAr ? "إجباري" : "Required"}
                  </span>
                  <Switch
                    checked={f.required}
                    onCheckedChange={(v) => updateCustom(idx, { required: v })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
