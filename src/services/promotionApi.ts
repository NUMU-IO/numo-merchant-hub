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
    }
  | {
      surface: "popup";
      layout?: "centered" | "side";
      image_url?: string | null;
      form_fields?: ("email" | "phone" | "name")[];
      discount_code_to_reveal?: string | null;
      show_after_dismiss_days?: number;
    }
  | {
      surface: "floating_widget";
      position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
      icon?: string;
      expanded_default?: boolean;
      color_bg?: string;
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
// --------------------------------------------------------------------------

interface SuccessEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

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
  const res = await apiClient<SuccessEnvelope<PromotionList>>(
    `/stores/${storeId}/promotions${buildQs(params as Record<string, unknown>)}`,
  );
  return res.data;
}

export async function getPromotion(
  storeId: string,
  promotionId: string,
): Promise<Promotion> {
  const res = await apiClient<SuccessEnvelope<Promotion>>(
    `/stores/${storeId}/promotions/${promotionId}`,
  );
  return res.data;
}

export async function createPromotion(
  storeId: string,
  payload: CreatePromotionRequest,
): Promise<Promotion> {
  const res = await apiClient<SuccessEnvelope<Promotion>>(
    `/stores/${storeId}/promotions`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  return res.data;
}

export async function updatePromotion(
  storeId: string,
  promotionId: string,
  payload: UpdatePromotionRequest,
): Promise<Promotion> {
  const res = await apiClient<SuccessEnvelope<Promotion>>(
    `/stores/${storeId}/promotions/${promotionId}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  return res.data;
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
  const res = await apiClient<SuccessEnvelope<Promotion>>(
    `/stores/${storeId}/promotions/${promotionId}/activate`,
    { method: "POST" },
  );
  return res.data;
}

export async function pausePromotion(
  storeId: string,
  promotionId: string,
): Promise<Promotion> {
  const res = await apiClient<SuccessEnvelope<Promotion>>(
    `/stores/${storeId}/promotions/${promotionId}/pause`,
    { method: "POST" },
  );
  return res.data;
}

export async function archivePromotionExplicit(
  storeId: string,
  promotionId: string,
): Promise<Promotion> {
  const res = await apiClient<SuccessEnvelope<Promotion>>(
    `/stores/${storeId}/promotions/${promotionId}/archive`,
    { method: "POST" },
  );
  return res.data;
}

export async function duplicatePromotion(
  storeId: string,
  promotionId: string,
): Promise<Promotion> {
  const res = await apiClient<SuccessEnvelope<Promotion>>(
    `/stores/${storeId}/promotions/${promotionId}/duplicate`,
    { method: "POST" },
  );
  return res.data;
}

export async function getPromotionAnalytics(
  storeId: string,
  promotionId: string,
  params?: { range_start?: string; range_end?: string },
): Promise<PromotionAnalytics> {
  const res = await apiClient<SuccessEnvelope<PromotionAnalytics>>(
    `/stores/${storeId}/promotions/${promotionId}/analytics${buildQs(params)}`,
  );
  return res.data;
}
