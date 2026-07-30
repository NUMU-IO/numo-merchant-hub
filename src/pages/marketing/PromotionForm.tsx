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

import { useEffect, useMemo, useRef, useState } from "react";
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
  currencyLabel,
  majorToMinor,
  minorToMajorInput,
} from "@/lib/format-money";
import {
  buildVisualContent,
  buildVisualTranslations,
  EMPTY_VISUAL_CONTENT,
  VisualContentPanel,
  type VisualContentState,
} from "@/components/marketing/VisualContentPanel";
import { BogoSetPicker } from "@/components/marketing/BogoSetPicker";
import { PromotionRulePreview } from "@/components/marketing/PromotionRulePreview";
import {
  RuleTemplateRow,
  type RuleTemplate,
} from "@/components/marketing/RuleTemplateRow";

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
 * One row of a tiered discount: "spend X, get Y% off". `threshold` is in the
 * store's MAJOR units, like every money input on this form — `buildDiscountRule`
 * converts it to the API's `threshold_cents`. Both are strings so the user can
 * clear an input mid-edit without committing NaN.
 */
interface TierFormRow {
  threshold: string;
  percent: string;
}

/** BOGO buy-set / get-set picker mode. */
type BogoSetMode = "any" | "product" | "category";

interface FormState {
  name: string;
  code: string;
  ruleKind: DiscountRuleKind;
  valuePercent: string;
  valueAmount: string;
  minSubtotalAmount: string;
  maxDiscountAmount: string;
  // BOGO fields — only sent when ruleKind === "bogo".
  // `getDiscountPercent` defaults to 100 (= "free") on first paint
  // because that's the most common BOGO shape; merchant can lower it
  // (e.g. "buy 2 get 1 50% off") without having to re-type the value.
  buyQuantity: string;
  getQuantity: string;
  getDiscountPercent: string;
  // BOGO targeting — "Customer buys" + "Customer gets" sets. The mode picks
  // how the set is defined; only the matching id list is sent. Multi-select:
  // the engine unions every id across a role's targets, so several products
  // or several categories per role all work.
  bogoBuyMode: BogoSetMode;
  bogoBuyProductIds: string[];
  bogoBuyCategoryIds: string[];
  bogoGetMode: BogoSetMode;
  bogoGetProductIds: string[];
  bogoGetCategoryIds: string[];
  // MULTIBUY fields — "any N eligible items for a fixed total P".
  // `multibuyPrice` is the price of the WHOLE group, not per item.
  multibuyQuantity: string;
  multibuyPrice: string;
  // Which products/categories can form a group. Reuses the BOGO set picker,
  // but multibuy has only one set (there's no separate give-away side), sent
  // with role "buy_set". Mode "any" = the whole catalogue is eligible.
  multibuyEligibleMode: BogoSetMode;
  multibuyEligibleProductIds: string[];
  multibuyEligibleCategoryIds: string[];
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
  valueAmount: "",
  minSubtotalAmount: "",
  maxDiscountAmount: "",
  buyQuantity: "",
  getQuantity: "",
  getDiscountPercent: "100",
  bogoBuyMode: "any",
  bogoBuyProductIds: [],
  bogoBuyCategoryIds: [],
  bogoGetMode: "any",
  bogoGetProductIds: [],
  bogoGetCategoryIds: [],
  multibuyQuantity: "",
  multibuyPrice: "",
  multibuyEligibleMode: "any",
  multibuyEligibleProductIds: [],
  multibuyEligibleCategoryIds: [],
  tiers: [{ threshold: "", percent: "" }],
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
  const { t, i18n } = useTranslation();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editingId } = useParams<{ id: string }>();
  const isEdit = !!editingId;

  // Every money label on this form names the store's OWN currency — inherited
  // from the platform's single source (StoreProvider pushes the active store's
  // `default_currency` into format-money), never hardcoded. A Saudi merchant
  // must not be asked to price a bundle in EGP.
  const currency = currencyLabel(
    currentStore?.default_currency,
    i18n.language === "ar" ? "ar" : "en",
  );

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
  // Tracks which promotion id the edit form has already hydrated, so a
  // background refetch can't clobber in-progress edits (see the hydrate
  // effect below).
  const hydratedIdRef = useRef<string | null>(null);

  // Hydrate form when editing an existing promotion.
  useEffect(() => {
    if (!isEdit || !promotionQuery.data) return;
    const promo = promotionQuery.data;
    // Hydrate the form ONCE per promotion id. React Query refetches the
    // promotion on window-focus/reconnect/staleness; without this guard a
    // refetch mid-edit re-runs setForm() and silently reverts the user's
    // in-progress changes to the saved values (e.g. typing 21% then a
    // refetch snaps it back to the stored 17%). Re-hydrate only if the id
    // actually changes (navigating to a different discount).
    if (hydratedIdRef.current === promo.id) return;
    hydratedIdRef.current = promo.id;
    const audience = promo.targets.find((t) => t.target_kind === "audience");
    const enLabel = promo.translations?.en?.label?.en ?? "";
    const arLabel = promo.translations?.ar?.label?.ar ?? "";
    const savedTiers = promo.discount_rule?.tiers ?? [];
    // Decompose role-tagged BOGO targets back into the form shape.
    // Every id per role — the picker is multi-select, and the engine unions
    // all ids in a role's target when it builds the line filter.
    const buyTarget = promo.targets.find((t) => t.role === "buy_set");
    const getTarget = promo.targets.find((t) => t.role === "get_set");
    // Read EVERY id, not just the first. Reading `ids[0]` meant a promotion
    // scoped to several categories (only creatable via the API before the
    // picker went multi-select) silently lost all but one the next time a
    // merchant pressed Save here — the offer's reach quietly shrank.
    const decomposeBogoTarget = (
      target: typeof buyTarget,
    ): { mode: BogoSetMode; productIds: string[]; categoryIds: string[] } => {
      if (!target) return { mode: "any", productIds: [], categoryIds: [] };
      if (target.target_kind === "product") {
        const ids = (target.target_value as { product_ids?: string[] }).product_ids;
        return { mode: "product", productIds: ids ?? [], categoryIds: [] };
      }
      if (target.target_kind === "category") {
        const ids = (target.target_value as { category_ids?: string[] })
          .category_ids;
        return { mode: "category", productIds: [], categoryIds: ids ?? [] };
      }
      return { mode: "any", productIds: [], categoryIds: [] };
    };
    const buyHydrated = decomposeBogoTarget(buyTarget);
    const getHydrated = decomposeBogoTarget(getTarget);
    setForm({
      name: promo.name,
      code: "",
      ruleKind: (promo.discount_rule?.kind ?? "percentage") as DiscountRuleKind,
      valuePercent: promo.discount_rule?.value_percent?.toString() ?? "",
      // Money: minor units on the wire → major units in the inputs. This and
      // `buildDiscountRule` are the ONLY two places the conversion happens.
      valueAmount: minorToMajorInput(promo.discount_rule?.value_cents),
      minSubtotalAmount: minorToMajorInput(
        promo.discount_rule?.min_subtotal_cents,
      ),
      maxDiscountAmount: minorToMajorInput(
        promo.discount_rule?.max_discount_cents,
      ),
      buyQuantity: promo.discount_rule?.buy_quantity?.toString() ?? "",
      getQuantity: promo.discount_rule?.get_quantity?.toString() ?? "",
      getDiscountPercent:
        promo.discount_rule?.get_discount_percent?.toString() ?? "100",
      bogoBuyMode: buyHydrated.mode,
      bogoBuyProductIds: buyHydrated.productIds,
      bogoBuyCategoryIds: buyHydrated.categoryIds,
      bogoGetMode: getHydrated.mode,
      bogoGetProductIds: getHydrated.productIds,
      bogoGetCategoryIds: getHydrated.categoryIds,
      multibuyQuantity: promo.discount_rule?.multibuy_quantity?.toString() ?? "",
      multibuyPrice: minorToMajorInput(
        promo.discount_rule?.multibuy_price_cents,
      ),
      // Multibuy scopes with the same `buy_set` role BOGO uses, so the saved
      // target decomposes identically — reuse the hydrated buy set.
      multibuyEligibleMode: buyHydrated.mode,
      multibuyEligibleProductIds: buyHydrated.productIds,
      multibuyEligibleCategoryIds: buyHydrated.categoryIds,
      tiers:
        savedTiers.length > 0
          ? savedTiers.map((row) => ({
              threshold: minorToMajorInput(row.threshold_cents),
              percent: row.percent.toString(),
            }))
          : [{ threshold: "", percent: "" }],
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
        barGradientTo: (c.background_gradient_to as string) ?? "",
        barFontSize:
          (c.font_size as VisualContentState["barFontSize"]) ??
          EMPTY_VISUAL_CONTENT.barFontSize,
        barTextAlign:
          (c.text_align as VisualContentState["barTextAlign"]) ??
          EMPTY_VISUAL_CONTENT.barTextAlign,
        barAnimation:
          (c.animation as VisualContentState["barAnimation"]) ??
          EMPTY_VISUAL_CONTENT.barAnimation,
        headlineEn: enT?.headline?.en ?? "",
        headlineAr: arT?.headline?.ar ?? "",
        bodyEn: enT?.body?.en ?? "",
        bodyAr: arT?.body?.ar ?? "",
        ctaLabelEn: enT?.cta_label?.en ?? "",
        ctaLabelAr: arT?.cta_label?.ar ?? "",
        ctaUrl: savedCtaUrl,
        autoApplyCode: (c.auto_apply_code as string) ?? "",
        popupContentMode: c.layout === "custom" ? "custom" : "template",
        popupCustomHtml: (c.custom_html as string) ?? "",
        popupLayout:
          c.layout === "centered" || c.layout === "side"
            ? c.layout
            : EMPTY_VISUAL_CONTENT.popupLayout,
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

  /**
   * The form's ONE money boundary: every input below holds major units
   * (650), the API takes minor units (65000). Nothing between the two
   * multiplies or divides — a second conversion site is how a 100x
   * mispricing gets in.
   */
  const buildDiscountRule = (): DiscountRule => {
    const rule: DiscountRule = { kind: form.ruleKind };
    if (form.ruleKind === "percentage") {
      rule.value_percent = Number(form.valuePercent) || 0;
    } else if (form.ruleKind === "fixed") {
      rule.value_cents = majorToMinor(form.valueAmount) ?? 0;
    } else if (form.ruleKind === "bogo") {
      // The API's domain validator requires both quantities; the form
      // validator catches missing values before we get here, but we
      // still parse defensively so `Number("") || 1` doesn't ship a
      // misconfigured rule on a stale state.
      rule.buy_quantity = Number(form.buyQuantity) || 1;
      rule.get_quantity = Number(form.getQuantity) || 1;
      rule.get_discount_percent = Number(form.getDiscountPercent || "100");
    } else if (form.ruleKind === "multibuy") {
      // Both are required by the domain validator (N >= 2, P > 0); the form
      // validator blocks bad values before we get here, but parse defensively
      // so a stale state can't ship a rule the API will reject.
      rule.multibuy_quantity = Number(form.multibuyQuantity) || 0;
      rule.multibuy_price_cents = majorToMinor(form.multibuyPrice) ?? 0;
    } else if (form.ruleKind === "tiered") {
      rule.tiers = form.tiers
        .map((row) => ({
          threshold_cents: majorToMinor(row.threshold) ?? 0,
          percent: Number(row.percent) || 0,
        }))
        // Drop any tier the merchant left blank.
        .filter((t) => t.threshold_cents > 0 || t.percent > 0);
    }
    if (form.minSubtotalAmount)
      rule.min_subtotal_cents = majorToMinor(form.minSubtotalAmount) ?? 0;
    if (form.maxDiscountAmount)
      rule.max_discount_cents = majorToMinor(form.maxDiscountAmount) ?? 0;
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
    // One target row per role, carrying EVERY selected id — the engine unions
    // them when it builds the line filter.
    const pushSet = (
      mode: BogoSetMode,
      productIds: string[],
      categoryIds: string[],
      role: "buy_set" | "get_set",
    ) => {
      if (mode === "product" && productIds.length > 0) {
        targets!.push({
          target_kind: "product",
          target_value: { product_ids: productIds },
          inclusion: true,
          role,
        });
      } else if (mode === "category" && categoryIds.length > 0) {
        targets!.push({
          target_kind: "category",
          target_value: { category_ids: categoryIds },
          inclusion: true,
          role,
        });
      }
    };

    if (form.ruleKind === "bogo") {
      pushSet(
        form.bogoBuyMode,
        form.bogoBuyProductIds,
        form.bogoBuyCategoryIds,
        "buy_set",
      );
      pushSet(
        form.bogoGetMode,
        form.bogoGetProductIds,
        form.bogoGetCategoryIds,
        "get_set",
      );
    }
    // Multibuy's eligible set. One set only — there's no give-away side —
    // and it MUST carry role "buy_set": an untagged catalog target is an
    // eligibility GATE, which would let the offer apply to the whole cart
    // whenever one eligible item is present. Mode "any" emits nothing, which
    // the engine reads as "every product qualifies".
    if (form.ruleKind === "multibuy") {
      pushSet(
        form.multibuyEligibleMode,
        form.multibuyEligibleProductIds,
        form.multibuyEligibleCategoryIds,
        "buy_set",
      );
    }
    return targets;
  };

  /** One-click prefill from a `RuleTemplateRow` chip. Doesn't touch the
   *  set-targeting pickers or usage limits — those stay where the
   *  merchant set them so a re-pick doesn't undo manual work. */
  const applyRuleTemplate = (tpl: RuleTemplate) => {
    setForm((prev) => ({
      ...prev,
      ruleKind: tpl.ruleKind,
      buyQuantity: tpl.buyQuantity ?? "",
      getQuantity: tpl.getQuantity ?? "",
      getDiscountPercent: tpl.getDiscountPercent ?? "100",
      valuePercent: tpl.valuePercent ?? "",
      valueAmount: tpl.valueAmount ?? "",
      multibuyQuantity: tpl.multibuyQuantity ?? "",
      multibuyPrice: tpl.multibuyPrice ?? "",
      tiers:
        tpl.tiers && tpl.tiers.length > 0
          ? tpl.tiers
          : [{ threshold: "", percent: "" }],
    }));
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
      if (form.ruleKind === "fixed") {
        // `!Number("-5")` is false, so a negative amount used to pass this
        // gate and ship `value_cents: -500` — a discount that ADDS money.
        // Check the converted value, positive, explicitly.
        const v = majorToMinor(form.valueAmount);
        if (v == null || v <= 0)
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
      if (form.ruleKind === "multibuy") {
        const n = Number(form.multibuyQuantity);
        // N >= 2: a group of one is a per-unit price, not a bundle — and the
        // API's domain validator rejects it, so catch it here with a message
        // the merchant can act on. Integer check because the API takes `int`,
        // so a pasted "3.5" 422s server-side with a raw pydantic message
        // ("Input should be a valid integer") after the preview has already
        // quoted the merchant a discount for it.
        if (!n || n < 2 || !Number.isInteger(n))
          return t("promotions.errors.multibuy_quantity_required") as string;
        // The price is typed in major units, so "650.50" is legitimate — it is
        // the CONVERTED value that has to be a positive integer, and
        // `majorToMinor` rounds to make it one. Only blank/zero/garbage fails.
        const p = majorToMinor(form.multibuyPrice);
        if (p == null || p <= 0)
          return t("promotions.errors.multibuy_price_required") as string;
      }
      if (form.ruleKind === "tiered") {
        const realRows = form.tiers.filter(
          (r) => r.threshold.trim() !== "" && r.percent.trim() !== "",
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
        // 1) Create the underlying coupon. The Coupon API only knows
        //    three types (percentage / fixed / free_shipping) and
        //    validates `value` accordingly. For richer promotion rules
        //    (BOGO, tiered) the *promotion's* `discount_rule` does the
        //    actual math and the coupon is just a code holder — we
        //    submit a benign placeholder shape so the API accepts it.
        let couponType: "percentage" | "fixed" | "free_shipping";
        let couponValue: number;
        if (form.ruleKind === "fixed") {
          couponType = "fixed";
          // The Coupon API speaks MAJOR units (`value` is a decimal string),
          // and so does this form's input — so the value passes straight
          // through. It used to be divided by 100 because the input held
          // cents; keeping that divide after the major-unit switch would
          // have turned an "EGP 100 off" code into "EGP 1 off".
          couponValue = Number(form.valueAmount);
        } else if (form.ruleKind === "free_shipping") {
          couponType = "free_shipping";
          couponValue = 0;
        } else if (form.ruleKind === "percentage") {
          couponType = "percentage";
          couponValue = Number(form.valuePercent);
        } else {
          // BOGO / tiered / anything new. Backend only has 3 coupon
          // types; pick `fixed` with a minimal-but-legal value (1 unit)
          // so it passes `value > 0` validation. The promotion's
          // `discount_rule` overrides this at calculation time.
          couponType = "fixed";
          couponValue = 1;
        }

        // Backend rejects `max_discount_amount <= 0` and `min_order_amount < 0`.
        // The merchant form's text inputs can produce the string "0"
        // (truthy in JS), which previously slipped through the `? :`
        // check and sent zero. Treat empty *or* zero as null (uncapped /
        // no minimum).
        //
        // Both figures are MAJOR units on this API too (decimal strings), and
        // the inputs now hold major units — so no conversion. The promotion's
        // own `discount_rule` is the one that carries minor units, and that
        // conversion lives in `buildDiscountRule` alone.
        const minSubtotal = Number(form.minSubtotalAmount);
        const maxDiscount = Number(form.maxDiscountAmount);
        const couponData: CreateCouponData = {
          code: form.code.toUpperCase(),
          coupon_type: couponType,
          value: couponValue,
          min_order_amount:
            form.minSubtotalAmount.trim() && minSubtotal > 0
              ? minSubtotal
              : null,
          max_discount_amount:
            form.maxDiscountAmount.trim() && maxDiscount > 0
              ? maxDiscount
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
    () => ["percentage", "fixed", "free_shipping", "bogo", "tiered", "multibuy"],
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
          <RuleTemplateRow onApply={applyRuleTemplate} />
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
              <Label htmlFor="rule-amount">
                {t("promotions.form.fixed_label", { currency })}
              </Label>
              <Input
                id="rule-amount"
                type="number"
                min={0}
                step="0.01"
                value={form.valueAmount}
                onChange={(e) => updateField("valueAmount", e.target.value)}
                required
              />
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
          {form.ruleKind === "multibuy" && (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="rule-multibuy-qty">
                    {t("promotions.form.multibuy_quantity")}
                  </Label>
                  <Input
                    id="rule-multibuy-qty"
                    type="number"
                    min={2}
                    step={1}
                    value={form.multibuyQuantity}
                    onChange={(e) =>
                      updateField("multibuyQuantity", e.target.value)
                    }
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rule-multibuy-price">
                    {t("promotions.form.multibuy_price", { currency })}
                  </Label>
                  <Input
                    id="rule-multibuy-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.multibuyPrice}
                    onChange={(e) =>
                      updateField("multibuyPrice", e.target.value)
                    }
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("promotions.form.multibuy_help", { currency })}
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
                        {t("promotions.form.tier_threshold", { currency })}
                      </Label>
                      <Input
                        id={`tier-thresh-${idx}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.threshold}
                        onChange={(e) => {
                          const next = [...form.tiers];
                          next[idx] = {
                            ...next[idx],
                            threshold: e.target.value,
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
                    { threshold: "", percent: "" },
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
                {t("promotions.form.min_subtotal", { currency })}
              </Label>
              <Input
                id="rule-min"
                type="number"
                min={0}
                step="0.01"
                value={form.minSubtotalAmount}
                onChange={(e) =>
                  updateField("minSubtotalAmount", e.target.value)
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rule-max">
                {t("promotions.form.max_discount", { currency })}
              </Label>
              <Input
                id="rule-max"
                type="number"
                min={0}
                step="0.01"
                value={form.maxDiscountAmount}
                onChange={(e) =>
                  updateField("maxDiscountAmount", e.target.value)
                }
              />
            </div>
          </div>
          <PromotionRulePreview rule={buildDiscountRule()} />
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
                productIds={form.bogoBuyProductIds}
                categoryIds={form.bogoBuyCategoryIds}
                onChange={(next) => {
                  updateField("bogoBuyMode", next.mode);
                  updateField("bogoBuyProductIds", next.productIds);
                  updateField("bogoBuyCategoryIds", next.categoryIds);
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
                productIds={form.bogoGetProductIds}
                categoryIds={form.bogoGetCategoryIds}
                onChange={(next) => {
                  updateField("bogoGetMode", next.mode);
                  updateField("bogoGetProductIds", next.productIds);
                  updateField("bogoGetCategoryIds", next.categoryIds);
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {showDiscountSection && form.ruleKind === "multibuy" && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t("promotions.form.multibuy_targeting_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-base">
                {t("promotions.form.multibuy_eligible_set")}
              </Label>
              {/* Same picker as BOGO's buy side — the target is emitted with
                  role "buy_set", which the engine reads as multibuy's
                  eligible set. */}
              <BogoSetPicker
                storeId={storeId}
                side="eligible"
                mode={form.multibuyEligibleMode}
                productIds={form.multibuyEligibleProductIds}
                categoryIds={form.multibuyEligibleCategoryIds}
                onChange={(next) => {
                  updateField("multibuyEligibleMode", next.mode);
                  updateField("multibuyEligibleProductIds", next.productIds);
                  updateField("multibuyEligibleCategoryIds", next.categoryIds);
                }}
              />
              <p className="text-xs text-muted-foreground">
                {t("promotions.form.multibuy_eligible_help")}
              </p>
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
