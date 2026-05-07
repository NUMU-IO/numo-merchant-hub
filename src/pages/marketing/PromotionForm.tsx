/**
 * Unified create/edit form for every promotion surface.
 *
 * * `discount_code` flow performs a 2-step submit: first POST /coupons
 *   to mint the underlying code, then POST /promotions linking the new
 *   coupon. The other surfaces are a single POST /promotions call.
 * * Visual surfaces (announcement_bar / popup / floating_widget /
 *   cookie_banner) render `VisualContentPanel` for surface-specific
 *   content; the iframe live-preview from step 08 lands once the
 *   storefront-side handler (step 11) and preview-token endpoint
 *   (step 05 §4.9, deferred) are in place.
 * * Edit mode hydrates from `GET /promotions/:id` and submits PATCH
 *   with the row's current `version` for optimistic locking.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { useDashboardStore } from "@/contexts/StoreContext";
import {
  useCreatePromotion,
  usePromotion,
  useUpdatePromotion,
} from "@/hooks/usePromotions";
import {
  createCoupon,
  type CreateCouponData,
} from "@/services/couponApi";
import type {
  CreatePromotionRequest,
  DiscountRule,
  DiscountRuleKind,
  PromotionSurface,
  UpdatePromotionRequest,
} from "@/services/promotionApi";
import { showError } from "@/lib/show-error";
import {
  buildVisualContent,
  buildVisualTranslations,
  EMPTY_VISUAL_CONTENT,
  VisualContentPanel,
  type VisualContentState,
} from "@/components/marketing/VisualContentPanel";

const VALID_SURFACES: PromotionSurface[] = [
  "discount_code",
  "automatic",
  "announcement_bar",
  "popup",
  "floating_widget",
  "cookie_banner",
];

const VISUAL_SURFACES: PromotionSurface[] = [
  "announcement_bar",
  "popup",
  "floating_widget",
  "cookie_banner",
];

function isVisual(surface: PromotionSurface): boolean {
  return VISUAL_SURFACES.includes(surface);
}

interface FormState {
  name: string;
  code: string;
  ruleKind: DiscountRuleKind;
  valuePercent: string;
  valueCents: string;
  minSubtotalCents: string;
  maxDiscountCents: string;
  startsAt: string;
  endsAt: string;
  audienceKind: "all" | "new_visitor" | "returning" | "logged_in" | "guest";
  labelEn: string;
  labelAr: string;
  activate: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  ruleKind: "percentage",
  valuePercent: "",
  valueCents: "",
  minSubtotalCents: "",
  maxDiscountCents: "",
  startsAt: "",
  endsAt: "",
  audienceKind: "all",
  labelEn: "",
  labelAr: "",
  activate: false,
};

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function toIsoOrNull(local: string): string | null {
  if (!local) return null;
  // <input type="datetime-local"> gives "YYYY-MM-DDTHH:mm" without zone.
  // Treat it as local; Date#toISOString converts to UTC.
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function fromIso(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Re-format to "YYYY-MM-DDTHH:mm" in the visitor's local zone.
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export default function PromotionForm() {
  const { t } = useTranslation();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editingId } = useParams<{ id: string }>();
  const isEdit = !!editingId;

  // Determine surface either from query (create) or loaded record (edit).
  const surfaceParam = searchParams.get("surface") as PromotionSurface | null;
  const promotionQuery = usePromotion(storeId, editingId);
  const surface: PromotionSurface =
    promotionQuery.data?.surface ??
    (VALID_SURFACES.includes(surfaceParam as PromotionSurface)
      ? (surfaceParam as PromotionSurface)
      : "discount_code");

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [visual, setVisual] = useState<VisualContentState>(EMPTY_VISUAL_CONTENT);
  const [submitting, setSubmitting] = useState(false);

  // Hydrate form when editing an existing promotion.
  useEffect(() => {
    if (!isEdit || !promotionQuery.data) return;
    const promo = promotionQuery.data;
    const audience = promo.targets.find((t) => t.target_kind === "audience");
    const enLabel = promo.translations?.en?.label?.en ?? "";
    const arLabel = promo.translations?.ar?.label?.ar ?? "";
    setForm({
      name: promo.name,
      code: "",
      ruleKind: (promo.discount_rule?.kind ?? "percentage") as DiscountRuleKind,
      valuePercent: promo.discount_rule?.value_percent?.toString() ?? "",
      valueCents: promo.discount_rule?.value_cents?.toString() ?? "",
      minSubtotalCents: promo.discount_rule?.min_subtotal_cents?.toString() ?? "",
      maxDiscountCents: promo.discount_rule?.max_discount_cents?.toString() ?? "",
      startsAt: fromIso(promo.starts_at),
      endsAt: fromIso(promo.ends_at),
      audienceKind:
        ((audience?.target_value as { kind?: string } | undefined)?.kind as
          | FormState["audienceKind"]
          | undefined) ?? "all",
      labelEn: enLabel,
      labelAr: arLabel,
      activate: promo.status === "active",
    });
    if (isVisual(promo.surface)) {
      const c = (promo.content ?? {}) as Record<string, unknown>;
      const enT = promo.translations?.en;
      const arT = promo.translations?.ar;
      setVisual({
        ...EMPTY_VISUAL_CONTENT,
        bg: (c.background as string) ?? EMPTY_VISUAL_CONTENT.bg,
        fg: (c.text_color as string) ?? EMPTY_VISUAL_CONTENT.fg,
        icon: (c.icon as string) ?? EMPTY_VISUAL_CONTENT.icon,
        dismissible:
          (c.dismissible as boolean | undefined) ??
          EMPTY_VISUAL_CONTENT.dismissible,
        linkUrl: (c.link_url as string) ?? "",
        headlineEn: enT?.headline?.en ?? "",
        headlineAr: arT?.headline?.ar ?? "",
        bodyEn: enT?.body?.en ?? "",
        bodyAr: arT?.body?.ar ?? "",
        ctaLabelEn: enT?.cta_label?.en ?? "",
        ctaLabelAr: arT?.cta_label?.ar ?? "",
        popupLayout:
          (c.layout as "centered" | "side") ??
          EMPTY_VISUAL_CONTENT.popupLayout,
        popupCodeReveal: (c.discount_code_to_reveal as string) ?? "",
        popupShowAfterDays:
          (c.show_after_dismiss_days as number | undefined) ??
          EMPTY_VISUAL_CONTENT.popupShowAfterDays,
        widgetPosition:
          (c.position as VisualContentState["widgetPosition"]) ??
          EMPTY_VISUAL_CONTENT.widgetPosition,
        widgetIcon: (c.icon as string) ?? EMPTY_VISUAL_CONTENT.widgetIcon,
        widgetExpanded:
          (c.expanded_default as boolean | undefined) ?? false,
        widgetBg: (c.color_bg as string) ?? EMPTY_VISUAL_CONTENT.widgetBg,
        cookiePosition:
          (c.position as "bottom" | "modal") ??
          EMPTY_VISUAL_CONTENT.cookiePosition,
        cookieAcceptRequired:
          (c.accept_required as boolean | undefined) ?? false,
        cookiePolicyUrl: (c.policy_url as string) ?? "",
      });
    }
  }, [isEdit, promotionQuery.data]);

  // Mutations
  const createMutation = useCreatePromotion(storeId);
  const updateMutation = useUpdatePromotion(storeId, editingId);

  const buildDiscountRule = (): DiscountRule => {
    const rule: DiscountRule = { kind: form.ruleKind };
    if (form.ruleKind === "percentage") {
      rule.value_percent = Number(form.valuePercent) || 0;
    } else if (form.ruleKind === "fixed") {
      rule.value_cents = Number(form.valueCents) || 0;
    }
    if (form.minSubtotalCents)
      rule.min_subtotal_cents = Number(form.minSubtotalCents);
    if (form.maxDiscountCents)
      rule.max_discount_cents = Number(form.maxDiscountCents);
    return rule;
  };

  const buildTargets = (): CreatePromotionRequest["targets"] => {
    if (form.audienceKind === "all") return [];
    return [
      {
        target_kind: "audience",
        target_value: { kind: form.audienceKind },
        inclusion: true,
      },
    ];
  };

  const buildTranslations = (): CreatePromotionRequest["translations"] => {
    const out: CreatePromotionRequest["translations"] = {};
    if (form.labelEn) out!.en = { label: { en: form.labelEn } };
    if (form.labelAr) out!.ar = { label: { ar: form.labelAr } };
    return out;
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return t("promotions.errors.name_required") as string;
    if (surface === "discount_code" && !isEdit && !form.code.trim()) {
      return t("promotions.errors.code_required") as string;
    }
    // Discount-rule validation only applies to discount_code + automatic.
    if (surface === "discount_code" || surface === "automatic") {
      if (form.ruleKind === "percentage") {
        const v = Number(form.valuePercent);
        if (!v || v <= 0 || v > 100)
          return t("promotions.errors.percent_range") as string;
      }
      if (form.ruleKind === "fixed" && !Number(form.valueCents)) {
        return t("promotions.errors.fixed_required") as string;
      }
    }
    if (
      form.startsAt &&
      form.endsAt &&
      new Date(form.endsAt) <= new Date(form.startsAt)
    ) {
      return t("promotions.errors.end_before_start") as string;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    if (!storeId) return;
    setSubmitting(true);
    try {
      const visualSurface = isVisual(surface);

      // Build content + translations payloads based on surface.
      const content = visualSurface
        ? buildVisualContent(surface, visual)
        : { surface };
      const labelTx = buildTranslations() ?? {};
      const visualTx = visualSurface ? buildVisualTranslations(visual) : {};
      const translations: CreatePromotionRequest["translations"] = {
        ...labelTx,
        ...visualTx,
      };

      if (isEdit) {
        const payload: UpdatePromotionRequest = {
          version: promotionQuery.data!.version,
          name: form.name,
          discount_rule: surface === "automatic" ? buildDiscountRule() : null,
          content,
          targets: buildTargets(),
          translations,
          starts_at: toIsoOrNull(form.startsAt),
          ends_at: toIsoOrNull(form.endsAt),
        };
        await updateMutation.mutateAsync(payload);
        toast.success(t("promotions.actions.saved") as string);
        navigate("/marketing/promotions");
        return;
      }

      // Create flow
      let couponId: string | null = null;
      if (surface === "discount_code") {
        // 1) Create the underlying coupon. The Coupon API speaks decimal
        //    "value" but we expose a percent input — convert as needed.
        const couponData: CreateCouponData = {
          code: form.code.toUpperCase(),
          coupon_type:
            form.ruleKind === "fixed"
              ? "fixed"
              : form.ruleKind === "free_shipping"
                ? "free_shipping"
                : "percentage",
          value:
            form.ruleKind === "fixed"
              ? Number(form.valueCents) / 100
              : Number(form.valuePercent),
          min_order_amount: form.minSubtotalCents
            ? Number(form.minSubtotalCents) / 100
            : null,
          max_discount_amount: form.maxDiscountCents
            ? Number(form.maxDiscountCents) / 100
            : null,
        };
        const coupon = await createCoupon(storeId, couponData);
        couponId = coupon.id;
      }

      const payload: CreatePromotionRequest = {
        name: form.name.trim(),
        surface,
        status: form.activate ? "active" : "draft",
        coupon_id: couponId,
        discount_rule: surface === "automatic" ? buildDiscountRule() : null,
        content,
        targets: buildTargets(),
        translations,
        starts_at: toIsoOrNull(form.startsAt),
        ends_at: toIsoOrNull(form.endsAt),
      };
      await createMutation.mutateAsync(payload);
      toast.success(t("promotions.actions.created") as string);
      navigate("/marketing/promotions");
    } catch (err) {
      showError(err, t("promotions.actions.error") as string);
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const isAuto = surface === "automatic";
  const isCode = surface === "discount_code";
  const showDiscountSection = isAuto || isCode;
  const showVisualPanel = isVisual(surface);

  const titleKey = isEdit
    ? `promotions.form.title_edit_${surface}`
    : `promotions.form.title_new_${surface}`;

  const ruleKindOptions = useMemo<DiscountRuleKind[]>(
    () =>
      isAuto
        ? ["percentage", "fixed", "free_shipping", "bogo", "tiered"]
        : ["percentage", "fixed", "free_shipping"],
    [isAuto],
  );

  if (isEdit && promotionQuery.isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t(titleKey)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("promotions.form.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/marketing/promotions")}
          >
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="me-2 h-4 w-4" />
            )}
            {t("common.save")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("promotions.form.basics")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="promo-name">{t("promotions.form.name")}</Label>
            <Input
              id="promo-name"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder={t("promotions.form.name_placeholder") as string}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t("promotions.form.name_hint")}
            </p>
          </div>
          {isCode && !isEdit && (
            <div className="grid gap-2">
              <Label htmlFor="promo-code">{t("promotions.form.code")}</Label>
              <div className="flex gap-2">
                <Input
                  id="promo-code"
                  value={form.code}
                  onChange={(e) =>
                    updateField("code", e.target.value.toUpperCase())
                  }
                  className="font-mono"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => updateField("code", generateCode())}
                >
                  {t("promotions.form.code_generate")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showVisualPanel && (
        <VisualContentPanel
          surface={surface}
          state={visual}
          onChange={setVisual}
        />
      )}

      {showDiscountSection && (
      <Card>
        <CardHeader>
          <CardTitle>{t("promotions.form.discount_rule")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="rule-kind">
              {t("promotions.form.rule_kind_label")}
            </Label>
            <Select
              value={form.ruleKind}
              onValueChange={(v) =>
                updateField("ruleKind", v as DiscountRuleKind)
              }
            >
              <SelectTrigger id="rule-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ruleKindOptions.map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`promotions.form.rule_kind.${k}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.ruleKind === "percentage" && (
            <div className="grid gap-2">
              <Label htmlFor="rule-percent">
                {t("promotions.form.percent_label")}
              </Label>
              <Input
                id="rule-percent"
                type="number"
                min={1}
                max={100}
                value={form.valuePercent}
                onChange={(e) => updateField("valuePercent", e.target.value)}
                required
              />
            </div>
          )}
          {form.ruleKind === "fixed" && (
            <div className="grid gap-2">
              <Label htmlFor="rule-cents">
                {t("promotions.form.fixed_label")}
              </Label>
              <Input
                id="rule-cents"
                type="number"
                min={0}
                step={1}
                value={form.valueCents}
                onChange={(e) => updateField("valueCents", e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t("promotions.form.cents_help")}
              </p>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="rule-min">
                {t("promotions.form.min_subtotal")}
              </Label>
              <Input
                id="rule-min"
                type="number"
                min={0}
                value={form.minSubtotalCents}
                onChange={(e) =>
                  updateField("minSubtotalCents", e.target.value)
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rule-max">
                {t("promotions.form.max_discount")}
              </Label>
              <Input
                id="rule-max"
                type="number"
                min={0}
                value={form.maxDiscountCents}
                onChange={(e) =>
                  updateField("maxDiscountCents", e.target.value)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("promotions.form.targeting")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="audience">
              {t("promotions.form.audience_label")}
            </Label>
            <Select
              value={form.audienceKind}
              onValueChange={(v) =>
                updateField("audienceKind", v as FormState["audienceKind"])
              }
            >
              <SelectTrigger id="audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("promotions.form.audience.all")}
                </SelectItem>
                <SelectItem value="new_visitor">
                  {t("promotions.form.audience.new_visitor")}
                </SelectItem>
                <SelectItem value="returning">
                  {t("promotions.form.audience.returning")}
                </SelectItem>
                <SelectItem value="logged_in">
                  {t("promotions.form.audience.logged_in")}
                </SelectItem>
                <SelectItem value="guest">
                  {t("promotions.form.audience.guest")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("promotions.form.schedule")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="starts">{t("promotions.form.starts_at")}</Label>
            <Input
              id="starts"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => updateField("startsAt", e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ends">{t("promotions.form.ends_at")}</Label>
            <Input
              id="ends"
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => updateField("endsAt", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("promotions.form.translations")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ar">
            <TabsList>
              <TabsTrigger value="ar">العربية</TabsTrigger>
              <TabsTrigger value="en">English</TabsTrigger>
            </TabsList>
            <TabsContent value="ar" className="space-y-2 pt-3">
              <Label htmlFor="label-ar">
                {t("promotions.form.label_ar")}
              </Label>
              <Input
                id="label-ar"
                value={form.labelAr}
                onChange={(e) => updateField("labelAr", e.target.value)}
                dir="rtl"
              />
            </TabsContent>
            <TabsContent value="en" className="space-y-2 pt-3">
              <Label htmlFor="label-en">
                {t("promotions.form.label_en")}
              </Label>
              <Input
                id="label-en"
                value={form.labelEn}
                onChange={(e) => updateField("labelEn", e.target.value)}
                dir="ltr"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {!isEdit && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-6">
            <div>
              <Label
                htmlFor="activate-now"
                className="text-base font-medium"
              >
                {t("promotions.form.activate_now")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("promotions.form.activate_now_hint")}
              </p>
            </div>
            <Switch
              id="activate-now"
              checked={form.activate}
              onCheckedChange={(checked) => updateField("activate", checked)}
            />
          </CardContent>
        </Card>
      )}
    </form>
  );
}
