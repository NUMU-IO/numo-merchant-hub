import { useEffect, useRef, useState, useCallback } from "react";

interface UseSSEOptions<T> {
  url: string;
  enabled?: boolean;
  onMessage?: (data: T) => void;
  reconnectInterval?: number;
}

export function useSSE<T>({ url, enabled = true, onMessage, reconnectInterval = 3000 }: UseSSEOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (!enabled || !url) return;

    try {
      const source = new EventSource(url);
      sourceRef.current = source;

      source.onopen = () => {
        setConnected(true);
        setError(null);
      };

      source.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as T;
          setData(parsed);
          onMessage?.(parsed);
        } catch {
          // ignore parse errors
        }
      };

      source.onerror = () => {
        setConnected(false);
        source.close();
        sourceRef.current = null;
        // Auto-reconnect
        reconnectTimer.current = setTimeout(connect, reconnectInterval);
      };
    } catch (err) {
      setError(String(err));
      setConnected(false);
    }
  }, [url, enabled, onMessage, reconnectInterval]);

  useEffect(() => {
    connect();
    return () => {
      sourceRef.current?.close();
      sourceRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  return { data, connected, error };
}
