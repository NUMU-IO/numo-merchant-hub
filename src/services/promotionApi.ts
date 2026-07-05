/**
 * Promotion API service for the merchant dashboard.
 *
 * Mirrors the backend routes under /api/v1/stores/{storeId}/promotions/*
 * (NUMU-api PR #240). The shape names match the backend DTOs exactly so
 * `openapi-typescript` regenerations stay diff-free.
 */

import { apiClient } from "./api";

// --------------------------------------------------------------------------
// Enums (mirror src/core/enums/promotion_enums.py)
// --------------------------------------------------------------------------

export type PromotionSurface =
  | "discount_code"
  | "automatic"
  | "announcement_bar"
  | "popup"
  | "floating_widget"
  | "cookie_banner";

export type PromotionStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "paused"
  | "expired"
  | "archived";

export type DisplayTrigger =
  | "on_load"
  | "on_delay"
  | "on_scroll_pct"
  | "on_exit_intent"
  | "on_add_to_cart"
  | "always";

export type DisplayFrequency =
  | "once_per_session"
  | "once_per_visitor"
  | "every_visit"
  | "until_dismissed"
  | "until_redeemed";

export type TargetKind =
  | "audience"
  | "product"
  | "category"
  | "customer_tag"
  | "geo";

export type DiscountRuleKind =
  | "percentage"
  | "fixed"
  | "free_shipping"
  | "bogo"
  | "tiered";

// --------------------------------------------------------------------------
// Value-object shapes
// --------------------------------------------------------------------------

export interface DiscountTier {
  threshold_cents: number;
  percent: number;
}

export interface DiscountRule {
  kind: DiscountRuleKind;
  value_cents?: number | null;
  value_percent?: number | null;
  min_subtotal_cents?: number | null;
  max_discount_cents?: number | null;
  buy_quantity?: number | null;
  get_quantity?: number | null;
  get_discount_percent?: number | null;
  tiers?: DiscountTier[];
}

/**
 * Surface-specific content payload. Carries a `surface` discriminator
 * matching the parent promotion.
 */
export type PromotionContent =
  | { surface: "discount_code" }
  | { surface: "automatic" }
  | {
      surface: "announcement_bar";
      background?: string;
      text_color?: string;
      icon?: string | null;
      dismissible?: boolean;
      link_url?: string | null;
      /** 2nd color → the bar background becomes a left→right gradient. */
      background_gradient_to?: string | null;
      font_size?: "sm" | "md" | "lg";
      text_align?: "start" | "center" | "end";
      animation?: "none" | "pulse" | "marquee";
      /** Coupon code auto-pinned to the cart when the shopper follows the CTA. */
      auto_apply_code?: string | null;
    }
  | {
      surface: "popup";
      // "custom" renders merchant-authored `custom_html` instead of the
      // templated headline/body/form (storefront sandboxes it in an iframe).
      layout?: "centered" | "side" | "custom";
      image_url?: string | null;
      // Legacy: older rows used a `form_fields` array; new builder
      // writes `collect_email` / `collect_phone` booleans instead.
      form_fields?: ("email" | "phone" | "name")[];
      /** True when the popup renders an inline lead-capture form. */
      collect_email?: boolean;
      /** Adds an Egyptian-phone field below email when true. */
      collect_phone?: boolean;
      discount_code_to_reveal?: string | null;
      show_after_dismiss_days?: number;
      /** Merchant-pasted HTML, used when `layout === "custom"`. */
      custom_html?: string | null;
      /** Coupon code auto-pinned to the cart when the shopper follows the CTA. */
      auto_apply_code?: string | null;
    }
  | {
      surface: "floating_widget";
      position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
      icon?: string;
      expanded_default?: boolean;
      color_bg?: string;
      /** Coupon code auto-pinned to the cart when the shopper follows the CTA. */
      auto_apply_code?: string | null;
    }
  | {
      surface: "cookie_banner";
      position?: "bottom" | "modal";
      accept_required?: boolean;
      policy_url?: string | null;
      preference_categories?: string[];
    };

export interface LocalizedPromotionContent {
  headline?: { en?: string | null; ar?: string | null } | null;
  body?: { en?: string | null; ar?: string | null } | null;
  cta_label?: { en?: string | null; ar?: string | null } | null;
  cta_url?: string | null;
  label?: { en?: string | null; ar?: string | null } | null;
  // Popup form-capture fields — read by the storefront's PopupModal
  // when `content.collect_email` is true. All four are localized.
  email_label?: { en?: string | null; ar?: string | null } | null;
  phone_label?: { en?: string | null; ar?: string | null } | null;
  consent_label?: { en?: string | null; ar?: string | null } | null;
  submit_label?: { en?: string | null; ar?: string | null } | null;
  success_headline?: { en?: string | null; ar?: string | null } | null;
  success_body?: { en?: string | null; ar?: string | null } | null;
}

export interface PromotionDisplayInput {
  trigger: DisplayTrigger;
  trigger_value?: Record<string, unknown>;
  frequency: DisplayFrequency;
  pages?: string[];
  device_targets?: string[];
  is_enabled?: boolean;
}

export interface PromotionDisplay extends PromotionDisplayInput {
  id: string;
}

export interface PromotionTargetInput {
  target_kind: TargetKind;
  target_value: Record<string, unknown>;
  inclusion?: boolean;
  /**
   * BOGO targeting role:
   *   • "buy_set"  — products / categories that count toward `buy_quantity`
   *   • "get_set"  — products / categories the discount is applied to
   *   • undefined  — global eligibility filter (existing semantics)
   *
   * Role-tagged targets bypass the eligibility checker and feed the
   * BOGO discount calculator's line filters instead.
   */
  role?: "buy_set" | "get_set" | null;
}

export interface PromotionTarget extends PromotionTargetInput {
  id: string;
}

export interface PromotionMetricsBlock {
  impressions: number;
  clicks: number;
  dismissals: number;
  redemptions: number;
  conversions: number;
  revenue_cents: number;
}

// --------------------------------------------------------------------------
// Promotion shapes
// --------------------------------------------------------------------------

export interface Promotion {
  id: string;
  tenant_id: string;
  store_id: string;
  name: string;
  surface: PromotionSurface;
  status: PromotionStatus;
  coupon_id: string | null;
  discount_rule: DiscountRule | null;
  content: Record<string, unknown>;
  translations: Record<string, LocalizedPromotionContent>;
  displays: PromotionDisplay[];
  targets: PromotionTarget[];
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  version: number;
  /**
   * Per-promotion usage caps, both nullable. Caps automatic promos
   * (BOGO, tiered, percent-off cart) where there's no Coupon row to
   * carry a usage_limit. The eligibility checker enforces them by
   * counting `convert` events.
   */
  usage_limit_total?: number | null;
  usage_limit_per_customer?: number | null;
  created_at: string;
  updated_at: string;
  metrics: PromotionMetricsBlock;
}

export interface PromotionListItem {
  id: string;
  name: string;
  surface: PromotionSurface;
  status: PromotionStatus;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  version: number;
  coupon_id: string | null;
  // Enriched for the Discounts table: the linked coupon's code + how many
  // times it's been used (null/0 for automatic discounts), and the discount
  // value itself.
  code?: string | null;
  usage_count?: number;
  discount_rule?: DiscountRule | null;
  created_at: string;
  updated_at: string;
}

export interface PromotionList {
  items: PromotionListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreatePromotionRequest {
  name: string;
  surface: PromotionSurface;
  status?: PromotionStatus;
  coupon_id?: string | null;
  discount_rule?: DiscountRule | null;
  content: PromotionContent;
  translations?: Record<string, LocalizedPromotionContent>;
  displays?: PromotionDisplayInput[];
  targets?: PromotionTargetInput[];
  priority?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  usage_limit_total?: number | null;
  usage_limit_per_customer?: number | null;
}

export interface UpdatePromotionRequest {
  version: number;
  name?: string;
  status?: PromotionStatus;
  coupon_id?: string | null;
  discount_rule?: DiscountRule | null;
  content?: PromotionContent;
  translations?: Record<string, LocalizedPromotionContent>;
  displays?: PromotionDisplayInput[];
  targets?: PromotionTargetInput[];
  usage_limit_total?: number | null;
  usage_limit_per_customer?: number | null;
  priority?: number;
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface ListPromotionsParams {
  status?: PromotionStatus;
  surface?: PromotionSurface;
  limit?: number;
  offset?: number;
}

export interface PromotionAnalytics {
  promotion_id: string;
  range_start: string;
  range_end: string;
  impressions: number;
  clicks: number;
  dismissals: number;
  redemptions: number;
  conversions: number;
  revenue_cents: number;
  discount_total_cents: number;
  by_day: {
    day: string;
    impressions: number;
    clicks: number;
    dismissals: number;
    redemptions: number;
    conversions: number;
    revenue_cents: number;
  }[];
  conversion_rate: number;
  impression_to_click_rate: number;
  generated_at: string;
}

// --------------------------------------------------------------------------
// API methods
//
// Every NUMU API response is shaped `{success, data, message}`, but the
// shared `apiClient` already unwraps the envelope and returns just the
// `data` payload (see services/api.ts — the line with
// `Object.prototype.hasOwnProperty.call(json, "data") ? json.data : json`).
//
// Earlier versions of this file typed the helper as
// `apiClient<SuccessEnvelope<T>>` and then did `.data` again, which
// silently bottomed out at `undefined` because the field accessed
// belonged to the *inner* T (e.g. `PromotionList`), not the envelope.
// That made every promotion query and mutation return `undefined`,
// which React Query rejects with "Query data cannot be undefined" and
// in the UI looked like "No promotions yet" even with rows in the DB.
//
// Fix: type apiClient with the *unwrapped* T and return its result
// directly. Matches the convention in productApi.ts / categoryApi.ts.
// --------------------------------------------------------------------------

function buildQs(params?: Record<string, unknown>): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export async function listPromotions(
  storeId: string,
  params?: ListPromotionsParams,
): Promise<PromotionList> {
  return apiClient<PromotionList>(
    `/stores/${storeId}/promotions${buildQs(params as Record<string, unknown>)}`,
  );
}

export async function getPromotion(
  storeId: string,
  promotionId: string,
): Promise<Promotion> {
  return apiClient<Promotion>(
    `/stores/${storeId}/promotions/${promotionId}`,
  );
}

export async function createPromotion(
  storeId: string,
  payload: CreatePromotionRequest,
): Promise<Promotion> {
  return apiClient<Promotion>(`/stores/${storeId}/promotions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePromotion(
  storeId: string,
  promotionId: string,
  payload: UpdatePromotionRequest,
): Promise<Promotion> {
  return apiClient<Promotion>(
    `/stores/${storeId}/promotions/${promotionId}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
}

export async function archivePromotion(
  storeId: string,
  promotionId: string,
): Promise<void> {
  await apiClient<void>(`/stores/${storeId}/promotions/${promotionId}`, {
    method: "DELETE",
  });
}

export async function activatePromotion(
  storeId: string,
  promotionId: string,
): Promise<Promotion> {
  return apiClient<Promotion>(
    `/stores/${storeId}/promotions/${promotionId}/activate`,
    { method: "POST" },
  );
}

export async function pausePromotion(
  storeId: string,
  promotionId: string,
): Promise<Promotion> {
  return apiClient<Promotion>(
    `/stores/${storeId}/promotions/${promotionId}/pause`,
    { method: "POST" },
  );
}

export async function archivePromotionExplicit(
  storeId: string,
  promotionId: string,
): Promise<Promotion> {
  return apiClient<Promotion>(
    `/stores/${storeId}/promotions/${promotionId}/archive`,
    { method: "POST" },
  );
}

export async function duplicatePromotion(
  storeId: string,
  promotionId: string,
): Promise<Promotion> {
  return apiClient<Promotion>(
    `/stores/${storeId}/promotions/${promotionId}/duplicate`,
    { method: "POST" },
  );
}

export async function getPromotionAnalytics(
  storeId: string,
  promotionId: string,
  params?: { range_start?: string; range_end?: string },
): Promise<PromotionAnalytics> {
  return apiClient<PromotionAnalytics>(
    `/stores/${storeId}/promotions/${promotionId}/analytics${buildQs(params)}`,
  );
}

export interface PreviewToken {
  token: string;
  expires_at: string;
  ttl_seconds: number;
}

/**
 * Issue a short-lived JWT for previewing draft promotions on the
 * storefront. Token lives for ~5 minutes — long enough to flip between
 * editor and the preview iframe a few times. The merchant hub appends
 * it as `?_npt=<token>` to the storefront URL; the storefront's Next.js
 * middleware bridges the URL param into a header the SSR fetch path
 * can read.
 */
export async function issuePreviewToken(storeId: string): Promise<PreviewToken> {
  return apiClient<PreviewToken>(
    `/stores/${storeId}/promotions/preview-token`,
    { method: "POST" },
  );
}

// --------------------------------------------------------------------------- //
// "Design by NUMU AI" — integrated AI promo-content generation                //
// --------------------------------------------------------------------------- //

export interface GeneratePromoContentPayload {
  surface: "announcement_bar" | "popup" | "floating_widget" | "cookie_banner";
  mode: "copy" | "html";
  brief?: string;
  store_name?: string;
  primary_color?: string | null;
  text_color?: string | null;
  cta_url?: string | null;
}

export interface GeneratedPromoContent {
  mode: "copy" | "html";
  headline_en?: string | null;
  headline_ar?: string | null;
  body_en?: string | null;
  body_ar?: string | null;
  cta_en?: string | null;
  cta_ar?: string | null;
  html?: string | null;
}

/** Generate promo content with the integrated AI (gpt-4o). Returns HTML for a
 *  custom popup, or short bilingual copy for banner / widget / cookie. */
export async function generatePromoContent(
  storeId: string,
  payload: GeneratePromoContentPayload,
): Promise<GeneratedPromoContent> {
  return apiClient<GeneratedPromoContent>(
    `/stores/${storeId}/ai/generate-promo-content`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}
