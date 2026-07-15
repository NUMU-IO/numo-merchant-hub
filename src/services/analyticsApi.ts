/**
 * Analytics & Dashboard stats API service.
 *
 * Every range-scoped endpoint now takes a `DateRange` from the
 * Shopify-style picker. The serializer in `dateRangeParams.ts`
 * emits `start_date` + `end_date` + `granularity`; the backend's
 * shared `get_date_range_window` dependency parses them.
 */

import type { DateRange } from "@/components/filters/DateRangePicker";

import { apiClient } from "./api";
import { dateRangeQuery } from "./dateRangeParams";

// ── Dashboard stats ──

export interface DashboardStats {
  total_revenue: number; // cents
  revenue_change_percent: number;
  avg_order_value: number; // cents
  currency: string;
  total_orders: number;
  pending_orders: number;
  confirmed_orders: number;
  processing_orders: number;
  shipped_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_customers: number;
  new_customers: number;
  total_products: number;
  low_stock_count: number;
  total_profit: number; // cents
  total_cogs: number; // cents
  products_with_cost: number;
  period_start: string;
  period_end: string;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number; // cents
  orders: number;
  visits: number;
}

export interface TopProduct {
  id: string;
  name: string;
  sku: string | null;
  quantity_sold: number;
  revenue: number; // cents
  percentage?: number;
  image_url?: string | null;
}

// ── Analytics endpoints ──

export interface SalesOverview {
  total_sales: number; // cents — BOOKED revenue (incl. unpaid COD)
  total_orders: number;
  avg_order_value: number; // cents
  sales_change_percent: number;
  orders_change_percent: number;
  /** cents — money actually received: paid orders minus refunds.
   * Optional so the UI degrades gracefully against an older backend. */
  collected_revenue?: number;
  collected_change_percent?: number;
  /** Previous-window absolutes (same length, ending the day before the
   * current window). Optional for older-backend compatibility. */
  previous_total_sales?: number;
  previous_total_orders?: number;
  previous_collected_revenue?: number;
  currency: string;
}

export interface SalesDataPoint {
  date: string;
  sales: number; // cents
  orders: number;
  /** Present when the chart was requested with a compare mode — the
   * same-position bucket of the previous window (already aligned). */
  prev_date?: string | null;
  prev_sales?: number | null; // cents
  prev_orders?: number | null;
}

export interface LocationSales {
  location: string;
  sales: number; // cents
  orders: number;
  percentage: number;
}

export interface CustomerAnalytics {
  total_customers: number;
  new_customers: number;
  returning_customers: number;
  avg_customer_value: number; // cents
}

export interface ConversionStats {
  total_visitors: number;
  total_orders: number;
  conversion_rate: number;
  cart_abandonment_rate: number;
}

// ── Internal helpers ──

function url(storeId: string, path: string, range: DateRange, extra?: Record<string, string>): string {
  const qs = dateRangeQuery(range);
  if (extra) for (const [k, v] of Object.entries(extra)) qs.set(k, v);
  return `/stores/${storeId}/${path}?${qs.toString()}`;
}

// ── Dashboard API calls ──

export async function getDashboardStats(
  storeId: string,
  range: DateRange,
): Promise<DashboardStats> {
  return apiClient<DashboardStats>(url(storeId, "dashboard/stats", range));
}

export async function getRevenueChart(
  storeId: string,
  range: DateRange,
): Promise<RevenueDataPoint[]> {
  return apiClient<RevenueDataPoint[]>(url(storeId, "dashboard/revenue", range));
}

export async function getTopProducts(
  storeId: string,
  limit = 5,
): Promise<TopProduct[]> {
  // Not range-scoped: top-products dashboard call only takes a limit.
  return apiClient<TopProduct[]>(
    `/stores/${storeId}/dashboard/top-products?limit=${limit}`,
  );
}

// ── Order streak ──

export interface OrderStreak {
  current_streak: number; // consecutive days with orders (today or yesterday)
  longest_streak: number;
  last_order_date: string | null; // YYYY-MM-DD in store tz, or null
  active_today: boolean; // an order already landed today
}

export async function getOrderStreak(storeId: string): Promise<OrderStreak> {
  // Not range-scoped: the streak is computed over a fixed lookback window
  // server-side, independent of the dashboard date picker.
  return apiClient<OrderStreak>(`/stores/${storeId}/dashboard/streak`);
}

// ── Analytics API calls ──

export async function getSalesOverview(
  storeId: string,
  range: DateRange,
): Promise<SalesOverview> {
  return apiClient<SalesOverview>(url(storeId, "analytics/overview", range));
}

export interface SalesChartOptions {
  /** Attach an aligned previous-window series to each point. */
  compare?: "previous_period" | "previous_year";
  /** Override the range's auto-granularity — the backend buckets on
   * real store-local calendar weeks (Mon-start) / months, unlike the
   * old client-side fixed 7/30-row chunking this replaced. */
  granularity?: "day" | "week" | "month";
}

export async function getSalesChart(
  storeId: string,
  range: DateRange,
  opts?: SalesChartOptions,
): Promise<SalesDataPoint[]> {
  const extra: Record<string, string> = {};
  if (opts?.compare) extra.compare = opts.compare;
  if (opts?.granularity) extra.granularity = opts.granularity;
  return apiClient<SalesDataPoint[]>(
    url(storeId, "analytics/sales-chart", range, extra),
  );
}

export async function getAnalyticsTopProducts(
  storeId: string,
  range: DateRange,
  limit = 5,
): Promise<TopProduct[]> {
  return apiClient<TopProduct[]>(
    url(storeId, "analytics/top-products", range, { limit: String(limit) }),
  );
}

export async function getSalesByLocation(
  storeId: string,
  range: DateRange,
): Promise<LocationSales[]> {
  return apiClient<LocationSales[]>(
    url(storeId, "analytics/sales-by-location", range),
  );
}

export async function getCustomerAnalytics(
  storeId: string,
  range: DateRange,
): Promise<CustomerAnalytics> {
  return apiClient<CustomerAnalytics>(url(storeId, "analytics/customers", range));
}

export async function getConversionStats(
  storeId: string,
  range: DateRange,
): Promise<ConversionStats> {
  return apiClient<ConversionStats>(url(storeId, "analytics/conversion", range));
}

// ── Traffic Sources ──

export interface TrafficSourceData {
  source: string;
  orders: number;
  revenue: number;
  percentage: number;
}

export async function getTrafficSources(
  storeId: string,
  range: DateRange,
): Promise<TrafficSourceData[]> {
  return apiClient<TrafficSourceData[]>(
    url(storeId, "analytics/traffic-sources", range),
  );
}

// ── COD Rejection stats ──

export interface CodRejectionLocation {
  location: string;
  rejected: number;
  total: number;
  rate: number;
}

export interface CodRejectionStats {
  total_cod_shipments: number;
  delivered_count: number;
  rejected_count: number;
  returned_count: number;
  rejection_rate: number;
  total_cod_amount: number; // cents
  rejected_amount: number; // cents
  by_location: CodRejectionLocation[];
}

export async function getCodRejectionStats(
  storeId: string,
  range: DateRange,
): Promise<CodRejectionStats> {
  return apiClient<CodRejectionStats>(
    url(storeId, "analytics/cod-rejections", range),
  );
}

// ── Health Score ──

export interface HealthScoreMetrics {
  delivery_success_rate: number;
  cod_acceptance_rate: number;
  order_completion_rate: number;
  return_rate: number;
  avg_response_hours: number;
}

export interface HealthScoreData {
  score: number | null;
  grade: string;
  insufficient_data?: boolean;
  insufficient_metrics?: string[];
  metrics: HealthScoreMetrics;
  sub_scores: Record<string, number>;
  recommendations: string[];
  orders_analyzed: number;
  shipments_analyzed: number;
  calculated_at: string | null;
}

export async function getHealthScore(
  storeId: string,
  live = false,
  lang = "ar",
): Promise<HealthScoreData> {
  return apiClient<HealthScoreData>(
    `/stores/${storeId}/analytics/health-score?live=${live}&lang=${lang}`,
  );
}

// ── Orders Breakdown ──

export interface OrdersByStatusItem {
  status: string;
  count: number;
  percentage: number;
}

export interface OrdersByPaymentMethodItem {
  method: string;
  count: number;
  revenue: number; // cents
}

export interface FulfillmentTimeStats {
  avg_hours: number;
  p50_hours: number;
  p95_hours: number;
}

export interface OrdersByDayOfWeekItem {
  day: string;
  orders: number;
  revenue: number; // cents
}

export interface OrdersByHourItem {
  hour: number;
  orders: number;
}

export interface OrdersBreakdown {
  by_status: OrdersByStatusItem[];
  by_payment_method: OrdersByPaymentMethodItem[];
  fulfillment_time: FulfillmentTimeStats;
  by_day_of_week: OrdersByDayOfWeekItem[];
  by_hour_of_day: OrdersByHourItem[];
}

export async function getOrdersBreakdown(
  storeId: string,
  range: DateRange,
): Promise<OrdersBreakdown> {
  return apiClient<OrdersBreakdown>(
    url(storeId, "analytics/orders-breakdown", range),
  );
}

// ── Revenue Breakdown ──

export interface CouponUsageItem {
  code: string;
  uses: number;
  revenue_impact: number; // cents
}

export interface TaxByRateItem {
  rate_pct: number;
  orders: number;
  tax_cents: number;
}

export interface RevenueBreakdown {
  gross_revenue: number; // cents
  discounts: number; // cents
  shipping_collected: number; // cents
  refunds: number; // cents
  net_revenue: number; // cents
  /** Tax collected (paid orders). INCLUSIVE — part of gross, not netted.
   * Optional for older-backend compatibility. */
  tax_collected?: number; // cents
  tax_inclusive?: number; // cents
  tax_added?: number; // cents
  tax_by_rate?: TaxByRateItem[];
  coupon_usage: CouponUsageItem[];
}

export async function getRevenueBreakdown(
  storeId: string,
  range: DateRange,
): Promise<RevenueBreakdown> {
  return apiClient<RevenueBreakdown>(
    url(storeId, "analytics/revenue-breakdown", range),
  );
}

// ── Customer Segments (RFM) ──

export interface RFMSegmentItem {
  segment: string;
  count: number;
  percentage: number;
  avg_revenue: number; // cents
  avg_orders: number;
}

export interface CohortRow {
  cohort: string;
  size: number;
  retention: number[]; // percentages
}

export interface CLVStats {
  avg_clv: number; // cents
  median_clv: number; // cents
  top_10_pct_clv: number; // cents
  total_customers: number;
  single_order_pct: number;
}

export interface CustomerSegments {
  segments: RFMSegmentItem[];
  cohorts: CohortRow[];
  clv: CLVStats;
}

export async function getCustomerSegments(
  storeId: string,
  range: DateRange,
): Promise<CustomerSegments> {
  return apiClient<CustomerSegments>(
    url(storeId, "analytics/customer-segments", range),
  );
}

// ── Product Performance ──

export interface ProductPerformanceItem {
  id: string;
  name: string;
  sku: string | null;
  image_url?: string | null;
  revenue: number; // cents
  quantity_sold: number;
  current_stock: number;
  revenue_trend: number[]; // 7 data points
  cost_price: number | null; // cents
  profit: number | null; // cents
  margin_percent: number | null;
}

export interface CategoryPerformanceItem {
  category_id: string | null;
  category_name: string;
  revenue: number; // cents
  quantity_sold: number;
  product_count: number;
}

export interface InventoryHealth {
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
  dead_stock: number;
}

export interface ProductPerformance {
  products: ProductPerformanceItem[];
  categories: CategoryPerformanceItem[];
  inventory: InventoryHealth;
}

export async function getProductPerformance(
  storeId: string,
  range: DateRange,
  sortBy = "revenue",
): Promise<ProductPerformance> {
  return apiClient<ProductPerformance>(
    url(storeId, "analytics/product-performance", range, { sort_by: sortBy }),
  );
}

// ── Conversion Funnel ──

export interface FunnelStep {
  step: string;
  count: number;
  drop_off_pct: number;
}

export interface FunnelTrendPoint {
  date: string;
  conversion_rate: number;
}

export interface StepTiming {
  from_step: string;
  to_step: string;
  avg_minutes: number;
}

export interface CartAbandonment {
  carts_created: number;
  checkouts_started: number;
  abandonment_rate: number;
  estimated_lost_revenue: number; // cents
}

export interface FunnelData {
  steps: FunnelStep[];
  overall_conversion_pct: number;
  trend: FunnelTrendPoint[];
  step_timings: StepTiming[];
  cart_abandonment: CartAbandonment;
}

export async function getFunnel(
  storeId: string,
  range: DateRange,
): Promise<FunnelData> {
  return apiClient<FunnelData>(url(storeId, "analytics/funnel", range));
}

// ── Search analytics ──

export interface SearchTermItem {
  term: string;
  searches: number;
  sessions: number;
  zero_result_searches: number; // 0 until storefront reports result counts
}

export interface SearchTermsData {
  total_searches: number;
  unique_search_sessions: number;
  /** % of searching sessions that also purchased in-window (co-occurrence). */
  search_conversion_rate: number;
  terms: SearchTermItem[];
}

export async function getSearchTerms(
  storeId: string,
  range: DateRange,
): Promise<SearchTermsData> {
  return apiClient<SearchTermsData>(url(storeId, "analytics/search-terms", range));
}

// ── Advisor signals (AI Commerce Intelligence) ──

export interface AdvisorSignal {
  id: string;
  kind: "advice" | "opportunity" | "alert";
  rule_id: string;
  severity: "critical" | "warning" | "opportunity" | "info";
  title: string;
  action: string;
  expected_impact_cents: number | null;
  created_at: string;
}

export async function getSignals(
  storeId: string,
  lang: "en" | "ar",
): Promise<{ signals: AdvisorSignal[] }> {
  return apiClient<{ signals: AdvisorSignal[] }>(
    `/stores/${storeId}/analytics/signals?lang=${lang}`,
  );
}

export async function dismissSignal(
  storeId: string,
  signalId: string,
): Promise<{ dismissed: boolean }> {
  return apiClient<{ dismissed: boolean }>(
    `/stores/${storeId}/analytics/signals/${signalId}/dismiss`,
    { method: "POST" },
  );
}

export async function refreshSignals(storeId: string): Promise<{ fired: number }> {
  return apiClient<{ fired: number }>(
    `/stores/${storeId}/analytics/signals/refresh`,
    { method: "POST" },
  );
}

// ── Custom report builder ──

export type ReportDimension =
  | "day" | "week" | "month"
  | "payment_method" | "governorate" | "channel" | "coupon" | "product";

export interface ReportBuilderRow {
  label: string;
  revenue_cents: number;
  orders: number;
  aov_cents: number;
  units: number;
}

export interface ReportBuilderResponse {
  dimension: ReportDimension;
  rows: ReportBuilderRow[];
  totals: ReportBuilderRow;
}

export async function getReportBuilder(
  storeId: string,
  range: DateRange,
  dimension: ReportDimension,
): Promise<ReportBuilderResponse> {
  return apiClient<ReportBuilderResponse>(
    url(storeId, "analytics/report-builder", range, { dimension }),
  );
}

// ── Weekly digest ──

export interface DigestContent {
  headline: string;
  highlights: string[];
  has_sales: boolean;
  period_start: string;
  period_end: string;
}

export interface DigestSettings {
  enabled: boolean;
  channels: ("email" | "whatsapp")[];
}

export async function getDigestPreview(
  storeId: string,
  lang: "en" | "ar",
): Promise<DigestContent> {
  return apiClient<DigestContent>(
    `/stores/${storeId}/analytics/digest/preview?lang=${lang}`,
  );
}

export async function getDigestSettings(
  storeId: string,
): Promise<DigestSettings> {
  return apiClient<DigestSettings>(`/stores/${storeId}/analytics/digest/settings`);
}

export async function putDigestSettings(
  storeId: string,
  settings: DigestSettings,
): Promise<DigestSettings> {
  return apiClient<DigestSettings>(
    `/stores/${storeId}/analytics/digest/settings`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    },
  );
}

// ── Chart annotations (store events) ──

export interface AnnotationItem {
  date: string; // matches sales-chart day label ("Jul 14")
  iso_date: string;
  type: "product" | "coupon" | "campaign" | "theme";
  label: string;
}

export async function getAnnotations(
  storeId: string,
  range: DateRange,
): Promise<{ annotations: AnnotationItem[] }> {
  return apiClient<{ annotations: AnnotationItem[] }>(
    url(storeId, "analytics/annotations", range),
  );
}

// ── Metric targets (goals + pace) ──

export type TargetMetric = "revenue" | "orders" | "aov" | "conversion";

export interface MetricTargetProgress {
  metric: TargetMetric;
  period: "month" | "quarter";
  /** Smallest unit: cents (revenue/aov), count (orders), basis points (conversion). */
  target_value: number;
  actual_value: number;
  progress_pct: number;
  expected_pct: number;
  pace: "ahead" | "on_track" | "behind";
  projected_value: number;
  days_elapsed: number;
  days_remaining: number;
  days_total: number;
  period_start: string;
  period_end: string;
}

export async function getMetricTargets(
  storeId: string,
): Promise<{ targets: MetricTargetProgress[] }> {
  return apiClient<{ targets: MetricTargetProgress[] }>(
    `/stores/${storeId}/analytics/targets`,
  );
}

export async function putMetricTargets(
  storeId: string,
  targets: { metric: TargetMetric; period?: "month" | "quarter"; target_value: number }[],
): Promise<{ updated: number }> {
  return apiClient<{ updated: number }>(
    `/stores/${storeId}/analytics/targets`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targets }),
    },
  );
}

// ── Inventory analytics ──

export interface AbcClassSummary {
  count: number;
  revenue_cents: number;
  revenue_share_pct: number;
}

export interface AbcProductItem {
  product_id: string;
  name: string;
  abc_class: "A" | "B" | "C";
  revenue_cents: number;
  revenue_share_pct: number;
  sell_through_pct: number;
}

export interface DeadStockBucket {
  label: string;
  products: number;
  units: number;
  value_cents: number;
}

export interface DeadStockProductItem {
  product_id: string;
  name: string;
  quantity: number;
  value_cents: number;
  days_since_last_sale: number | null;
}

export interface InventoryAnalytics {
  sell_through_pct: number;
  units_sold: number;
  units_in_stock: number;
  abc: Record<"A" | "B" | "C", AbcClassSummary>;
  abc_products: AbcProductItem[];
  dead_stock_buckets: DeadStockBucket[];
  dead_stock_products: DeadStockProductItem[];
  dead_stock_value_cents: number;
  /** false = some values fall back to sale price (no cost set). */
  value_is_cost: boolean;
}

export async function getInventoryAnalytics(
  storeId: string,
  range: DateRange,
): Promise<InventoryAnalytics> {
  return apiClient<InventoryAnalytics>(
    url(storeId, "analytics/inventory-analytics", range),
  );
}

// ── Marketing Attribution ──

export interface ChannelAttribution {
  channel: string;
  visits: number;
  orders: number;
  revenue: number; // cents
  conversion_rate: number;
}

export interface CampaignItem {
  campaign: string;
  visits: number;
  orders: number;
  revenue: number; // cents
}

export interface LandingPageItem {
  path: string;
  sessions: number;
}

export interface ReferrerItem {
  host: string;
  sessions: number;
}

export interface MarketingAttribution {
  channels: ChannelAttribution[];
  campaigns: CampaignItem[];
  total_visits: number;
  attributed_visits: number;
  /** Real acquisition detail — optional for older-backend compatibility. */
  top_landing_pages?: LandingPageItem[];
  top_referrers?: ReferrerItem[];
}

export async function getMarketingAttribution(
  storeId: string,
  range: DateRange,
): Promise<MarketingAttribution> {
  return apiClient<MarketingAttribution>(
    url(storeId, "analytics/marketing-attribution", range),
  );
}

// ── LTV by acquisition channel ──

export type LtvGroupBy = "source" | "medium" | "campaign";

export interface LtvChannelRow {
  channel: string;
  customer_count: number;
  total_orders: number;
  total_revenue_cents: number;
  average_order_value_cents: number;
  orders_per_customer: number;
  ltv_cents: number;
}

export interface LtvByChannelTotals {
  customer_count: number;
  total_orders: number;
  total_revenue_cents: number;
  average_ltv_cents: number;
}

export interface LtvByChannel {
  group_by: LtvGroupBy;
  channels: LtvChannelRow[];
  totals: LtvByChannelTotals;
}

export async function getLtvByChannel(
  storeId: string,
  range: DateRange,
  groupBy: LtvGroupBy = "source",
): Promise<LtvByChannel> {
  return apiClient<LtvByChannel>(
    url(storeId, "analytics/ltv-by-channel", range, { group_by: groupBy }),
  );
}

// ── Multi-touch attribution ──

export type AttributionModel =
  | "last_touch"
  | "first_touch"
  | "linear"
  | "time_decay"
  | "position_based";

export interface MultiTouchChannelRow {
  channel: string;
  credit_cents: number;
  credit_pct: number;
}

export interface MultiTouchCampaignRow {
  campaign_id: string;
  campaign_name: string;
  credit_cents: number;
  credit_pct: number;
}

export interface MultiTouchAttribution {
  model: AttributionModel;
  total_orders: number;
  total_revenue_cents: number;
  by_channel: MultiTouchChannelRow[];
  by_campaign: MultiTouchCampaignRow[];
}

export async function getMultiTouchAttribution(
  storeId: string,
  range: DateRange,
  model: AttributionModel = "linear",
): Promise<MultiTouchAttribution> {
  return apiClient<MultiTouchAttribution>(
    url(storeId, "analytics/multi-touch", range, { model }),
  );
}

// ── Real-Time Analytics ──

export interface RecentOrder {
  order_id: string;
  order_number: string;
  total: number; // cents
  customer_name: string;
  item_count: number;
  payment_method: string | null;
}

export interface TopPage {
  path: string;
  views: number;
}

export interface RealtimeSnapshot {
  views_today: number;
  visitors_today: number;
  active_now: number;
  orders_today: number;
  revenue_today: number; // cents
  recent_orders: RecentOrder[];
  hourly_orders: number[]; // 24 values
  hourly_revenue: number[]; // 24 values (cents)
  top_pages: TopPage[];
}

export async function getRealtimeSnapshot(
  storeId: string,
): Promise<RealtimeSnapshot> {
  return apiClient<RealtimeSnapshot>(
    `/stores/${storeId}/analytics/realtime/snapshot`,
  );
}

export function getRealtimeStreamUrl(storeId: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || "/api/v1";
  return `${base}/stores/${storeId}/analytics/realtime/stream`;
}

export interface GeoLocationItem {
  location: string;
  orders: number;
  revenue: number; // cents
  percentage: number;
}

export interface RealtimeGeo {
  total_orders: number;
  locations: GeoLocationItem[];
}

export async function getRealtimeGeo(storeId: string): Promise<RealtimeGeo> {
  return apiClient<RealtimeGeo>(`/stores/${storeId}/analytics/realtime/geo`);
}

// ── AI Insights ──

export interface InsightSignal {
  type: string;
  severity: "critical" | "warning" | "info" | "success";
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  action_en: string | null;
  action_ar: string | null;
  metric: string | null;
  current_value: number | null;
  baseline_value: number | null;
  deviation_pct: number | null;
}

export interface InsightNarrative {
  summary: string | null;
  top_actions: string[];
  outlook: string | null;
}

export interface InsightsData {
  signals: InsightSignal[];
  narrative: InsightNarrative | null;
  generated_at: string;
}

export async function getInsights(
  storeId: string,
  lang = "ar",
): Promise<InsightsData> {
  return apiClient<InsightsData>(
    `/stores/${storeId}/analytics/insights?lang=${lang}`,
  );
}

// ── Sales Forecast ──

export interface ForecastPoint {
  date: string;
  predicted: number; // cents
  lower: number; // cents
  upper: number; // cents
}

export interface HistoricalPoint {
  date: string;
  revenue: number; // cents
  orders: number;
}

export interface ForecastMetadata {
  status: string;
  days_available: number | null;
  days_required: number | null;
  horizon_days: number | null;
  method: string | null;
  avg_daily_revenue_7d: number | null;
  forecast_total: number | null;
  forecast_daily_avg: number | null;
  trend: string | null;
  message_en: string | null;
  message_ar: string | null;
}

export interface ForecastData {
  historical: HistoricalPoint[];
  forecast: ForecastPoint[];
  metadata: ForecastMetadata;
}

export async function getForecast(
  storeId: string,
  horizon = 30,
): Promise<ForecastData> {
  return apiClient<ForecastData>(
    `/stores/${storeId}/analytics/forecast?horizon=${horizon}`,
  );
}

// ── Customer Journey / Sessions ──

export interface SessionSummary {
  session_fingerprint: string;
  page_count: number;
  duration_seconds: number;
  started_at: string;
  device_type: string;
  referrer: string | null;
  funnel_reached: string | null;
  has_order: boolean;
}

export interface SessionsOverview {
  total_sessions: number;
  avg_duration_seconds: number;
  bounce_rate: number;
  sessions_with_order_pct: number;
}

export interface SessionsData {
  overview: SessionsOverview;
  sessions: SessionSummary[];
}

export async function getSessions(
  storeId: string,
  range: DateRange,
  hasOrder = false,
  minPages = 1,
  device = "",
): Promise<SessionsData> {
  const extra: Record<string, string> = {
    has_order: String(hasOrder),
    min_pages: String(minPages),
  };
  if (device) extra.device = device;
  return apiClient<SessionsData>(
    url(storeId, "analytics/sessions", range, extra),
  );
}

export interface TimelineEvent {
  type: string;
  path: string | null;
  step_data: Record<string, unknown> | null;
  timestamp: string;
}

export interface SessionDetail {
  session_fingerprint: string;
  device_type: string;
  referrer: string | null;
  page_count: number;
  duration_seconds: number;
  timeline: TimelineEvent[];
}

export async function getSessionDetail(
  storeId: string,
  fingerprint: string,
): Promise<SessionDetail> {
  return apiClient<SessionDetail>(
    `/stores/${storeId}/analytics/sessions/${fingerprint}`,
  );
}
