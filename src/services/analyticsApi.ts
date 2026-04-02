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
