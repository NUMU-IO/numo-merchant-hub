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
import { BogoSetPicker } from "@/components/marketing/BogoSetPicker";

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

/**
 * One row of a tiered discount: "spend X cents, get Y% off". The form
 * stores them as strings so the user can clear an input mid-edit
 * without committing NaN; we coerce to ints in `buildDiscountRule`.
 */
interface TierFormRow {
  threshold_cents: string;
  percent: string;
}

/** BOGO buy-set / get-set picker mode. */
type BogoSetMode = "any" | "product" | "category";

interface FormState {
  name: string;
  code: string;
  ruleKind: DiscountRuleKind;
  valuePercent: string;
  valueCents: string;
  minSubtotalCents: string;
  maxDiscountCents: string;
  // BOGO fields — only sent when ruleKind === "bogo".
  // `getDiscountPercent` defaults to 100 (= "free") on first paint
  // because that's the most common BOGO shape; merchant can lower it
  // (e.g. "buy 2 get 1 50% off") without having to re-type the value.
  buyQuantity: string;
  getQuantity: string;
  getDiscountPercent: string;
  // BOGO targeting (Phase B) — "Customer buys" + "Customer gets" sets.
  // The mode picks how the set is defined; product/category IDs only
  // matter for the corresponding mode. v1 supports a single product
  // OR a single category per role (covers >90% of BOGO campaigns);
  // multi-select is a follow-up.
  bogoBuyMode: BogoSetMode;
  bogoBuyProductId: string;
  bogoBuyCategoryId: string;
  bogoGetMode: BogoSetMode;
  bogoGetProductId: string;
  bogoGetCategoryId: string;
  // TIERED fields — at least one row required when ruleKind === "tiered".
  tiers: TierFormRow[];
  // Per-promotion usage caps (Phase B). Strings so a blank input
  // means "uncapped" rather than 0.
  usageLimitTotal: string;
  usageLimitPerCustomer: string;
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
  buyQuantity: "",
  getQuantity: "",
  getDiscountPercent: "100",
  bogoBuyMode: "any",
  bogoBuyProductId: "",
  bogoBuyCategoryId: "",
  bogoGetMode: "any",
  bogoGetProductId: "",
  bogoGetCategoryId: "",
  tiers: [{ threshold_cents: "", percent: "" }],
  usageLimitTotal: "",
  usageLimitPerCustomer: "",
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
    const savedTiers = promo.discount_rule?.tiers ?? [];
    // Decompose role-tagged BOGO targets back into the form shape.
    // We only support a single product/category per role in the v1
    // UI, so we read the first ID we find for each role.
    const buyTarget = promo.targets.find((t) => t.role === "buy_set");
    const getTarget = promo.targets.find((t) => t.role === "get_set");
    const decomposeBogoTarget = (
      target: typeof buyTarget,
    ): { mode: BogoSetMode; productId: string; categoryId: string } => {
      if (!target) return { mode: "any", productId: "", categoryId: "" };
      if (target.target_kind === "product") {
        const ids = (target.target_value as { product_ids?: string[] }).product_ids;
        return {
          mode: "product",
          productId: ids?.[0] ?? "",
          categoryId: "",
        };
      }
      if (target.target_kind === "category") {
        const ids = (target.target_value as { category_ids?: string[] })
          .category_ids;
        return {
          mode: "category",
          productId: "",
          categoryId: ids?.[0] ?? "",
        };
      }
      return { mode: "any", productId: "", categoryId: "" };
    };
    const buyHydrated = decomposeBogoTarget(buyTarget);
    const getHydrated = decomposeBogoTarget(getTarget);
    setForm({
      name: promo.name,
      code: "",
      ruleKind: (promo.discount_rule?.kind ?? "percentage") as DiscountRuleKind,
      valuePercent: promo.discount_rule?.value_percent?.toString() ?? "",
      valueCents: promo.discount_rule?.value_cents?.toString() ?? "",
      minSubtotalCents: promo.discount_rule?.min_subtotal_cents?.toString() ?? "",
      maxDiscountCents: promo.discount_rule?.max_discount_cents?.toString() ?? "",
      buyQuantity: promo.discount_rule?.buy_quantity?.toString() ?? "",
      getQuantity: promo.discount_rule?.get_quantity?.toString() ?? "",
      getDiscountPercent:
        promo.discount_rule?.get_discount_percent?.toString() ?? "100",
      bogoBuyMode: buyHydrated.mode,
      bogoBuyProductId: buyHydrated.productId,
      bogoBuyCategoryId: buyHydrated.categoryId,
      bogoGetMode: getHydrated.mode,
      bogoGetProductId: getHydrated.productId,
      bogoGetCategoryId: getHydrated.categoryId,
      tiers:
        savedTiers.length > 0
          ? savedTiers.map((t) => ({
              threshold_cents: t.threshold_cents.toString(),
              percent: t.percent.toString(),
            }))
          : [{ threshold_cents: "", percent: "" }],
      usageLimitTotal: promo.usage_limit_total?.toString() ?? "",
      usageLimitPerCustomer: promo.usage_limit_per_customer?.toString() ?? "",
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
      // `cta_url` is locale-agnostic but stored on the per-locale block.
      // Read whichever side has a value first.
      const savedCtaUrl =
        (arT?.cta_url as string | undefined) ??
        (enT?.cta_url as string | undefined) ??
        "";
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
        ctaUrl: savedCtaUrl,
        popupLayout:
          (c.layout as "centered" | "side") ??
          EMPTY_VISUAL_CONTENT.popupLayout,
        popupCodeReveal: (c.discount_code_to_reveal as string) ?? "",
        popupShowAfterDays:
          (c.show_after_dismiss_days as number | undefined) ??
          EMPTY_VISUAL_CONTENT.popupShowAfterDays,
        popupImageUrl: (c.image_url as string) ?? "",
        popupCollectEmail: (c.collect_email as boolean | undefined) ?? false,
        popupCollectPhone: (c.collect_phone as boolean | undefined) ?? false,
        popupSuccessHeadlineAr:
          (arT?.success_headline?.ar as string | undefined) ?? "",
        popupSuccessHeadlineEn:
          (enT?.success_headline?.en as string | undefined) ?? "",
        popupSuccessBodyAr:
          (arT?.success_body?.ar as string | undefined) ?? "",
        popupSuccessBodyEn:
          (enT?.success_body?.en as string | undefined) ?? "",
        popupEmailLabelAr:
          (arT?.email_label?.ar as string | undefined) ?? "",
        popupEmailLabelEn:
          (enT?.email_label?.en as string | undefined) ?? "",
        popupPhoneLabelAr:
          (arT?.phone_label?.ar as string | undefined) ?? "",
        popupPhoneLabelEn:
          (enT?.phone_label?.en as string | undefined) ?? "",
        popupConsentLabelAr:
          (arT?.consent_label?.ar as string | undefined) ?? "",
        popupConsentLabelEn:
          (enT?.consent_label?.en as string | undefined) ?? "",
        popupSubmitLabelAr:
          (arT?.submit_label?.ar as string | undefined) ?? "",
        popupSubmitLabelEn:
          (enT?.submit_label?.en as string | undefined) ?? "",
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
    } else if (form.ruleKind === "bogo") {
      // The API's domain validator requires both quantities; the form
      // validator catches missing values before we get here, but we
      // still parse defensively so `Number("") || 1` doesn't ship a
      // misconfigured rule on a stale state.
      rule.buy_quantity = Number(form.buyQuantity) || 1;
      rule.get_quantity = Number(form.getQuantity) || 1;
      rule.get_discount_percent = Number(form.getDiscountPercent || "100");
    } else if (form.ruleKind === "tiered") {
      rule.tiers = form.tiers
        .map((row) => ({
          threshold_cents: Number(row.threshold_cents) || 0,
          percent: Number(row.percent) || 0,
        }))
        // Drop any tier the merchant left blank.
        .filter((t) => t.threshold_cents > 0 || t.percent > 0);
    }
    if (form.minSubtotalCents)
      rule.min_subtotal_cents = Number(form.minSubtotalCents);
    if (form.maxDiscountCents)
      rule.max_discount_cents = Number(form.maxDiscountCents);
    return rule;
  };

  const buildTargets = (): CreatePromotionRequest["targets"] => {
    const targets: CreatePromotionRequest["targets"] = [];
    if (form.audienceKind !== "all") {
      targets!.push({
        target_kind: "audience",
        target_value: { kind: form.audienceKind },
        inclusion: true,
      });
    }
    // BOGO buy/get-set targets (Phase B). Only emitted for the bogo
    // rule kind — other kinds ignore them. v1 ships single-product /
    // single-category per role; multi-select is a follow-up.
    if (form.ruleKind === "bogo") {
      if (form.bogoBuyMode === "product" && form.bogoBuyProductId) {
        targets!.push({
          target_kind: "product",
          target_value: { product_ids: [form.bogoBuyProductId] },
          inclusion: true,
          role: "buy_set",
        });
      } else if (form.bogoBuyMode === "category" && form.bogoBuyCategoryId) {
        targets!.push({
          target_kind: "category",
          target_value: { category_ids: [form.bogoBuyCategoryId] },
          inclusion: true,
          role: "buy_set",
        });
      }
      if (form.bogoGetMode === "product" && form.bogoGetProductId) {
        targets!.push({
          target_kind: "product",
          target_value: { product_ids: [form.bogoGetProductId] },
          inclusion: true,
          role: "get_set",
        });
      } else if (form.bogoGetMode === "category" && form.bogoGetCategoryId) {
        targets!.push({
          target_kind: "category",
          target_value: { category_ids: [form.bogoGetCategoryId] },
          inclusion: true,
          role: "get_set",
        });
      }
    }
    return targets;
  };

  /** Parse the usage-limit string inputs into the API's int|null shape. */
  const buildUsageLimits = () => ({
    usage_limit_total: form.usageLimitTotal
      ? Number(form.usageLimitTotal) || null
      : null,
    usage_limit_per_customer: form.usageLimitPerCustomer
      ? Number(form.usageLimitPerCustomer) || null
      : null,
  });

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
      if (form.ruleKind === "bogo") {
        const b = Number(form.buyQuantity);
        const g = Number(form.getQuantity);
        if (!b || b < 1) return t("promotions.errors.buy_quantity_required") as string;
        if (!g || g < 1) return t("promotions.errors.get_quantity_required") as string;
        const pct = Number(form.getDiscountPercent);
        if (Number.isNaN(pct) || pct < 0 || pct > 100)
          return t("promotions.errors.get_discount_percent_range") as string;
      }
      if (form.ruleKind === "tiered") {
        const realRows = form.tiers.filter(
          (r) => r.threshold_cents.trim() !== "" && r.percent.trim() !== "",
        );
        if (realRows.length === 0)
          return t("promotions.errors.tiers_required") as string;
        for (const row of realRows) {
          const pct = Number(row.percent);
          if (Number.isNaN(pct) || pct < 0 || pct > 100)
            return t("promotions.errors.tiers_percent_range") as string;
        }
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

      // Both `automatic` and `discount_code` surfaces carry a rule
      // (Phase A matrix relaxation). Other surfaces forbid one or
      // make it optional with no UI yet, so we send `null`.
      const ruleSurfaces = surface === "automatic" || surface === "discount_code";
      if (isEdit) {
        const payload: UpdatePromotionRequest = {
          version: promotionQuery.data!.version,
          name: form.name,
          discount_rule: ruleSurfaces ? buildDiscountRule() : null,
          content,
          targets: buildTargets(),
          translations,
          starts_at: toIsoOrNull(form.startsAt),
          ends_at: toIsoOrNull(form.endsAt),
          ...buildUsageLimits(),
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
        discount_rule: ruleSurfaces ? buildDiscountRule() : null,
        content,
        targets: buildTargets(),
        translations,
        starts_at: toIsoOrNull(form.startsAt),
        ends_at: toIsoOrNull(form.endsAt),
        ...buildUsageLimits(),
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

  // Both `automatic` and `discount_code` surfaces now offer the full
  // rule-kind set. The API's storefront `/cart/discounts` endpoint
  // routes BOGO/tiered codes through the unified discount calculator
  // (the legacy `Coupon.calculate_discount` only handles the simple
  // three, but it's bypassed when the linked promotion has a rule).
  const ruleKindOptions = useMemo<DiscountRuleKind[]>(
    () => ["percentage", "fixed", "free_shipping", "bogo", "tiered"],
    [],
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
          storeId={storeId}
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
          {form.ruleKind === "bogo" && (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="rule-buy-qty">
                    {t("promotions.form.bogo_buy_quantity")}
                  </Label>
                  <Input
                    id="rule-buy-qty"
                    type="number"
                    min={1}
                    step={1}
                    value={form.buyQuantity}
                    onChange={(e) => updateField("buyQuantity", e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rule-get-qty">
                    {t("promotions.form.bogo_get_quantity")}
                  </Label>
                  <Input
                    id="rule-get-qty"
                    type="number"
                    min={1}
                    step={1}
                    value={form.getQuantity}
                    onChange={(e) => updateField("getQuantity", e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rule-get-pct">
                    {t("promotions.form.bogo_get_percent")}
                  </Label>
                  <Input
                    id="rule-get-pct"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={form.getDiscountPercent}
                    onChange={(e) =>
                      updateField("getDiscountPercent", e.target.value)
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("promotions.form.bogo_help")}
              </p>
            </div>
          )}
          {form.ruleKind === "tiered" && (
            <div className="space-y-3">
              <Label>{t("promotions.form.tiered_label")}</Label>
              <div className="space-y-2">
                {form.tiers.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid gap-2 grid-cols-[1fr_1fr_auto] items-end"
                  >
                    <div className="grid gap-1">
                      <Label
                        htmlFor={`tier-thresh-${idx}`}
                        className="text-xs text-muted-foreground"
                      >
                        {t("promotions.form.tier_threshold")}
                      </Label>
                      <Input
                        id={`tier-thresh-${idx}`}
                        type="number"
                        min={0}
                        step={1}
                        value={row.threshold_cents}
                        onChange={(e) => {
                          const next = [...form.tiers];
                          next[idx] = {
                            ...next[idx],
                            threshold_cents: e.target.value,
                          };
                          updateField("tiers", next);
                        }}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label
                        htmlFor={`tier-pct-${idx}`}
                        className="text-xs text-muted-foreground"
                      >
                        {t("promotions.form.tier_percent")}
                      </Label>
                      <Input
                        id={`tier-pct-${idx}`}
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={row.percent}
                        onChange={(e) => {
                          const next = [...form.tiers];
                          next[idx] = { ...next[idx], percent: e.target.value };
                          updateField("tiers", next);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={form.tiers.length === 1}
                      onClick={() => {
                        const next = form.tiers.filter((_, i) => i !== idx);
                        updateField("tiers", next);
                      }}
                      aria-label={t("promotions.form.tier_remove") as string}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updateField("tiers", [
                    ...form.tiers,
                    { threshold_cents: "", percent: "" },
                  ])
                }
              >
                + {t("promotions.form.tier_add")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("promotions.form.tiered_help")}
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

      {showDiscountSection && form.ruleKind === "bogo" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("promotions.form.bogo_targeting_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-base">
                {t("promotions.form.bogo_buy_set")}
              </Label>
              <BogoSetPicker
                storeId={storeId}
                side="buy"
                mode={form.bogoBuyMode}
                productId={form.bogoBuyProductId}
                categoryId={form.bogoBuyCategoryId}
                onChange={(next) => {
                  updateField("bogoBuyMode", next.mode);
                  updateField("bogoBuyProductId", next.productId);
                  updateField("bogoBuyCategoryId", next.categoryId);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">
                {t("promotions.form.bogo_get_set")}
              </Label>
              <BogoSetPicker
                storeId={storeId}
                side="get"
                mode={form.bogoGetMode}
                productId={form.bogoGetProductId}
                categoryId={form.bogoGetCategoryId}
                onChange={(next) => {
                  updateField("bogoGetMode", next.mode);
                  updateField("bogoGetProductId", next.productId);
                  updateField("bogoGetCategoryId", next.categoryId);
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {showDiscountSection && (
        <Card>
          <CardHeader>
            <CardTitle>{t("promotions.form.usage_limits_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="usage-total">
                  {t("promotions.form.usage_limit_total")}
                </Label>
                <Input
                  id="usage-total"
                  type="number"
                  min={1}
                  step={1}
                  value={form.usageLimitTotal}
                  onChange={(e) => updateField("usageLimitTotal", e.target.value)}
                  placeholder={t("promotions.form.usage_limit_uncapped") as string}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="usage-per-customer">
                  {t("promotions.form.usage_limit_per_customer")}
                </Label>
                <Input
                  id="usage-per-customer"
                  type="number"
                  min={1}
                  step={1}
                  value={form.usageLimitPerCustomer}
                  onChange={(e) =>
                    updateField("usageLimitPerCustomer", e.target.value)
                  }
                  placeholder={t("promotions.form.usage_limit_uncapped") as string}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("promotions.form.usage_limits_help")}
            </p>
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
