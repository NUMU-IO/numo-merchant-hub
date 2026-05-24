/**
 * Marketing-campaign API service for the merchant dashboard.
 *
 * Wraps the backend's /stores/{id}/marketing/campaigns/* endpoints,
 * plus the feature-001 additions:
 *   - POST .../{campaign_id}/trackable-link
 *   - POST /stores/{id}/storefront/validate-path
 *
 * Mirrors the apiClient pattern from couponApi.ts — the wrapper
 * automatically unwraps {data: T} responses, handles 401 refresh, and
 * attaches CSRF on state-changing requests.
 */

import { apiClient } from "./api";

// ── Domain types ────────────────────────────────────────────────────

export type CampaignChannel = "email" | "sms";

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "completed"
  | "failed"
  | "canceled";

export interface Campaign {
  id: string;
  channel: string;
  name: string;
  status: string;
  template_id: string | null;
  inline_subject: string | null;
  inline_body: string | null;
  segment_id: string | null;
  audience_filter: Record<string, unknown> | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  canceled_at: string | null;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignData {
  channel: CampaignChannel;
  name: string;
  template_id?: string | null;
  inline_subject?: string | null;
  inline_body?: string | null;
  segment_id?: string | null;
  audience_filter?: Record<string, unknown> | null;
  scheduled_at?: string | null;
  note?: string | null;
}

export interface UpdateCampaignData {
  name?: string | null;
  template_id?: string | null;
  inline_subject?: string | null;
  inline_body?: string | null;
  segment_id?: string | null;
  audience_filter?: Record<string, unknown> | null;
  note?: string | null;
}

export interface ListCampaignsParams {
  status?: CampaignStatus;
  channel?: CampaignChannel;
}

// ── Trackable link ──────────────────────────────────────────────────

export type TrackableLinkDestinationKind =
  | "homepage"
  | "collection"
  | "product"
  | "custom";

export type TrackableLinkSource =
  | "facebook"
  | "instagram"
  | "whatsapp"
  | "email"
  | "tiktok"
  | "sms"
  | "qr"
  | "other";

export interface TrackableLinkDestination {
  kind: TrackableLinkDestinationKind;
  collection_slug?: string | null;
  product_id?: string | null;
  custom_path?: string | null;
}

export interface TrackableLinkRequest {
  destination: TrackableLinkDestination;
  source: TrackableLinkSource;
  medium?: string | null;
  term?: string | null;
  content?: string | null;
  /**
   * Opt in to also creating a /r/{short_code} short link.
   * Server only mints one when this flag is true; defaults to false
   * so existing callers keep their behaviour.
   */
  with_short_link?: boolean;
}

export interface TrackableLinkDestinationResponse {
  kind: string;
  product_id?: string | null;
  collection_slug?: string | null;
  resolved_path: string;
}

export interface TrackableLinkResponse {
  url: string;
  /** Base64-encoded PNG (512×512, error-correction level M). */
  qr_png_base64: string;
  short_code: string;
  campaign_slug: string;
  destination: TrackableLinkDestinationResponse;
  /**
   * Short URL of the form ``https://numueg.app/r/{short_url_code}``.
   * Null when the request didn't opt in via ``with_short_link``.
   */
  short_url?: string | null;
  /** 8-char Crockford base32 identifier; null when no short link was minted. */
  short_url_code?: string | null;
}

// ── Path validator ──────────────────────────────────────────────────

export type ValidatePathReason =
  | "path_malformed"
  | "path_not_found"
  | "validation_timeout"
  | "external_host"
  | "internal_target";

export interface ValidatePathRequest {
  path: string;
}

export interface ValidatePathResponse {
  valid: boolean;
  reason?: ValidatePathReason | null;
  canonical_path?: string | null;
  /** Set when the path 301/302/308s within the same host. */
  suggested_canonical?: string | null;
  http_status?: number | null;
}

// ── Endpoints ───────────────────────────────────────────────────────

const _ROOT = (storeId: string) => `/stores/${storeId}/marketing/campaigns`;

export async function listCampaigns(
  storeId: string,
  params?: ListCampaignsParams,
): Promise<Campaign[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.channel) qs.set("channel", params.channel);
  const query = qs.toString();
  return apiClient<Campaign[]>(
    `${_ROOT(storeId)}${query ? `?${query}` : ""}`,
  );
}

export async function getCampaign(
  storeId: string,
  campaignId: string,
): Promise<Campaign> {
  return apiClient<Campaign>(`${_ROOT(storeId)}/${campaignId}`);
}

export async function createCampaign(
  storeId: string,
  data: CreateCampaignData,
): Promise<Campaign> {
  return apiClient<Campaign>(_ROOT(storeId), {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCampaign(
  storeId: string,
  campaignId: string,
  data: UpdateCampaignData,
): Promise<Campaign> {
  return apiClient<Campaign>(`${_ROOT(storeId)}/${campaignId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function scheduleCampaign(
  storeId: string,
  campaignId: string,
  scheduledAt: string,
): Promise<Campaign> {
  return apiClient<Campaign>(`${_ROOT(storeId)}/${campaignId}/schedule`, {
    method: "POST",
    body: JSON.stringify({ scheduled_at: scheduledAt }),
  });
}

export async function cancelCampaign(
  storeId: string,
  campaignId: string,
): Promise<Campaign> {
  return apiClient<Campaign>(`${_ROOT(storeId)}/${campaignId}/cancel`, {
    method: "POST",
  });
}

export async function sendCampaignNow(
  storeId: string,
  campaignId: string,
): Promise<Campaign> {
  return apiClient<Campaign>(`${_ROOT(storeId)}/${campaignId}/send-now`, {
    method: "POST",
  });
}

/** Produce a trackable URL + QR PNG for a campaign. */
export async function generateTrackableLink(
  storeId: string,
  campaignId: string,
  data: TrackableLinkRequest,
): Promise<TrackableLinkResponse> {
  return apiClient<TrackableLinkResponse>(
    `${_ROOT(storeId)}/${campaignId}/trackable-link`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

/** Validate a custom storefront path before producing a trackable link. */
export async function validatePath(
  storeId: string,
  path: string,
): Promise<ValidatePathResponse> {
  return apiClient<ValidatePathResponse>(
    `/stores/${storeId}/storefront/validate-path`,
    {
      method: "POST",
      body: JSON.stringify({ path }),
    },
  );
}

// ── Performance (US3) ───────────────────────────────────────────────

export interface CampaignConversionRates {
  session_to_atc: number;
  atc_to_checkout: number;
  checkout_to_order: number;
  session_to_order: number;
}

export interface CampaignTopProduct {
  product_id: string | null;
  name: string | null;
  orders: number;
  revenue_cents: number;
}

export interface CouponRedemptionBreakdownItem {
  code: string;
  redemptions: number;
  discount_value_cents: number;
  revenue_cents: number;
  /** True when the code was minted via POST /campaigns/{id}/coupons. */
  campaign_issued: boolean;
}

export interface CampaignPerformanceTotals {
  sessions: number;
  product_views: number;
  add_to_cart: number;
  checkout_started: number;
  orders: number;
  revenue_cents: number;
  average_order_value_cents: number;
  conversion_rates: CampaignConversionRates;
  top_products: CampaignTopProduct[];
  // Post-feature-001: coupon redemption stats for this campaign window.
  // Defaults to 0 / [] when no campaign-attributed orders redeemed
  // any coupon code.
  coupon_redemptions: number;
  coupon_discount_value_cents: number;
  coupon_breakdown: CouponRedemptionBreakdownItem[];
}

export interface CampaignPerformanceResponse {
  campaign_id: string;
  campaign_name: string;
  short_code: string;
  date_from: string;
  date_to: string;
  totals: CampaignPerformanceTotals;
}

// ── Campaign-attached coupons ───────────────────────────────────────

export interface IssueCampaignCouponRequest {
  coupon_type: "percentage" | "fixed";
  value: number;
  min_order_amount?: number | null;
  max_discount_amount?: number | null;
  usage_limit?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
}

export interface CampaignCouponResponse {
  id: string;
  code: string;
  coupon_type: string;
  value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  usage_limit: number | null;
  usage_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  campaign_id: string | null;
  created_at: string;
}

export async function issueCampaignCoupon(
  storeId: string,
  campaignId: string,
  data: IssueCampaignCouponRequest,
): Promise<CampaignCouponResponse> {
  return apiClient<CampaignCouponResponse>(
    `${_ROOT(storeId)}/${campaignId}/coupons`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export async function listCampaignCoupons(
  storeId: string,
  campaignId: string,
): Promise<CampaignCouponResponse[]> {
  return apiClient<CampaignCouponResponse[]>(
    `${_ROOT(storeId)}/${campaignId}/coupons`,
  );
}

/** Aggregated per-campaign performance over a date range. */
export async function getCampaignPerformance(
  storeId: string,
  campaignId: string,
  dateFrom: string,
  dateTo: string,
): Promise<CampaignPerformanceResponse> {
  const qs = new URLSearchParams({
    date_from: dateFrom,
    date_to: dateTo,
  }).toString();
  return apiClient<CampaignPerformanceResponse>(
    `${_ROOT(storeId)}/${campaignId}/performance?${qs}`,
  );
}

// ── Per-campaign breakdowns (feature 002 US3) ──────────────────────

export type AttributionModelName =
  | "last_touch"
  | "first_touch"
  | "linear"
  | "time_decay"
  | "position_based";

export interface CampaignChannelRow {
  channel: string;
  sessions: number;
  sales_cents: number;
}

export interface CampaignBreakdownChannel {
  campaign_id: string;
  date_from: string;
  date_to: string;
  attribution_model: AttributionModelName;
  channels: CampaignChannelRow[];
}

export interface CampaignUtmComboRow {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  sessions: number;
  sales_cents: number;
}

export interface CampaignBreakdownUtm {
  campaign_id: string;
  date_from: string;
  date_to: string;
  attribution_model: AttributionModelName;
  combos: CampaignUtmComboRow[];
}

export interface CampaignBreakdownCustomerType {
  campaign_id: string;
  date_from: string;
  date_to: string;
  attribution_model: AttributionModelName;
  new_customers: { orders: number; sales_cents: number };
  returning_customers: { orders: number; sales_cents: number };
}

export interface CampaignOrderSizeBin {
  lower_cents: number;
  upper_cents: number | null;
  orders: number;
}

export interface CampaignBreakdownOrderSize {
  campaign_id: string;
  date_from: string;
  date_to: string;
  attribution_model: AttributionModelName;
  bins: CampaignOrderSizeBin[];
}

export interface CampaignDeviceRow {
  device: string;
  sessions: number;
}

export interface CampaignBreakdownDevice {
  campaign_id: string;
  date_from: string;
  date_to: string;
  attribution_model: AttributionModelName;
  devices: CampaignDeviceRow[];
}

function _breakdownQS(
  dateFrom: string,
  dateTo: string,
  attributionModel: AttributionModelName,
  extra: Record<string, string> = {},
): string {
  return new URLSearchParams({
    date_from: dateFrom,
    date_to: dateTo,
    attribution_model: attributionModel,
    ...extra,
  }).toString();
}

export async function getCampaignBreakdownChannel(
  storeId: string,
  campaignId: string,
  dateFrom: string,
  dateTo: string,
  attributionModel: AttributionModelName = "last_touch",
): Promise<CampaignBreakdownChannel> {
  return apiClient<CampaignBreakdownChannel>(
    `${_ROOT(storeId)}/${campaignId}/breakdown/channel?${_breakdownQS(
      dateFrom,
      dateTo,
      attributionModel,
    )}`,
  );
}

export async function getCampaignBreakdownUtm(
  storeId: string,
  campaignId: string,
  dateFrom: string,
  dateTo: string,
  attributionModel: AttributionModelName = "last_touch",
  limit = 20,
): Promise<CampaignBreakdownUtm> {
  return apiClient<CampaignBreakdownUtm>(
    `${_ROOT(storeId)}/${campaignId}/breakdown/utm?${_breakdownQS(
      dateFrom,
      dateTo,
      attributionModel,
      { limit: String(limit) },
    )}`,
  );
}

export async function getCampaignBreakdownCustomerType(
  storeId: string,
  campaignId: string,
  dateFrom: string,
  dateTo: string,
  attributionModel: AttributionModelName = "last_touch",
): Promise<CampaignBreakdownCustomerType> {
  return apiClient<CampaignBreakdownCustomerType>(
    `${_ROOT(storeId)}/${campaignId}/breakdown/customer-type?${_breakdownQS(
      dateFrom,
      dateTo,
      attributionModel,
    )}`,
  );
}

export async function getCampaignBreakdownOrderSize(
  storeId: string,
  campaignId: string,
  dateFrom: string,
  dateTo: string,
  attributionModel: AttributionModelName = "last_touch",
): Promise<CampaignBreakdownOrderSize> {
  return apiClient<CampaignBreakdownOrderSize>(
    `${_ROOT(storeId)}/${campaignId}/breakdown/order-size?${_breakdownQS(
      dateFrom,
      dateTo,
      attributionModel,
    )}`,
  );
}

export async function getCampaignBreakdownDevice(
  storeId: string,
  campaignId: string,
  dateFrom: string,
  dateTo: string,
  attributionModel: AttributionModelName = "last_touch",
): Promise<CampaignBreakdownDevice> {
  return apiClient<CampaignBreakdownDevice>(
    `${_ROOT(storeId)}/${campaignId}/breakdown/device?${_breakdownQS(
      dateFrom,
      dateTo,
      attributionModel,
    )}`,
  );
}

// ── Auto-match rules (feature 002 US4) ─────────────────────────────

export type AutoMatchField = "utm_source" | "utm_medium" | "utm_campaign";
export type AutoMatchOperator = "equals" | "starts_with" | "contains";
export type AutoMatchCombinator = "AND" | "OR";

export interface AutoMatchCondition {
  field: AutoMatchField;
  operator: AutoMatchOperator;
  value: string;
}

export interface AutoMatchRule {
  group_id: string;
  campaign_id: string;
  combinator: AutoMatchCombinator;
  priority: number;
  conditions: AutoMatchCondition[];
}

export interface AutoMatchRuleWarning {
  code: string;
  message: string;
}

export interface CreateAutoMatchRuleRequest {
  combinator: AutoMatchCombinator;
  priority: number;
  conditions: AutoMatchCondition[];
}

export interface CreateAutoMatchRuleResponse {
  rule: AutoMatchRule;
  warnings: AutoMatchRuleWarning[];
}

export async function listAutoMatchRules(
  storeId: string,
  campaignId: string,
): Promise<AutoMatchRule[]> {
  return apiClient<AutoMatchRule[]>(
    `${_ROOT(storeId)}/${campaignId}/auto-match-rules`,
  );
}

export async function createAutoMatchRule(
  storeId: string,
  campaignId: string,
  body: CreateAutoMatchRuleRequest,
): Promise<CreateAutoMatchRuleResponse> {
  return apiClient<CreateAutoMatchRuleResponse>(
    `${_ROOT(storeId)}/${campaignId}/auto-match-rules`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function deleteAutoMatchRule(
  storeId: string,
  campaignId: string,
  groupId: string,
): Promise<void> {
  await apiClient<void>(
    `${_ROOT(storeId)}/${campaignId}/auto-match-rules/${groupId}`,
    { method: "DELETE" },
  );
}

// ── Campaign activities / backfill (feature 002 US5) ───────────────

export type ActivityType = "backfill_attribution";
export type ActivityStatus = "running" | "completed" | "failed";
export type BackfillFilterField =
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "utm_term"
  | "utm_content"
  | "referrer";

export interface BackfillFilter {
  field: BackfillFilterField;
  operator: AutoMatchOperator;
  value: string;
}

export interface CampaignActivity {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  payload: Record<string, unknown>;
  affected_count: number | null;
  skipped_count: number | null;
  error_message: string | null;
  run_at: string;
  completed_at: string | null;
  run_by: string;
}

export interface RunBackfillRequest {
  utm_filters: BackfillFilter[];
  starts_at: string;
  ends_at: string;
}

export async function listActivities(
  storeId: string,
  campaignId: string,
  limit = 20,
): Promise<CampaignActivity[]> {
  const qs = new URLSearchParams({ limit: String(limit) }).toString();
  return apiClient<CampaignActivity[]>(
    `${_ROOT(storeId)}/${campaignId}/activities?${qs}`,
  );
}

export async function runBackfill(
  storeId: string,
  campaignId: string,
  body: RunBackfillRequest,
): Promise<CampaignActivity> {
  return apiClient<CampaignActivity>(
    `${_ROOT(storeId)}/${campaignId}/activities/backfill`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}
