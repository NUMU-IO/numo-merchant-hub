/**
 * WhatsApp Business API service for the merchant dashboard.
 */

import { apiClient } from "./api";

// ── Types ──

export interface WhatsAppConnectionStatus {
  connected: boolean;
  connection_type: "shared" | "own";
  phone_number: string | null;
  phone_display_name: string | null;
  waba_id: string | null;
  quality_rating: string | null;
  messaging_limit: string | null;
  connected_at: string | null;
}

export interface EmbeddedSignupConfig {
  app_id: string;
  config_id: string;
  enabled: boolean;
}

export interface EmbeddedSignupResponse {
  connected: boolean;
  phone_number: string | null;
  display_name: string | null;
  waba_id: string | null;
}

export interface NotificationToggle {
  enabled: boolean;
  template_name: string | null;
  last_sent_at: string | null;
  sent_count_30d: number;
}

// Canonical key set — must match NUMU-api
// `src/api/v1/schemas/stores/whatsapp.py::NotificationSettings`. Both
// sides read/write `store.settings.whatsapp_notifications.{...}`; any
// drift here silently breaks merchant toggles (they update a path the
// backend handler doesn't read).
//
// `abandoned_cart` ships in the API surface so US3 can light it up
// without an API bump, but the WhatsApp.tsx page intentionally does
// NOT render a toggle for it (no scheduled-send dispatcher yet).
//
// `require_order_confirmation` (backend-031) — when ON, the
// OrderCreatedEvent handler sends `order_confirmation_request_v1`
// (interactive QUICK_REPLY) instead of `order_confirmation_v2`
// (receipt). The customer's tap flips orders.customer_confirmation_status
// to "confirmed"; the dashboard surfaces a per-order badge.
export interface NotificationSettings {
  order_confirmation: NotificationToggle;
  payment_received: NotificationToggle;
  shipping_update: NotificationToggle;
  delivery_confirmation: NotificationToggle;
  abandoned_cart: NotificationToggle;
  require_order_confirmation: NotificationToggle;
}

export interface WhatsAppDayStat {
  date: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface WhatsAppAnalytics {
  period: string;
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_failed: number;
  delivery_rate: number;
  read_rate: number;
  active_conversations: number;
  avg_response_time_minutes: number | null;
  daily_stats: WhatsAppDayStat[];
  by_template: Record<string, Record<string, number>>;
}

export interface WhatsAppTemplate {
  id: string;
  store_id: string;
  meta_template_id: string | null;
  name: string;
  language: string;
  category: string;
  status: string;
  header_type: string | null;
  header_content: string | null;
  body_text: string;
  footer_text: string | null;
  buttons: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
  is_system: boolean;
  submitted_at: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationSummary {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  customer_id: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  last_message_direction: string | null;
  unread_count: number;
  status: string;
  assigned_to: string | null;
  window_open: boolean;
  window_expires_at: string | null;
}

export interface MessageBubble {
  id: string;
  message_id: string;
  direction: "inbound" | "outbound";
  content: string | null;
  template_name: string | null;
  status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export interface Campaign {
  id: string;
  store_id: string;
  name: string;
  template_id: string;
  template_name: string | null;
  audience_filter: Record<string, unknown>;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AudienceEstimate {
  estimated_count: number;
  sample_recipients: Array<{ name: string; phone: string }>;
}

// ── Connection ──

export async function getSignupConfig(storeId: string) {
  return apiClient<EmbeddedSignupConfig>(
    `/stores/${storeId}/whatsapp/signup-config`
  );
}

export async function completeSignup(storeId: string, code: string) {
  return apiClient<EmbeddedSignupResponse>(
    `/stores/${storeId}/whatsapp/complete-signup`,
    { method: "POST", body: JSON.stringify({ code }) }
  );
}

export async function getWhatsAppStatus(storeId: string) {
  return apiClient<WhatsAppConnectionStatus>(
    `/stores/${storeId}/whatsapp/status`
  );
}

export async function disconnectWhatsApp(storeId: string) {
  return apiClient<Record<string, never>>(
    `/stores/${storeId}/whatsapp/disconnect`,
    { method: "DELETE" }
  );
}

// ── Notifications ──

export async function getNotificationSettings(storeId: string) {
  return apiClient<NotificationSettings>(
    `/stores/${storeId}/whatsapp/notifications`
  );
}

export async function updateNotificationSettings(
  storeId: string,
  updates: Partial<Record<keyof NotificationSettings, boolean>>
) {
  return apiClient<NotificationSettings>(
    `/stores/${storeId}/whatsapp/notifications`,
    { method: "PATCH", body: JSON.stringify(updates) }
  );
}

// ── Analytics ──

export async function getWhatsAppAnalytics(storeId: string, period = "30d") {
  return apiClient<WhatsAppAnalytics>(
    `/stores/${storeId}/whatsapp/analytics?period=${period}`
  );
}

// ── Templates ──

export async function listTemplates(storeId: string) {
  return apiClient<{ templates: WhatsAppTemplate[]; total: number }>(
    `/stores/${storeId}/whatsapp/templates`
  );
}

export async function createTemplate(
  storeId: string,
  data: {
    name: string;
    language: string;
    category: string;
    body_text: string;
    header_type?: string;
    header_content?: string;
    footer_text?: string;
    buttons?: Array<{ type: string; text: string; url?: string }>;
  }
) {
  return apiClient<WhatsAppTemplate>(
    `/stores/${storeId}/whatsapp/templates`,
    { method: "POST", body: JSON.stringify(data) }
  );
}

export async function deleteTemplate(storeId: string, templateId: string) {
  return apiClient<Record<string, never>>(
    `/stores/${storeId}/whatsapp/templates/${templateId}`,
    { method: "DELETE" }
  );
}

export async function syncTemplates(storeId: string) {
  return apiClient<{ templates: WhatsAppTemplate[]; total: number }>(
    `/stores/${storeId}/whatsapp/templates/sync`,
    { method: "POST" }
  );
}

// ── Conversations ──

export async function listConversations(
  storeId: string,
  params?: { status?: string; unread_only?: boolean; search?: string; skip?: number; limit?: number }
) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.unread_only) qs.set("unread_only", "true");
  if (params?.search) qs.set("search", params.search);
  if (params?.skip) qs.set("skip", String(params.skip));
  if (params?.limit) qs.set("limit", String(params.limit));
  return apiClient<{ conversations: ConversationSummary[]; total: number; unread_total: number }>(
    `/stores/${storeId}/whatsapp/conversations?${qs}`
  );
}

export async function getUnreadCount(storeId: string) {
  return apiClient<{ unread_count: number }>(
    `/stores/${storeId}/whatsapp/conversations/unread-count`
  );
}

export async function getMessages(
  storeId: string,
  conversationId: string,
  params?: { skip?: number; limit?: number }
) {
  const qs = new URLSearchParams();
  if (params?.skip) qs.set("skip", String(params.skip));
  if (params?.limit) qs.set("limit", String(params.limit));
  return apiClient<{
    messages: MessageBubble[];
    total: number;
    window_open: boolean;
    window_expires_at: string | null;
  }>(`/stores/${storeId}/whatsapp/conversations/${conversationId}/messages?${qs}`);
}

export async function sendMessage(
  storeId: string,
  conversationId: string,
  body: { text?: string; template_id?: string; template_params?: Record<string, string>; media_url?: string; media_caption?: string }
) {
  return apiClient<MessageBubble>(
    `/stores/${storeId}/whatsapp/conversations/${conversationId}/send`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function updateConversation(
  storeId: string,
  conversationId: string,
  body: { status?: string; assigned_to?: string; mark_read?: boolean }
) {
  return apiClient<ConversationSummary>(
    `/stores/${storeId}/whatsapp/conversations/${conversationId}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
}

// ── Campaigns ──

export async function listCampaigns(storeId: string) {
  return apiClient<{ campaigns: Campaign[]; total: number }>(
    `/stores/${storeId}/whatsapp/campaigns`
  );
}

export async function createCampaign(
  storeId: string,
  data: { name: string; template_id: string; audience_filter?: Record<string, unknown>; template_params?: Record<string, string> }
) {
  return apiClient<Campaign>(
    `/stores/${storeId}/whatsapp/campaigns`,
    { method: "POST", body: JSON.stringify(data) }
  );
}

export async function getCampaign(storeId: string, campaignId: string) {
  return apiClient<Campaign>(
    `/stores/${storeId}/whatsapp/campaigns/${campaignId}`
  );
}

export async function sendCampaignNow(storeId: string, campaignId: string) {
  return apiClient<Campaign>(
    `/stores/${storeId}/whatsapp/campaigns/${campaignId}/send`,
    { method: "POST" }
  );
}

export async function scheduleCampaign(storeId: string, campaignId: string, scheduledAt: string) {
  return apiClient<Campaign>(
    `/stores/${storeId}/whatsapp/campaigns/${campaignId}/schedule`,
    { method: "POST", body: JSON.stringify({ scheduled_at: scheduledAt }) }
  );
}

export async function cancelCampaign(storeId: string, campaignId: string) {
  return apiClient<Campaign>(
    `/stores/${storeId}/whatsapp/campaigns/${campaignId}/cancel`,
    { method: "POST" }
  );
}

export async function estimateAudience(
  storeId: string,
  filter: Record<string, unknown>
) {
  return apiClient<AudienceEstimate>(
    `/stores/${storeId}/whatsapp/campaigns/estimate-audience`,
    { method: "POST", body: JSON.stringify(filter) }
  );
}

// ─────────────────────────────────────────────────────────────────────
// backend-030 — BYO connect / opt-ins / scheduled-sends / dead-letters
// ─────────────────────────────────────────────────────────────────────

// ── BYO connection ──

export type WhatsAppMode = "platform_managed" | "byo";

export interface WhatsAppNotificationSettings {
  order_confirmation: boolean;
  payment_received: boolean;
  shipping_update: boolean;
  delivery_confirmation: boolean;
  abandoned_cart: boolean;
  marketing: boolean;
}

export interface WhatsAppStatus {
  mode: WhatsAppMode;
  connected: boolean;
  phone_display_name: string | null;
  display_phone_number: string | null;
  waba_id: string | null;
  last_validated_at: string | null;
  credential_error: string | null;
  notifications: WhatsAppNotificationSettings;
}

export interface BYOConnectRequest {
  access_token: string;
  phone_number_id: string;
  waba_id: string;
  app_secret: string;
}

/**
 * Returned as the `detail` body of a 422 from POST /byo/connect.
 * The `failed_step` tells the operator which of the 3 Meta read calls
 * blocked — the most actionable diagnostic for a typo. The Meta error
 * body is sanitized (fbtrace_id et al. stripped server-side per
 * TASK-SEC-009).
 */
export interface BYOValidationFailure {
  failed_step:
    | "phone_metadata_read"
    | "waba_info_read"
    | "template_list_read";
  code:
    | "phone_number_unreachable"
    | "waba_mismatch"
    | "insufficient_scope"
    | "meta_api_unavailable"
    | "unknown";
  message: string;
  meta_error: {
    code?: number | string;
    error_subcode?: number | string;
    message?: string;
    type?: string;
  } | null;
}

export async function byoConnect(
  storeId: string,
  body: BYOConnectRequest
) {
  return apiClient<WhatsAppStatus>(
    `/stores/${storeId}/whatsapp/byo/connect`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function byoDisconnect(storeId: string) {
  return apiClient<WhatsAppStatus>(
    `/stores/${storeId}/whatsapp/byo/disconnect`,
    { method: "DELETE" }
  );
}

export async function getByoStatus(storeId: string) {
  return apiClient<WhatsAppStatus>(
    `/stores/${storeId}/whatsapp/byo/status`,
    { method: "GET" }
  );
}

export async function updateByoNotifications(
  storeId: string,
  toggles: Partial<WhatsAppNotificationSettings>
) {
  return apiClient<WhatsAppNotificationSettings>(
    `/stores/${storeId}/whatsapp/byo/notifications`,
    { method: "PATCH", body: JSON.stringify(toggles) }
  );
}

// ── Opt-ins ──

export type OptInSource =
  | "checkout"
  | "signup"
  | "import"
  | "api"
  | "inbound_reply";

export type OptOutReason =
  | "inbound_stop_keyword"
  | "merchant_revoke"
  | "customer_request_via_support"
  | "api_revoke";

export interface OptInRow {
  id: string;
  store_id: string;
  customer_id: string | null;
  phone: string;
  source: OptInSource;
  opted_in_at: string;
  opted_out_at: string | null;
  opt_out_reason: OptOutReason | null;
}

export async function listOptIns(
  storeId: string,
  params: {
    phone?: string;
    active_only?: boolean;
    skip?: number;
    limit?: number;
  } = {}
) {
  const qs = new URLSearchParams();
  if (params.phone) qs.set("phone", params.phone);
  if (params.active_only) qs.set("active_only", "true");
  if (params.skip != null) qs.set("skip", String(params.skip));
  if (params.limit != null) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiClient<OptInRow[]>(
    `/stores/${storeId}/whatsapp/opt-ins${suffix}`
  );
}

export async function createOptIn(
  storeId: string,
  body: { phone: string; customer_id?: string; source: OptInSource }
) {
  return apiClient<OptInRow>(`/stores/${storeId}/whatsapp/opt-ins`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function revokeOptIn(
  storeId: string,
  body: { phone: string; reason: Exclude<OptOutReason, "inbound_stop_keyword"> }
) {
  return apiClient<OptInRow>(
    `/stores/${storeId}/whatsapp/opt-ins/revoke`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

// ── Scheduled sends ──

export type ScheduledSendStatus =
  | "pending"
  | "sent"
  | "cancelled"
  | "skipped"
  | "failed";

export interface ScheduledSend {
  id: string;
  store_id: string;
  customer_id: string | null;
  phone: string;
  template_id: string | null;
  template_params: Record<string, unknown> | null;
  text_message: string | null;
  scheduled_for: string;
  status: ScheduledSendStatus;
  skip_reason: string | null;
  failure_reason: string | null;
  related_order_id: string | null;
  created_by: string | null;
  created_at: string;
  dispatched_at: string | null;
  sent_at: string | null;
}

export interface ScheduledSendCreate {
  phone: string;
  customer_id?: string;
  template_id?: string;
  template_params?: Record<string, unknown>;
  text_message?: string;
  scheduled_for: string;
  related_order_id?: string;
}

export async function listScheduledSends(
  storeId: string,
  params: {
    status?: ScheduledSendStatus;
    related_order_id?: string;
    skip?: number;
    limit?: number;
  } = {}
) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.related_order_id)
    qs.set("related_order_id", params.related_order_id);
  if (params.skip != null) qs.set("skip", String(params.skip));
  if (params.limit != null) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiClient<ScheduledSend[]>(
    `/stores/${storeId}/whatsapp/scheduled-sends${suffix}`
  );
}

export async function createScheduledSend(
  storeId: string,
  body: ScheduledSendCreate
) {
  return apiClient<ScheduledSend>(
    `/stores/${storeId}/whatsapp/scheduled-sends`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function getScheduledSend(storeId: string, sendId: string) {
  return apiClient<ScheduledSend>(
    `/stores/${storeId}/whatsapp/scheduled-sends/${sendId}`
  );
}

export async function cancelScheduledSend(
  storeId: string,
  sendId: string
) {
  return apiClient<void>(
    `/stores/${storeId}/whatsapp/scheduled-sends/${sendId}`,
    { method: "DELETE" }
  );
}

// ── Dead-letters ──

export type DeadLetterOriginatingContext =
  | "order_created"
  | "order_paid"
  | "order_status_changed"
  | "campaign"
  | "scheduled_send"
  | "abandoned_cart"
  | "ad_hoc";

export type DeadLetterReplayState =
  | "not_replayed"
  | "replaying"
  | "replayed_success"
  | "replayed_failed";

export interface DeadLetterErrorEntry {
  attempt_n: number;
  at: string;
  http_status: number | null;
  meta_error_code: string | null;
  error_message: string;
}

export interface DeadLetter {
  id: string;
  store_id: string;
  phone: string;
  customer_id: string | null;
  template_id: string | null;
  template_params: Record<string, unknown> | null;
  text_message: string | null;
  originating_context: DeadLetterOriginatingContext;
  originating_context_id: string | null;
  error_history: DeadLetterErrorEntry[];
  error_classification: "retriable_exhausted" | "non_retriable";
  final_error_code: string | null;
  replay_state: DeadLetterReplayState;
  replayed_at: string | null;
  replayed_by: string | null;
  replayed_send_id: string | null;
  created_at: string;
}

export interface DeadLetterReplayResponse {
  status:
    | "replaying"
    | "replayed_success"
    | "replayed_failed"
    | "already_sent";
  reason?: "already_sent";
  enqueued?: boolean;
  originating_context?: string;
  replayed_send_id?: string;
}

export async function listDeadLetters(
  storeId: string,
  params: {
    originating_context?: DeadLetterOriginatingContext;
    replay_state?: DeadLetterReplayState;
    error_classification?: "retriable_exhausted" | "non_retriable";
    created_after?: string;
    skip?: number;
    limit?: number;
  } = {}
) {
  const qs = new URLSearchParams();
  if (params.originating_context)
    qs.set("originating_context", params.originating_context);
  if (params.replay_state) qs.set("replay_state", params.replay_state);
  if (params.error_classification)
    qs.set("error_classification", params.error_classification);
  if (params.created_after) qs.set("created_after", params.created_after);
  if (params.skip != null) qs.set("skip", String(params.skip));
  if (params.limit != null) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiClient<DeadLetter[]>(
    `/stores/${storeId}/whatsapp/dead-letters${suffix}`
  );
}

export async function getDeadLetter(storeId: string, dlId: string) {
  return apiClient<DeadLetter>(
    `/stores/${storeId}/whatsapp/dead-letters/${dlId}`
  );
}

export async function replayDeadLetter(storeId: string, dlId: string) {
  return apiClient<DeadLetterReplayResponse>(
    `/stores/${storeId}/whatsapp/dead-letters/${dlId}/replay`,
    { method: "POST" }
  );
}
