/**
 * Wave 2/3 Meta Tracking — advanced settings sections.
 *
 * Mounted under the main MetaTrackingPanel as four collapsible cards.
 * Each section is self-contained: holds its own draft state, calls
 * ``onSave`` with the partial settings update when the merchant clicks
 * Save inside that card. The parent panel keeps its existing save
 * pipeline; this component is purely additive UI.
 *
 *   * Wave 2 Phase 12 — COD-aware Purchase/Lead trigger timing
 *   * Wave 2 Phase 13 — Multi-pixel list (store-level)
 *   * Wave 2 Phase 15 — WhatsApp-confirmation Lead toggle
 *   * Wave 3 Phase 18 — Granular Customer Privacy / consent
 *
 * Translations live inline (English + Arabic dictionaries) — the
 * existing metaTracking i18n namespace can absorb these in a
 * follow-up; keeping them local here keeps the section shippable
 * without touching the global translation file.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Plus,
  ShieldCheck,
  Timer,
  Trash2,
} from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type {
  ConsentRegionMode,
  ConsentSettings,
  MetaTrackingSettings,
  OrderStatusTrigger,
  PixelEntry,
  SaveMetaTrackingPayload,
} from "@/services/metaTrackingApi";

// ─── i18n dictionaries ────────────────────────────────────────────────

type Lang = "en" | "ar";

interface SectionCopy {
  cod_timing: {
    title: string;
    desc: string;
    purchase_label: string;
    lead_label: string;
    none: string;
    recommended_cod: string;
    online_warning: string;
    save: string;
    saved: string;
  };
  multi_pixel: {
    title: string;
    desc: string;
    add_button: string;
    max_reached: string;
    pixel_id_label: string;
    pixel_id_placeholder: string;
    label_label: string;
    label_placeholder: string;
    role_label: string;
    role_primary: string;
    role_retargeting: string;
    role_agency: string;
    pixel_enabled: string;
    capi_enabled: string;
    remove: string;
    save: string;
    invalid_pixel_id: string;
    duplicate_pixel_id: string;
    saved: string;
  };
  whatsapp_lead: {
    title: string;
    desc: string;
    toggle_label: string;
    explainer: string;
    save: string;
    saved: string;
  };
  consent: {
    title: string;
    desc: string;
    granular_toggle: string;
    region_label: string;
    region_auto: string;
    region_opt_in: string;
    region_opt_out: string;
    defaults_heading: string;
    flag_analytics: string;
    flag_marketing: string;
    flag_preferences: string;
    flag_sale_of_data: string;
    sale_of_data_note: string;
    save: string;
    saved: string;
  };
}

const COPY: Record<Lang, SectionCopy> = {
  en: {
    cod_timing: {
      title: "COD-aware Purchase / Lead timing",
      desc: "Choose which order-status transition fires the Meta Purchase and Lead events. For COD merchants, firing Purchase on delivery (not order placement) keeps Meta's ROAS aligned with real revenue.",
      purchase_label: "Fire Purchase on",
      lead_label: "Fire Lead on",
      none: "Don't fire (use legacy payment-webhook path)",
      recommended_cod: "Recommended for COD-heavy stores",
      online_warning:
        "Online-payment merchants typically leave both at None — the payment webhook already fires Purchase on paid.",
      save: "Save timing config",
      saved: "Conversion timing saved",
    },
    multi_pixel: {
      title: "Additional Meta Pixels",
      desc: "Connect up to 3 Pixels to receive the same events (useful when an agency runs ads under their own Pixel + you have your own). Each fires independently — Meta's dedup contract still holds per pixel.",
      add_button: "Add another pixel",
      max_reached: "Maximum 3 pixels per store in v1.",
      pixel_id_label: "Pixel ID",
      pixel_id_placeholder: "15-16 digit ID",
      label_label: "Label",
      label_placeholder: "e.g. Retargeting Pixel",
      role_label: "Role",
      role_primary: "Primary",
      role_retargeting: "Retargeting",
      role_agency: "Agency",
      pixel_enabled: "Browser Pixel fires",
      capi_enabled: "CAPI server fires",
      remove: "Remove",
      save: "Save pixel list",
      invalid_pixel_id: "Pixel ID must be 15-16 digits",
      duplicate_pixel_id: "Duplicate pixel ID",
      saved: "Multi-pixel config saved",
    },
    whatsapp_lead: {
      title: "WhatsApp confirmation → Meta Lead",
      desc: "When a COD customer replies YES to your WhatsApp verification nudge, fire a Meta Lead event. Bridges WhatsApp commerce into Meta's ad-attribution loop.",
      toggle_label: "Fire Meta Lead on WhatsApp confirmation",
      explainer:
        "Off by default. When enabled, every customer-confirmed COD reply sends a Lead event to Meta with the verified phone number as the match key.",
      save: "Save WhatsApp settings",
      saved: "WhatsApp Lead setting saved",
    },
    consent: {
      title: "Granular Customer Privacy",
      desc: "Replace the single Accept/Reject banner with four per-category toggles. Required for EU shoppers; optional but compliance-friendly elsewhere. When granular mode is on, the storefront shows analytics / marketing / preferences / sale-of-data toggles.",
      granular_toggle: "Enable granular consent UI",
      region_label: "Default consent behavior",
      region_auto: "Auto (detect EU vs MENA from IP)",
      region_opt_in: "Force opt-in (all denied until user accepts)",
      region_opt_out: "Force opt-out (all allowed unless user denies)",
      defaults_heading: "Default pre-checks (when banner shows)",
      flag_analytics: "Analytics",
      flag_marketing: "Marketing & advertising",
      flag_preferences: "Site preferences",
      flag_sale_of_data: "Sale of personal data (CCPA opt-out)",
      sale_of_data_note:
        "Sale of data is opt-OUT semantics — leaving this off means the user has NOT opted out of sale, which is the typical default.",
      save: "Save consent policy",
      saved: "Consent policy saved",
    },
  },
  ar: {
    cod_timing: {
      title: "توقيت أحداث الشراء / العميل المحتمل (مع الدفع عند الاستلام)",
      desc: "اختر متى يتم إرسال حدث Purchase و Lead إلى ميتا. للتجار الذين يعتمدون على الدفع عند الاستلام، إرسال Purchase عند التسليم (وليس عند الطلب) يحافظ على دقة ROAS.",
      purchase_label: "إرسال Purchase عند",
      lead_label: "إرسال Lead عند",
      none: "لا ترسل (استخدم مسار webhook الدفع التقليدي)",
      recommended_cod: "موصى به للمتاجر التي تعتمد على الدفع عند الاستلام",
      online_warning:
        "تجار الدفع الإلكتروني يتركون الإعدادات على \"لا ترسل\" عادةً — webhook الدفع يرسل Purchase تلقائياً.",
      save: "حفظ إعدادات التوقيت",
      saved: "تم حفظ إعدادات التوقيت",
    },
    multi_pixel: {
      title: "بكسلات ميتا إضافية",
      desc: "أضف حتى 3 بكسلات تستقبل نفس الأحداث (مفيد عندما تعمل وكالة إعلانات على بكسلها الخاص بجانب بكسلك). كل بكسل يرسل مستقلاً.",
      add_button: "أضف بكسل آخر",
      max_reached: "الحد الأقصى 3 بكسلات لكل متجر في الإصدار الأول.",
      pixel_id_label: "معرف البكسل",
      pixel_id_placeholder: "15-16 رقمًا",
      label_label: "تسمية",
      label_placeholder: "مثال: بكسل إعادة الاستهداف",
      role_label: "الدور",
      role_primary: "أساسي",
      role_retargeting: "إعادة الاستهداف",
      role_agency: "وكالة",
      pixel_enabled: "إطلاق Pixel في المتصفح",
      capi_enabled: "إطلاق CAPI من السيرفر",
      remove: "حذف",
      save: "حفظ قائمة البكسل",
      invalid_pixel_id: "معرف البكسل يجب أن يكون 15-16 رقم",
      duplicate_pixel_id: "معرف البكسل مكرر",
      saved: "تم حفظ إعدادات البكسل",
    },
    whatsapp_lead: {
      title: "تأكيد واتساب ← Lead في ميتا",
      desc: "عندما يرد عميل الدفع عند الاستلام بـ \"نعم\" على رسالة التحقق على واتساب، أرسل حدث Lead إلى ميتا.",
      toggle_label: "إرسال Lead إلى ميتا عند تأكيد واتساب",
      explainer:
        "معطل افتراضياً. عند التفعيل، كل تأكيد عميل لطلب COD يرسل حدث Lead مع رقم الهاتف الموثق.",
      save: "حفظ إعدادات واتساب",
      saved: "تم حفظ إعدادات واتساب",
    },
    consent: {
      title: "خصوصية تفصيلية للعميل",
      desc: "استبدل لافتة القبول/الرفض الواحدة بأربعة مفاتيح لكل فئة. مطلوب للمتسوقين في الاتحاد الأوروبي.",
      granular_toggle: "تفعيل واجهة الموافقة التفصيلية",
      region_label: "السلوك الافتراضي للموافقة",
      region_auto: "تلقائي (اكتشف الاتحاد الأوروبي مقابل الشرق الأوسط من IP)",
      region_opt_in: "إجبار القبول (الكل ممنوع حتى يقبل المستخدم)",
      region_opt_out: "إجبار الرفض (الكل مسموح حتى يرفض المستخدم)",
      defaults_heading: "التحديدات الافتراضية (عند ظهور اللافتة)",
      flag_analytics: "الإحصائيات",
      flag_marketing: "التسويق والإعلانات",
      flag_preferences: "تفضيلات الموقع",
      flag_sale_of_data: "بيع البيانات الشخصية (CCPA)",
      sale_of_data_note:
        "بيع البيانات يعمل بمنطق الرفض الافتراضي — اتركه مغلقاً يعني أن المستخدم لم يرفض البيع.",
      save: "حفظ سياسة الموافقة",
      saved: "تم حفظ سياسة الموافقة",
    },
  },
};

// ─── Section: COD timing (Phase 12) ──────────────────────────────────

const TRIGGER_OPTIONS: { value: OrderStatusTrigger | "__none"; en: string; ar: string }[] = [
  { value: "__none", en: "— None —", ar: "— لا شيء —" },
  { value: "confirmed", en: "Confirmed", ar: "تم التأكيد" },
  { value: "processing", en: "Processing", ar: "قيد المعالجة" },
  { value: "shipped", en: "Shipped", ar: "تم الشحن" },
  { value: "delivered", en: "Delivered", ar: "تم التسليم" },
];

interface CodTimingSectionProps {
  settings: MetaTrackingSettings;
  onSave: (partial: Partial<SaveMetaTrackingPayload>) => Promise<void>;
  copy: SectionCopy["cod_timing"];
  lang: Lang;
  saving: boolean;
}

function CodTimingSection({ settings, onSave, copy, lang, saving }: CodTimingSectionProps) {
  const [purchaseTrigger, setPurchaseTrigger] = useState<OrderStatusTrigger | "__none">(
    settings.purchase_trigger ?? "__none",
  );
  const [leadTrigger, setLeadTrigger] = useState<OrderStatusTrigger | "__none">(
    settings.lead_trigger ?? "__none",
  );

  const dirty =
    (settings.purchase_trigger ?? "__none") !== purchaseTrigger ||
    (settings.lead_trigger ?? "__none") !== leadTrigger;

  const handleSave = async () => {
    await onSave({
      purchase_trigger: purchaseTrigger === "__none" ? null : purchaseTrigger,
      lead_trigger: leadTrigger === "__none" ? null : leadTrigger,
    });
    toast.success(copy.saved);
  };

  return (
    <Card data-testid="cod-timing-section">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-amber-600" />
          <CardTitle className="text-base">{copy.title}</CardTitle>
        </div>
        <CardDescription>{copy.desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{copy.purchase_label}</Label>
            <Select
              value={purchaseTrigger}
              onValueChange={(v) => setPurchaseTrigger(v as OrderStatusTrigger | "__none")}
            >
              <SelectTrigger data-testid="purchase-trigger-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt[lang]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{copy.lead_label}</Label>
            <Select
              value={leadTrigger}
              onValueChange={(v) => setLeadTrigger(v as OrderStatusTrigger | "__none")}
            >
              <SelectTrigger data-testid="lead-trigger-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt[lang]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {purchaseTrigger === "delivered" && leadTrigger === "confirmed" && (
          <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3 text-xs">
            ✓ {copy.recommended_cod}
          </div>
        )}
        {purchaseTrigger !== "__none" && (
          <p className="text-xs text-muted-foreground">{copy.online_warning}</p>
        )}
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          data-testid="cod-timing-save"
        >
          {copy.save}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Section: Multi-pixel (Phase 13) ─────────────────────────────────

const PIXEL_ID_REGEX = /^\d{15,16}$/;
const MAX_PIXELS = 3;

interface MultiPixelSectionProps {
  settings: MetaTrackingSettings;
  onSave: (partial: Partial<SaveMetaTrackingPayload>) => Promise<void>;
  copy: SectionCopy["multi_pixel"];
  lang: Lang;
  saving: boolean;
}

function newPixelEntry(): PixelEntry {
  return {
    pixel_id: "",
    pixel_enabled: true,
    capi_enabled: true,
    label: "",
    role: "retargeting",
  };
}

function MultiPixelSection({ settings, onSave, copy, lang, saving }: MultiPixelSectionProps) {
  const [pixels, setPixels] = useState<PixelEntry[]>(() => settings.pixels ?? []);

  const dirty = JSON.stringify(pixels) !== JSON.stringify(settings.pixels ?? []);

  const addPixel = () => {
    if (pixels.length >= MAX_PIXELS) return;
    setPixels([...pixels, newPixelEntry()]);
  };

  const removePixel = (index: number) => {
    setPixels(pixels.filter((_, i) => i !== index));
  };

  const updatePixel = <K extends keyof PixelEntry>(
    index: number,
    key: K,
    value: PixelEntry[K],
  ) => {
    setPixels(pixels.map((p, i) => (i === index ? { ...p, [key]: value } : p)));
  };

  const validationError = useMemo(() => {
    const seen = new Set<string>();
    for (const p of pixels) {
      if (!PIXEL_ID_REGEX.test(p.pixel_id)) return copy.invalid_pixel_id;
      if (seen.has(p.pixel_id)) return copy.duplicate_pixel_id;
      seen.add(p.pixel_id);
    }
    return null;
  }, [pixels, copy]);

  const handleSave = async () => {
    if (validationError) {
      toast.error(validationError);
      return;
    }
    // Empty list → send null so backend reverts to legacy single-pixel mode.
    await onSave({ pixels: pixels.length > 0 ? pixels : null });
    toast.success(copy.saved);
  };

  return (
    <Card data-testid="multi-pixel-section">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-base">{copy.title}</CardTitle>
        </div>
        <CardDescription>{copy.desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pixels.map((pixel, idx) => (
          <div
            key={idx}
            className="rounded-md border p-3 space-y-3"
            data-testid={`pixel-row-${idx}`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{copy.pixel_id_label}</Label>
                <Input
                  value={pixel.pixel_id}
                  onChange={(e) => updatePixel(idx, "pixel_id", e.target.value.trim())}
                  placeholder={copy.pixel_id_placeholder}
                  dir="ltr"
                  data-testid={`pixel-row-${idx}-id`}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{copy.label_label}</Label>
                <Input
                  value={pixel.label ?? ""}
                  onChange={(e) => updatePixel(idx, "label", e.target.value)}
                  placeholder={copy.label_placeholder}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{copy.role_label}</Label>
                <Select
                  value={pixel.role ?? "retargeting"}
                  onValueChange={(v) =>
                    updatePixel(idx, "role", v as PixelEntry["role"])
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">{copy.role_primary}</SelectItem>
                    <SelectItem value="retargeting">{copy.role_retargeting}</SelectItem>
                    <SelectItem value="agency">{copy.role_agency}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-4 items-end">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={pixel.pixel_enabled}
                    onCheckedChange={(v) => updatePixel(idx, "pixel_enabled", v)}
                    data-testid={`pixel-row-${idx}-pixel-enabled`}
                  />
                  <Label className="text-xs">{copy.pixel_enabled}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={pixel.capi_enabled}
                    onCheckedChange={(v) => updatePixel(idx, "capi_enabled", v)}
                    data-testid={`pixel-row-${idx}-capi-enabled`}
                  />
                  <Label className="text-xs">{copy.capi_enabled}</Label>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removePixel(idx)}
              data-testid={`pixel-row-${idx}-remove`}
            >
              <Trash2 className="h-4 w-4 me-1" /> {copy.remove}
            </Button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={addPixel}
            disabled={pixels.length >= MAX_PIXELS}
            data-testid="multi-pixel-add"
          >
            <Plus className="h-4 w-4 me-1" /> {copy.add_button}
          </Button>
          {pixels.length >= MAX_PIXELS && (
            <span className="text-xs text-muted-foreground">{copy.max_reached}</span>
          )}
        </div>
        {validationError && (
          <div className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {validationError}
          </div>
        )}
        <Button
          onClick={handleSave}
          disabled={!dirty || saving || !!validationError}
          data-testid="multi-pixel-save"
        >
          {copy.save}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Section: WhatsApp Lead toggle (Phase 15) ────────────────────────

interface WhatsappLeadSectionProps {
  settings: MetaTrackingSettings;
  onSave: (partial: Partial<SaveMetaTrackingPayload>) => Promise<void>;
  copy: SectionCopy["whatsapp_lead"];
  saving: boolean;
}

function WhatsappLeadSection({ settings, onSave, copy, saving }: WhatsappLeadSectionProps) {
  const [enabled, setEnabled] = useState(settings.whatsapp_lead_enabled ?? false);
  const dirty = enabled !== (settings.whatsapp_lead_enabled ?? false);

  const handleSave = async () => {
    await onSave({ whatsapp_lead_enabled: enabled });
    toast.success(copy.saved);
  };

  return (
    <Card data-testid="whatsapp-lead-section">
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-green-600" />
          <CardTitle className="text-base">{copy.title}</CardTitle>
        </div>
        <CardDescription>{copy.desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border p-3">
          <Label className="text-sm">{copy.toggle_label}</Label>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            data-testid="whatsapp-lead-toggle"
          />
        </div>
        <p className="text-xs text-muted-foreground">{copy.explainer}</p>
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          data-testid="whatsapp-lead-save"
        >
          {copy.save}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Section: Granular consent (Phase 18) ────────────────────────────

interface ConsentSectionProps {
  settings: MetaTrackingSettings;
  onSave: (partial: Partial<SaveMetaTrackingPayload>) => Promise<void>;
  copy: SectionCopy["consent"];
  lang: Lang;
  saving: boolean;
}

function defaultConsentSettings(): ConsentSettings {
  return {
    granular_enabled: false,
    region_default_mode: "force_opt_out",
    default_analytics: true,
    default_marketing: true,
    default_preferences: true,
    default_sale_of_data: false,
  };
}

function ConsentSection({ settings, onSave, copy, lang, saving }: ConsentSectionProps) {
  const initial = settings.consent_settings ?? defaultConsentSettings();
  const [draft, setDraft] = useState<ConsentSettings>(initial);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.consent_settings ?? null);

  const handleSave = async () => {
    await onSave({ consent_settings: draft });
    toast.success(copy.saved);
  };

  const regionLabel: Record<ConsentRegionMode, string> = {
    auto: copy.region_auto,
    force_opt_in: copy.region_opt_in,
    force_opt_out: copy.region_opt_out,
  };

  return (
    <Card data-testid="consent-section">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-purple-600" />
          <CardTitle className="text-base">{copy.title}</CardTitle>
        </div>
        <CardDescription>{copy.desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border p-3">
          <Label className="text-sm">{copy.granular_toggle}</Label>
          <Switch
            checked={draft.granular_enabled}
            onCheckedChange={(v) => setDraft({ ...draft, granular_enabled: v })}
            data-testid="consent-granular-toggle"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">{copy.region_label}</Label>
          <Select
            value={draft.region_default_mode}
            onValueChange={(v) =>
              setDraft({ ...draft, region_default_mode: v as ConsentRegionMode })
            }
          >
            <SelectTrigger data-testid="consent-region-mode-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["auto", "force_opt_in", "force_opt_out"] as const).map((m) => (
                <SelectItem key={m} value={m}>
                  {regionLabel[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {draft.granular_enabled && (
          <div className="space-y-2 rounded-md border p-3" data-testid="consent-defaults">
            <Label className="text-xs font-semibold">{copy.defaults_heading}</Label>
            {(["analytics", "marketing", "preferences", "sale_of_data"] as const).map(
              (key) => {
                const draftKey = ("default_" + key) as keyof ConsentSettings;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between py-1"
                  >
                    <Label className="text-sm">
                      {copy[("flag_" + key) as keyof typeof copy] as string}
                    </Label>
                    <Switch
                      checked={Boolean(draft[draftKey])}
                      onCheckedChange={(v) =>
                        setDraft({ ...draft, [draftKey]: v } as ConsentSettings)
                      }
                      data-testid={`consent-flag-${key}`}
                    />
                  </div>
                );
              },
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {copy.sale_of_data_note}
            </p>
          </div>
        )}
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          data-testid="consent-save"
        >
          {copy.save}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Container — collapses everything into one toggle ────────────────

export interface MetaTrackingAdvancedSettingsProps {
  settings: MetaTrackingSettings;
  /** Partial save — the parent panel merges with the full payload. */
  onSave: (partial: Partial<SaveMetaTrackingPayload>) => Promise<void>;
  saving: boolean;
  defaultExpanded?: boolean;
}

export function MetaTrackingAdvancedSettings({
  settings,
  onSave,
  saving,
  defaultExpanded = false,
}: MetaTrackingAdvancedSettingsProps) {
  const { language } = useLanguage();
  const lang: Lang = language === "ar" ? "ar" : "en";
  const copy = COPY[lang];
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 w-full text-left text-sm font-semibold",
          "py-2 px-3 rounded-md hover:bg-muted/50 transition-colors",
        )}
        data-testid="advanced-settings-toggle"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {lang === "ar" ? "إعدادات متقدمة" : "Advanced settings"}
        <Badge variant="outline" className="ms-2 text-xs">
          {lang === "ar" ? "موجة 2 + 3" : "Wave 2 + 3"}
        </Badge>
      </button>
      {expanded && (
        <div className="space-y-4" data-testid="advanced-settings-content">
          <CodTimingSection
            settings={settings}
            onSave={onSave}
            copy={copy.cod_timing}
            lang={lang}
            saving={saving}
          />
          <MultiPixelSection
            settings={settings}
            onSave={onSave}
            copy={copy.multi_pixel}
            lang={lang}
            saving={saving}
          />
          <WhatsappLeadSection
            settings={settings}
            onSave={onSave}
            copy={copy.whatsapp_lead}
            saving={saving}
          />
          <ConsentSection
            settings={settings}
            onSave={onSave}
            copy={copy.consent}
            lang={lang}
            saving={saving}
          />
        </div>
      )}
    </div>
  );
}

