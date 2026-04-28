/**
 * Email Templates API service for the merchant dashboard.
 *
 * Backend routes (under /api/v1) are listed in the file header for quick reference:
 *   GET    /stores/{store_id}/email-templates/events
 *   GET    /stores/{store_id}/email-templates/events/{event_type}/default?language=ar|en
 *   GET    /stores/{store_id}/email-templates
 *   POST   /stores/{store_id}/email-templates
 *   GET    /stores/{store_id}/email-templates/{template_id}
 *   PUT    /stores/{store_id}/email-templates/{template_id}
 *   DELETE /stores/{store_id}/email-templates/{template_id}
 *   POST   /stores/{store_id}/email-templates/{template_id}/preview
 *   POST   /stores/{store_id}/email-templates/{template_id}/send-test
 */

import { apiClient } from "./api";

export type EmailTemplateLanguage = "en" | "ar";

export interface EmailTemplate {
  id: string;
  store_id: string;
  event_type: string;
  language: EmailTemplateLanguage;
  name: string;
  subject: string;
  html_body: string;
  is_enabled: boolean;
  from_name: string | null;
  reply_to: string | null;
  extra_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplateEventInfo {
  event_type: string;
  label_en: string;
  label_ar: string;
  variables: Record<string, string>;
  sample_data: Record<string, unknown>;
  default_subject_en: string;
  default_subject_ar: string;
}

export interface DefaultTemplate {
  event_type: string;
  language: EmailTemplateLanguage;
  subject: string;
  html_body: string;
}

export interface PreviewResponse {
  subject: string;
  html: string;
}

export interface SendTestResponse {
  sent: boolean;
  message_id: string | null;
}

export interface CreateEmailTemplateData {
  event_type: string;
  language: EmailTemplateLanguage;
  name: string;
  subject: string;
  html_body: string;
  is_enabled?: boolean;
  from_name?: string | null;
  reply_to?: string | null;
  extra_data?: Record<string, unknown> | null;
}

export interface UpdateEmailTemplateData {
  name?: string;
  subject?: string;
  html_body?: string;
  is_enabled?: boolean;
  from_name?: string | null;
  reply_to?: string | null;
  extra_data?: Record<string, unknown> | null;
}

export interface ListEmailTemplatesParams {
  event_type?: string;
  language?: EmailTemplateLanguage;
  is_enabled?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedEmailTemplates {
  items: EmailTemplate[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PreviewPayload {
  variables?: Record<string, unknown>;
}

export interface SendTestPayload {
  recipient: string;
  variables?: Record<string, unknown>;
}

export async function listEmailTemplates(
  storeId: string,
  params?: ListEmailTemplatesParams,
): Promise<PaginatedEmailTemplates> {
  const qs = new URLSearchParams();
  if (params?.event_type) qs.set("event_type", params.event_type);
  if (params?.language) qs.set("language", params.language);
  if (params?.is_enabled !== undefined) qs.set("is_enabled", String(params.is_enabled));
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString();
  return apiClient<PaginatedEmailTemplates>(
    `/stores/${storeId}/email-templates/${query ? `?${query}` : ""}`,
  );
}

export async function getEmailTemplate(
  storeId: string,
  templateId: string,
): Promise<EmailTemplate> {
  return apiClient<EmailTemplate>(
    `/stores/${storeId}/email-templates/${templateId}`,
  );
}

export async function createEmailTemplate(
  storeId: string,
  data: CreateEmailTemplateData,
): Promise<EmailTemplate> {
  return apiClient<EmailTemplate>(`/stores/${storeId}/email-templates/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateEmailTemplate(
  storeId: string,
  templateId: string,
  data: UpdateEmailTemplateData,
): Promise<EmailTemplate> {
  return apiClient<EmailTemplate>(
    `/stores/${storeId}/email-templates/${templateId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );
}

export async function deleteEmailTemplate(
  storeId: string,
  templateId: string,
): Promise<void> {
  return apiClient<void>(`/stores/${storeId}/email-templates/${templateId}`, {
    method: "DELETE",
  });
}

export async function listEmailTemplateEvents(
  storeId: string,
): Promise<EmailTemplateEventInfo[]> {
  return apiClient<EmailTemplateEventInfo[]>(
    `/stores/${storeId}/email-templates/events`,
  );
}

export async function getDefaultEmailTemplate(
  storeId: string,
  eventType: string,
  language: EmailTemplateLanguage,
): Promise<DefaultTemplate> {
  const qs = new URLSearchParams({ language });
  return apiClient<DefaultTemplate>(
    `/stores/${storeId}/email-templates/events/${encodeURIComponent(eventType)}/default?${qs}`,
  );
}

export async function previewEmailTemplate(
  storeId: string,
  templateId: string,
  variables?: Record<string, unknown>,
): Promise<PreviewResponse> {
  const payload: PreviewPayload = variables ? { variables } : {};
  return apiClient<PreviewResponse>(
    `/stores/${storeId}/email-templates/${templateId}/preview`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export interface PreviewDraftPayload {
  event_type: string;
  language: EmailTemplateLanguage;
  subject: string;
  html_body: string;
  variables?: Record<string, unknown>;
}

/**
 * Renders the in-flight editor buffer without saving. Lets the editor
 * show a live preview for both unsaved drafts (create mode) and dirty
 * edits to existing templates.
 */
export async function previewEmailTemplateDraft(
  storeId: string,
  payload: PreviewDraftPayload,
): Promise<PreviewResponse> {
  return apiClient<PreviewResponse>(
    `/stores/${storeId}/email-templates/preview-draft`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function sendTestEmailTemplate(
  storeId: string,
  templateId: string,
  payload: SendTestPayload,
): Promise<SendTestResponse> {
  return apiClient<SendTestResponse>(
    `/stores/${storeId}/email-templates/${templateId}/send-test`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
