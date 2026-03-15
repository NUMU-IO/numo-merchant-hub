/**
 * Webhook API service — manage outgoing webhook subscriptions and delivery logs.
 */

import { apiClient } from "./api";

// ── Types ──

export type WebhookEventType =
  | "order.created"
  | "order.status_changed"
  | "order.paid"
  | "order.cancelled"
  | "product.created"
  | "product.updated"
  | "product.deleted";

/** Delivery status values from the backend */
export type WebhookDeliveryStatus =
  | "pending"
  | "success"
  | "failed"
  | "exhausted"; // max retries exceeded

export interface WebhookSubscription {
  id: string;
  store_id: string;
  url: string;
  events: WebhookEventType[];
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
  // secret is only present on creation response, never in list
  secret?: string;
}

export interface WebhookDeliveryLog {
  id: string;
  subscription_id: string | null;
  event_type: string;
  event_id: string;
  status: WebhookDeliveryStatus;
  attempt_count: number;
  last_status_code: number | null;
  last_response_body: string | null;
  last_error: string | null;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
  exhausted_at: string | null;
  created_at: string;
}

export interface CreateWebhookRequest {
  url: string;
  events: WebhookEventType[];
  description?: string;
  is_active?: boolean;
}

// ── API calls ──

/** Returns plain array — backend uses ListResponse (not paginated) */
export async function listWebhooks(storeId: string): Promise<WebhookSubscription[]> {
  return apiClient<WebhookSubscription[]>(`/stores/${storeId}/webhooks/`);
}

/** Returns the created subscription; secret is included ONCE in this response */
export async function createWebhook(
  storeId: string,
  data: CreateWebhookRequest,
): Promise<WebhookSubscription> {
  return apiClient<WebhookSubscription>(`/stores/${storeId}/webhooks/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteWebhook(
  storeId: string,
  webhookId: string,
): Promise<void> {
  return apiClient<void>(`/stores/${storeId}/webhooks/${webhookId}`, {
    method: "DELETE",
  });
}

/** Delivery log endpoint uses skip/limit, returns plain array */
export async function getWebhookDeliveries(
  storeId: string,
  webhookId: string,
  skip = 0,
  limit = 20,
): Promise<WebhookDeliveryLog[]> {
  return apiClient<WebhookDeliveryLog[]>(
    `/stores/${storeId}/webhooks/${webhookId}/logs?skip=${skip}&limit=${limit}`,
  );
}
