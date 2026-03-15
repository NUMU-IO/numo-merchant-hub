/**
 * Plan & billing API service — current usage, plan limits matrix.
 */

import { apiClient } from "./api";

// ── Types ──

export interface ResourceUsage {
  used: number;
  limit: number;
  unlimited: boolean;
}

export interface PlanFeatureFlags {
  webhooks: boolean;
  custom_domain: boolean;
  api_access: boolean;
  analytics: boolean;
  discount_codes: boolean;
}

export interface PlanUsage {
  plan: string;
  display_name: string;
  products: ResourceUsage;
  orders_this_month: ResourceUsage;
  features: PlanFeatureFlags;
}

export interface PlanTier {
  display_name: string;
  max_products: number | null;
  max_orders_per_month: number | null;
  max_stores: number | null;
  max_staff_members: number | null;
  max_customers: number | null;
  webhooks_enabled: boolean;
  custom_domain_enabled: boolean;
  api_access_enabled: boolean;
  analytics_enabled: boolean;
  discount_codes_enabled: boolean;
}

export type PlanMatrix = Record<string, PlanTier>;

// ── API calls ──

export async function getPlanUsage(storeId: string): Promise<PlanUsage> {
  return apiClient<PlanUsage>(`/stores/${storeId}/plan/usage`);
}

export async function getAllPlanLimits(storeId: string): Promise<PlanMatrix> {
  return apiClient<PlanMatrix>(`/stores/${storeId}/plan/limits`);
}
