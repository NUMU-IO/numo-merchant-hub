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

export interface NotificationSettings {
  order_confirmation: NotificationToggle;
  order_shipped: NotificationToggle;
  out_for_delivery: NotificationToggle;
  order_delivered: NotificationToggle;
  payment_received: NotificationToggle;
  abandoned_cart: NotificationToggle;
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
