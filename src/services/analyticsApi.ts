/**
 * Analytics & Dashboard stats API service.
 */

import { apiClient } from "./api";

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
}

// ── Analytics endpoints ──

export interface SalesOverview {
  total_sales: number; // cents
  total_orders: number;
  avg_order_value: number; // cents
  sales_change_percent: number;
  orders_change_percent: number;
  currency: string;
}

export interface SalesDataPoint {
  date: string;
  sales: number; // cents
  orders: number;
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

// ── Dashboard API calls ──

export async function getDashboardStats(
  storeId: string,
  days = 30
): Promise<DashboardStats> {
  return apiClient<DashboardStats>(
    `/stores/${storeId}/dashboard/stats?days=${days}`
  );
}

export async function getRevenueChart(
  storeId: string,
  days = 30
): Promise<RevenueDataPoint[]> {
  return apiClient<RevenueDataPoint[]>(
    `/stores/${storeId}/dashboard/revenue?days=${days}`
  );
}

export async function getTopProducts(
  storeId: string,
  limit = 5
): Promise<TopProduct[]> {
  return apiClient<TopProduct[]>(
    `/stores/${storeId}/dashboard/top-products?limit=${limit}`
  );
}

// ── Analytics API calls ──

export async function getSalesOverview(
  storeId: string,
  days = 30
): Promise<SalesOverview> {
  return apiClient<SalesOverview>(
    `/stores/${storeId}/analytics/overview?days=${days}`
  );
}

export async function getSalesChart(
  storeId: string,
  days = 30
): Promise<SalesDataPoint[]> {
  return apiClient<SalesDataPoint[]>(
    `/stores/${storeId}/analytics/sales-chart?days=${days}`
  );
}

export async function getAnalyticsTopProducts(
  storeId: string,
  days = 30,
  limit = 5
): Promise<TopProduct[]> {
  return apiClient<TopProduct[]>(
    `/stores/${storeId}/analytics/top-products?days=${days}&limit=${limit}`
  );
}

export async function getSalesByLocation(
  storeId: string,
  days = 30
): Promise<LocationSales[]> {
  return apiClient<LocationSales[]>(
    `/stores/${storeId}/analytics/sales-by-location?days=${days}`
  );
}

export async function getCustomerAnalytics(
  storeId: string,
  days = 30
): Promise<CustomerAnalytics> {
  return apiClient<CustomerAnalytics>(
    `/stores/${storeId}/analytics/customers?days=${days}`
  );
}

export async function getConversionStats(
  storeId: string,
  days = 30
): Promise<ConversionStats> {
  return apiClient<ConversionStats>(
    `/stores/${storeId}/analytics/conversion?days=${days}`
  );
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
  days = 30
): Promise<TrafficSourceData[]> {
  return apiClient<TrafficSourceData[]>(
    `/stores/${storeId}/analytics/traffic-sources?days=${days}`
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
  days = 30
): Promise<CodRejectionStats> {
  return apiClient<CodRejectionStats>(
    `/stores/${storeId}/analytics/cod-rejections?days=${days}`
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
  score: number;
  grade: string;
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
  lang = "ar"
): Promise<HealthScoreData> {
  return apiClient<HealthScoreData>(
    `/stores/${storeId}/analytics/health-score?live=${live}&lang=${lang}`
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
  days = 30
): Promise<OrdersBreakdown> {
  return apiClient<OrdersBreakdown>(
    `/stores/${storeId}/analytics/orders-breakdown?days=${days}`
  );
}

// ── Revenue Breakdown ──

export interface CouponUsageItem {
  code: string;
  uses: number;
  revenue_impact: number; // cents
}

export interface RevenueBreakdown {
  gross_revenue: number; // cents
  discounts: number; // cents
  shipping_collected: number; // cents
  refunds: number; // cents
  net_revenue: number; // cents
  coupon_usage: CouponUsageItem[];
}

export async function getRevenueBreakdown(
  storeId: string,
  days = 30
): Promise<RevenueBreakdown> {
  return apiClient<RevenueBreakdown>(
    `/stores/${storeId}/analytics/revenue-breakdown?days=${days}`
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
  days = 90
): Promise<CustomerSegments> {
  return apiClient<CustomerSegments>(
    `/stores/${storeId}/analytics/customer-segments?days=${days}`
  );
}

// ── Product Performance ──

export interface ProductPerformanceItem {
  id: string;
  name: string;
  sku: string | null;
  revenue: number; // cents
  quantity_sold: number;
  current_stock: number;
  revenue_trend: number[]; // 7 data points
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
  days = 30,
  sortBy = "revenue"
): Promise<ProductPerformance> {
  return apiClient<ProductPerformance>(
    `/stores/${storeId}/analytics/product-performance?days=${days}&sort_by=${sortBy}`
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
  days = 30
): Promise<FunnelData> {
  return apiClient<FunnelData>(
    `/stores/${storeId}/analytics/funnel?days=${days}`
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

export interface MarketingAttribution {
  channels: ChannelAttribution[];
  campaigns: CampaignItem[];
  total_visits: number;
  attributed_visits: number;
}

export async function getMarketingAttribution(
  storeId: string,
  days = 30
): Promise<MarketingAttribution> {
  return apiClient<MarketingAttribution>(
    `/stores/${storeId}/analytics/marketing-attribution?days=${days}`
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
  storeId: string
): Promise<RealtimeSnapshot> {
  return apiClient<RealtimeSnapshot>(
    `/stores/${storeId}/analytics/realtime/snapshot`
  );
}

export function getRealtimeStreamUrl(storeId: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || "/api/v1";
  return `${base}/stores/${storeId}/analytics/realtime/stream`;
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
  lang = "ar"
): Promise<InsightsData> {
  return apiClient<InsightsData>(
    `/stores/${storeId}/analytics/insights?lang=${lang}`
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
  horizon = 30
): Promise<ForecastData> {
  return apiClient<ForecastData>(
    `/stores/${storeId}/analytics/forecast?horizon=${horizon}`
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
  days = 7,
  hasOrder = false,
  minPages = 1,
  device = ""
): Promise<SessionsData> {
  const params = new URLSearchParams({
    days: String(days),
    has_order: String(hasOrder),
    min_pages: String(minPages),
  });
  if (device) params.set("device", device);
  return apiClient<SessionsData>(
    `/stores/${storeId}/analytics/sessions?${params}`
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
  fingerprint: string
): Promise<SessionDetail> {
  return apiClient<SessionDetail>(
    `/stores/${storeId}/analytics/sessions/${fingerprint}`
  );
}
