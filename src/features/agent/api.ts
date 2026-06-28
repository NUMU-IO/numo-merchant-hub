/**
 * Agent SSE client.
 *
 * POSTs a message to the store-scoped agent chat endpoint and parses the
 * server-sent event stream (the browser EventSource API only supports GET, so
 * we read the fetch body stream manually). Reuses the Hub's CSRF + tenant
 * conventions from services/api.ts (X-CSRF-Token, X-Tenant-Id).
 */
import { getCSRFToken } from "@/services/csrf";

const API_BASE = import.meta.env.VITE_API_URL || "";

export interface AgentEvent {
  type: string; // meta | token | message | tool_call | tool_result | done | error
  data: Record<string, unknown>;
}

export interface ChatRequestBody {
  message: string;
  conversation_id?: string | null;
  locale?: "ar" | "en";
}

/** Stream a turn. Calls `onEvent` for each parsed SSE event. */
export async function streamAgentChat(
  storeId: string,
  body: ChatRequestBody,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const csrf = getCSRFToken();
  if (csrf) headers["X-CSRF-Token"] = csrf;
  const tenant = localStorage.getItem("numu-current-store");
  if (tenant) headers["X-Tenant-Id"] = tenant;

  const res = await fetch(`${API_BASE}/stores/${storeId}/agent/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    credentials: "include",
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`Agent request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // SSE frames are separated by a blank line; each frame has `event:` + `data:`.
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const event = parseFrame(frame);
      if (event) onEvent(event);
    }
  }
}

function jsonHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const csrf = getCSRFToken();
  if (csrf) headers["X-CSRF-Token"] = csrf;
  const tenant = localStorage.getItem("numu-current-store");
  if (tenant) headers["X-Tenant-Id"] = tenant;
  return headers;
}

/** Confirm or decline a pending write proposal (US2 gated write path). */
export async function confirmProposal(
  storeId: string,
  proposalId: string,
  decision: "confirm" | "decline",
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/stores/${storeId}/agent/confirm`, {
    method: "POST",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify({ proposal_id: proposalId, decision }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { detail?: { message?: string } })?.detail?.message || `Confirm failed (${res.status})`);
  return data as Record<string, unknown>;
}

/** Undo the last applied change in a conversation. */
export async function undoLast(
  storeId: string,
  conversationId: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/stores/${storeId}/agent/undo`, {
    method: "POST",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify({ conversation_id: conversationId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { detail?: { message?: string } })?.detail?.message || `Undo failed (${res.status})`);
  return data as Record<string, unknown>;
}

function parseFrame(frame: string): AgentEvent | null {
  let type = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) type = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    return { type, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return { type, data: { raw: dataLines.join("\n") } };
  }
}
