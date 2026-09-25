import { apiClient } from "./api";

/**
 * The developer surface: whether this store may use the API at all, and the
 * webhook endpoints it has registered. Tokens live in `mcpApi` and are shared
 * with the MCP page — one token system, two places it is offered from.
 */

export interface ApiAccessState {
  allowed: boolean;
  /** "plan" when the plan includes it, "grant" when NUMU enabled it. */
  source: "plan" | "grant" | null;
  plan: string;
  in_plan: boolean;
  granted: boolean;
}

export function fetchApiAccess(storeId: string): Promise<ApiAccessState> {
  return apiClient<ApiAccessState>(`/stores/${storeId}/access-tokens/access`);
}

/** null = unlimited. */
export interface ApiLimits {
  per_minute: number | null;
  per_second: number | null;
  monthly_quota: number | null;
  key_limit: number | null;
}

export type ApiUsageWarning =
  | { code: "quota_80"; percent: number }
  | { code: "quota_reached"; percent: number }
  | { code: "polling"; route: string; per_minute: number }
  | { code: "throttled"; count: number };

export interface ApiUsage {
  limits: ApiLimits;
  month: { used: number; quota: number | null };
  today: {
    requests: number;
    throttled: number;
    errors_4xx: number;
    errors_5xx: number;
    error_rate: number;
  };
  daily: { day: string; requests: number; throttled: number; errors: number }[];
  top_endpoints: { method: string; route: string; requests: number }[];
  keys_today: Record<string, number>;
  warnings: ApiUsageWarning[];
}

export function fetchApiUsage(storeId: string): Promise<ApiUsage> {
  return apiClient<ApiUsage>(`/stores/${storeId}/access-tokens/usage`);
}

/** Every event a subscription may carry. Mirrors WebhookEventType. */
export const WEBHOOK_EVENTS = [
  "order.created",
  "order.paid",
  "order.status_changed",
  "product.created",
  "product.updated",
  "product.deleted",
  "customer.created",
  "customer.updated",
  "refund.created",
  "refund.completed",
  "shipment.created",
  "shipment.status_changed",
  "inventory.level_changed",
  "checkout.abandoned",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookSubscription {
  id: string;
  store_id: string;
  url: string;
  events: string[];
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatedWebhookSubscription extends WebhookSubscription {
  /** The signing secret — shown exactly once, at creation or rotation. */
  secret: string;
}

export interface WebhookDeliveryLog {
  id: string;
  subscription_id: string | null;
  event_type: string;
  event_id: string;
  status: "pending" | "success" | "failed" | "exhausted";
  attempt_count: number;
  last_status_code: number | null;
  last_response_body: string | null;
  last_error: string | null;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
  exhausted_at: string | null;
  created_at: string;
}

export interface WebhookTestResult {
  delivered: boolean;
  status_code: number | null;
  error: string | null;
  delivery_id: string;
}

export function listWebhooks(storeId: string): Promise<WebhookSubscription[]> {
  return apiClient<WebhookSubscription[]>(`/stores/${storeId}/webhooks`);
}

export function createWebhook(
  storeId: string,
  input: { url: string; events: string[]; description?: string },
): Promise<CreatedWebhookSubscription> {
  return apiClient<CreatedWebhookSubscription>(`/stores/${storeId}/webhooks`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateWebhook(
  storeId: string,
  id: string,
  patch: {
    url?: string;
    events?: string[];
    is_active?: boolean;
    description?: string;
  },
): Promise<WebhookSubscription> {
  return apiClient<WebhookSubscription>(`/stores/${storeId}/webhooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteWebhook(storeId: string, id: string): Promise<unknown> {
  return apiClient<unknown>(`/stores/${storeId}/webhooks/${id}`, {
    method: "DELETE",
  });
}

/** Deliver a signed `webhook.ping` now and report what the endpoint answered. */
export function testWebhook(
  storeId: string,
  id: string,
): Promise<WebhookTestResult> {
  return apiClient<WebhookTestResult>(`/stores/${storeId}/webhooks/${id}/test`, {
    method: "POST",
  });
}

/** New signing secret. The old one stops working immediately. */
export function rotateWebhookSecret(
  storeId: string,
  id: string,
): Promise<CreatedWebhookSubscription> {
  return apiClient<CreatedWebhookSubscription>(
    `/stores/${storeId}/webhooks/${id}/rotate-secret`,
    { method: "POST" },
  );
}

export function listWebhookLogs(
  storeId: string,
  id: string,
  limit = 25,
): Promise<WebhookDeliveryLog[]> {
  return apiClient<WebhookDeliveryLog[]>(
    `/stores/${storeId}/webhooks/${id}/logs?limit=${limit}`,
  );
}
