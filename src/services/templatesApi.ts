import { apiClient } from "@/services/api";

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: "PENDING" | "APPROVED" | "REJECTED";
  components: TemplateComponent[];
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  buttons?: TemplateButton[];
}

export interface TemplateButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phone_number?: string;
}

export interface TemplatesResponse {
  templates: WhatsAppTemplate[];
  next_cursor: string | null;
}

export async function listTemplates(
  storeId: string,
  cursor?: string,
  limit = 20,
): Promise<TemplatesResponse> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (cursor) qs.set("cursor", cursor);
  return apiClient(`/stores/${storeId}/whatsapp/templates/?${qs}`);
}

export interface CreateTemplatePayload {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  header?: string;
  body: string;
  footer?: string;
  buttons?: TemplateButton[];
}

export async function createTemplate(
  storeId: string,
  payload: CreateTemplatePayload,
): Promise<WhatsAppTemplate> {
  return apiClient(`/stores/${storeId}/whatsapp/templates/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function submitTemplate(storeId: string, templateId: string): Promise<WhatsAppTemplate> {
  return apiClient(`/stores/${storeId}/whatsapp/templates/${templateId}/submit`, {
    method: "POST",
  });
}

export async function deleteTemplate(storeId: string, templateId: string): Promise<void> {
  return apiClient(`/stores/${storeId}/whatsapp/templates/${templateId}`, {
    method: "DELETE",
  });
}