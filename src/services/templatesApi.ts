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

// ── Backend wire shape ──
// NUMU-api returns flat templates (`body_text` + `buttons` + `header_*`),
// not Meta's nested `components[]`. We map to `components[]` here so the
// UI (preview modal, templates page, WhatsApp overview) keeps a single
// Meta-native shape. Keep this in sync with NUMU-api
// `schemas/stores/whatsapp.py::TemplateResponse`.
interface ApiTemplate {
  id: string;
  name: string;
  language: string;
  category: WhatsAppTemplate["category"];
  status: WhatsAppTemplate["status"];
  header_type: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
  header_content: string | null;
  body_text: string;
  footer_text: string | null;
  buttons: TemplateButton[] | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

function toComponents(t: ApiTemplate): TemplateComponent[] {
  const components: TemplateComponent[] = [];
  if (t.header_type) {
    components.push({
      type: "HEADER",
      format: t.header_type,
      // Only TEXT headers carry inline text; media headers are sample-only.
      ...(t.header_type === "TEXT" && t.header_content
        ? { text: t.header_content }
        : {}),
    });
  }
  components.push({ type: "BODY", text: t.body_text });
  if (t.footer_text) components.push({ type: "FOOTER", text: t.footer_text });
  if (t.buttons && t.buttons.length > 0) {
    components.push({ type: "BUTTONS", buttons: t.buttons });
  }
  return components;
}

function toTemplate(t: ApiTemplate): WhatsAppTemplate {
  return {
    id: t.id,
    name: t.name,
    language: t.language,
    category: t.category,
    status: t.status,
    components: toComponents(t),
    rejection_reason: t.rejection_reason,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

export async function listTemplates(
  storeId: string,
  cursor?: string,
  limit = 20,
): Promise<TemplatesResponse> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (cursor) qs.set("cursor", cursor);
  // No trailing slash before the query string: the API runs with
  // redirect_slashes=False and the list route is registered as "" (i.e.
  // /whatsapp/templates), so `/templates/?...` 404s instead of matching.
  const res = await apiClient<{ templates: ApiTemplate[]; total: number }>(
    `/stores/${storeId}/whatsapp/templates?${qs}`,
  );
  return {
    templates: (res.templates ?? []).map(toTemplate),
    next_cursor: null,
  };
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
  return apiClient(`/stores/${storeId}/whatsapp/templates`, {
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