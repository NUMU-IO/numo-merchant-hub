import { useEffect, useRef, useState, useCallback } from "react";
import { refreshSession } from "@/services/authApi";

interface UseSSEOptions<T> {
  url: string;
  enabled?: boolean;
  onMessage?: (data: T) => void;
  /** Base delay before reconnecting; grows ×2 per consecutive failure. */
  reconnectInterval?: number;
}

const MAX_RECONNECT_MS = 60_000;

// The native EventSource can't send an Authorization header or the tenant
// header, and it only carries cookies. That breaks the two ways the hub
// authenticates: impersonation (a Bearer handoff token in sessionStorage, no
// cookie) always 401'd → the live-analytics badge showed "Disconnected" even
// though the 30s snapshot poll kept working. This fetch + ReadableStream SSE
// reader sends the same auth headers apiClient does, so the stream connects
// under both a real cookie session and impersonation.
//
// Resilience rules (these streams bypass apiClient, so they need their own):
//  - 401 → one session refresh, then reconnect. If the refresh says the
//    session is really over, STOP reconnecting: a dead session used to keep
//    hammering the API every few seconds forever, eating the IP's rate
//    budget while the merchant sat on the login screen.
//  - 429 → wait Retry-After (or the backoff), never tighter.
//  - anything else → exponential backoff, capped at 60 s, reset on success.
const IMPERSONATION_TOKEN_KEY = "numu.impersonation_token";

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "text/event-stream" };
  try {
    const handoff = sessionStorage.getItem(IMPERSONATION_TOKEN_KEY);
    if (handoff) h["Authorization"] = `Bearer ${handoff}`;
    const storeId = localStorage.getItem("numu-current-store");
    if (storeId) h["X-Tenant-Id"] = storeId;
  } catch {
    /* storage unavailable — cookie session still applies */
  }
  return h;
}

function retryAfterMs(res: Response): number | null {
  const raw = res.headers.get("Retry-After");
  if (!raw) return null;
  const secs = Number(raw);
  return Number.isFinite(secs) ? Math.max(0, secs * 1000) : null;
}

export function useSSE<T>({
  url,
  enabled = true,
  onMessage,
  reconnectInterval = 3000,
}: UseSSEOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const failures = useRef(0);
  const refreshedOnce = useRef(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(async () => {
    if (!enabled || !url) return;
    const controller = new AbortController();
    abortRef.current = controller;

    const scheduleReconnect = (overrideMs?: number) => {
      setConnected(false);
      if (controller.signal.aborted) return;
      failures.current += 1;
      const backoff = Math.min(
        reconnectInterval * 2 ** (failures.current - 1),
        MAX_RECONNECT_MS,
      );
      const wait = Math.max(overrideMs ?? 0, backoff);
      reconnectTimer.current = setTimeout(() => void connect(), wait);
    };

    try {
      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: authHeaders(),
        signal: controller.signal,
        cache: "no-store",
      });
      if (res.status === 401) {
        if (!refreshedOnce.current) {
          refreshedOnce.current = true;
          const outcome = await refreshSession();
          if (outcome === "ok") {
            refreshedOnce.current = false;
            failures.current = 0;
            void connect();
            return;
          }
          if (outcome === "expired") {
            setError("session expired");
            setConnected(false);
            return; // apiClient's next 401 takes the merchant to /login
          }
        }
        setError("stream 401");
        scheduleReconnect();
        return;
      }
      if (!res.ok || !res.body) {
        setError(`stream ${res.status}`);
        scheduleReconnect(res.status === 429 ? (retryAfterMs(res) ?? undefined) : undefined);
        return;
      }
      setConnected(true);
      setError(null);
      failures.current = 0;
      refreshedOnce.current = false;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // SSE frames are separated by a blank line; each `data:` line carries a
      // JSON payload. Parse incrementally so partial network chunks buffer.
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const dataLine = frame
            .split("\n")
            .find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          try {
            const parsed = JSON.parse(dataLine.slice(5).trim()) as T;
            setData(parsed);
            onMessageRef.current?.(parsed);
          } catch {
            /* ignore malformed frame */
          }
        }
      }
      // Stream ended cleanly (server closed) — reconnect promptly.
      failures.current = 0;
      scheduleReconnect();
    } catch (err) {
      if (controller.signal.aborted) return; // unmount / re-run, not an error
      setError(String(err));
      scheduleReconnect();
    }
  }, [url, enabled, reconnectInterval]);

  useEffect(() => {
    failures.current = 0;
    refreshedOnce.current = false;
    void connect();
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  return { data, connected, error };
}
