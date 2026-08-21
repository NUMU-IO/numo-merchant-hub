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

// The API returns threads with flat participant_* fields; the UI works
// with a nested `participant` object.
interface RawThread {
  id: string;
  channel: ThreadDTO["channel"];
  participant_name: string | null;
  participant_avatar_url: string | null;
  participant_phone: string | null;
  status: ThreadDTO["status"];
  last_message_at: string;
  last_message_preview: string;
  unread_count: number;
}

// Meta withholds sender profiles until the app has Advanced Access, so a
// thread can legitimately have no name. Fall back to the channel's own
// label rather than a generic "Customer" for every row.
const channelLabels: Record<ThreadDTO["channel"], string> = {
  facebook: "Messenger",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
};

function mapThread(raw: RawThread): ThreadDTO {
  return {
    id: raw.id,
    channel: raw.channel,
    status: raw.status,
    last_message_at: raw.last_message_at,
    last_message_preview: raw.last_message_preview ?? "",
    unread_count: raw.unread_count ?? 0,
    participant: {
      id: raw.id,
      name:
        raw.participant_name ||
        raw.participant_phone ||
        `${channelLabels[raw.channel]} · ${String(raw.id).slice(0, 4)}`,
      avatar_url: raw.participant_avatar_url ?? null,
      phone_e164: raw.participant_phone ?? null,
    },
  };
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
  const res = await apiClient(`/stores/${storeId}/threads/${query ? `?${query}` : ""}`) as {
    threads: RawThread[];
    next_cursor: string | null;
    total_unread: number;
  };
  return {
    threads: (res.threads ?? []).map(mapThread),
    next_cursor: res.next_cursor ?? null,
    total_unread: res.total_unread ?? 0,
  };
}

export async function getThread(storeId: string, threadId: string): Promise<ThreadDTO> {
  const raw = await apiClient(`/stores/${storeId}/threads/${threadId}`) as RawThread;
  return mapThread(raw);
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