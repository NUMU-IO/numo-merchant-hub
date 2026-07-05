import { useEffect, useRef, useState, useCallback } from "react";

interface UseSSEOptions<T> {
  url: string;
  enabled?: boolean;
  onMessage?: (data: T) => void;
  reconnectInterval?: number;
}

// The native EventSource can't send an Authorization header or the tenant
// header, and it only carries cookies. That breaks the two ways the hub
// authenticates: impersonation (a Bearer handoff token in sessionStorage, no
// cookie) always 401'd → the live-analytics badge showed "Disconnected" even
// though the 30s snapshot poll kept working. This fetch + ReadableStream SSE
// reader sends the same auth headers apiClient does, so the stream connects
// under both a real cookie session and impersonation.
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
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(async () => {
    if (!enabled || !url) return;
    const controller = new AbortController();
    abortRef.current = controller;

    const scheduleReconnect = () => {
      setConnected(false);
      if (controller.signal.aborted) return;
      reconnectTimer.current = setTimeout(() => void connect(), reconnectInterval);
    };

    try {
      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: authHeaders(),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok || !res.body) {
        setError(`stream ${res.status}`);
        scheduleReconnect();
        return;
      }
      setConnected(true);
      setError(null);

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
      // Stream ended cleanly (server closed) — reconnect.
      scheduleReconnect();
    } catch (err) {
      if (controller.signal.aborted) return; // unmount / re-run, not an error
      setError(String(err));
      scheduleReconnect();
    }
  }, [url, enabled, reconnectInterval]);

  useEffect(() => {
    void connect();
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  return { data, connected, error };
}
