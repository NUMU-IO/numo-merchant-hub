import { apiClient } from "@/services/api";

export interface Participant {
  id: string;
  name: string;
  avatar_url: string | null;
  phone_e164: string | null;
}

export interface ThreadDTO {
  id: string;
  channel: "facebook" | "instagram" | "whatsapp";
  participant: Participant;
  status: "open" | "resolved" | "spam";
  last_message_at: string;
  last_message_preview: string;
  unread_count: number;
}

export interface MessageDTO {
  id: string;
  thread_id: string;
  direction: "inbound" | "outbound";
  type: "text" | "image" | "video" | "audio" | "document" | "sticker" | "template" | "product" | "system";
  body: string | null;
  attachment_url: string | null;
  attachment_mime: string | null;
  template_name: string | null;
  product_id: string | null;
  status: "sent" | "delivered" | "read" | "failed" | "received";
  error_code: string | null;
  created_at: string;
  external_timestamp: string;
}

export interface ThreadsResponse {
  threads: ThreadDTO[];
  next_cursor: string | null;
  total_unread: number;
}

export interface MessagesResponse {
  messages: MessageDTO[];
  next_cursor: string | null;
}

export interface ListThreadsParams {
  channel?: string;
  status?: string;
  unread_only?: boolean;
  search?: string;
  cursor?: string;
  limit?: number;
}

export async function listThreads(
  storeId: string,
  params?: ListThreadsParams,
): Promise<ThreadsResponse> {
  const qs = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        qs.set(k, String(v));
      }
    });
  }
  const query = qs.toString();
  return apiClient(`/stores/${storeId}/threads/${query ? `?${query}` : ""}`);
}

export async function getThread(storeId: string, threadId: string): Promise<ThreadDTO> {
  return apiClient(`/stores/${storeId}/threads/${threadId}`);
}

export async function listMessages(
  storeId: string,
  threadId: string,
  cursor?: string,
  limit = 50,
): Promise<MessagesResponse> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (cursor) qs.set("cursor", cursor);
  return apiClient(`/stores/${storeId}/threads/${threadId}/messages/?${qs}`);
}

export interface SendMessagePayload {
  type: string;
  text?: string;
  media_upload_id?: string;
  template_id?: string;
  template_variables?: Record<string, string>;
  product_id?: string;
}

export async function sendMessage(
  storeId: string,
  threadId: string,
  payload: SendMessagePayload,
): Promise<MessageDTO> {
  return apiClient(`/stores/${storeId}/threads/${threadId}/messages/send`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
}

export async function markThreadRead(storeId: string, threadId: string): Promise<void> {
  return apiClient(`/stores/${storeId}/threads/${threadId}/read`, { method: "POST" });
}

export async function resolveThread(storeId: string, threadId: string): Promise<void> {
  return apiClient(`/stores/${storeId}/threads/${threadId}/resolve`, { method: "POST" });
}