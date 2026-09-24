/**
 * What the current store may use, and how much of it.
 *
 * The API enforces the same answers on its own, so the hub only gates UI on
 * these; nothing here is a security boundary.
 */

import { apiClient } from "./api";

export type Limit = number | "unlimited";

export interface FeatureState {
  value: boolean | Limit;
  available: boolean;
  in_plan: boolean;
  source: "plan" | "addon" | "override" | "default";
  expires_at: string | null;
  reason: "not_in_plan" | "blocked" | "disabled_globally" | "unknown_feature" | null;
  kind: "boolean" | "limit";
  period: "day" | "month" | null;
}

export interface Entitlements {
  plan: string;
  features: Record<string, FeatureState>;
  /** Only the release flags that are on. */
  flags: string[];
}

export interface UsageRow {
  feature: string;
  limit: Limit;
  used: number;
  remaining: Limit;
  resets_at: string | null;
}

/** `error.details` of FEATURE_NOT_AVAILABLE (403) and PLAN_LIMIT_EXCEEDED (402). */
export interface UpgradeDetails {
  reason?: FeatureState["reason"];
  /** Cheapest plan first; add-ons read "addon:<app slug>". */
  available_via?: string[];
  limit?: Limit;
  resets_at?: string | null;
}

export const entitlementKeys = {
  all: ["entitlements"] as const,
  store: (storeId: string | undefined) => ["entitlements", storeId] as const,
};

export function getEntitlements(storeId: string): Promise<Entitlements> {
  return apiClient<Entitlements>(`/stores/${storeId}/entitlements`);
}

export async function getEntitlementUsage(storeId: string): Promise<UsageRow[]> {
  const { usage } = await apiClient<{ usage: UsageRow[] }>(
    `/stores/${storeId}/entitlements/usage`,
  );
  return usage;
}
