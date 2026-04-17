type EventHandler = (event: unknown) => void;

interface InboxSocketOptions {
  storeId: string;
  wsUrl: string;
}

export class InboxSocket {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private options: InboxSocketOptions | null = null;

  connect(options: InboxSocketOptions) {
    this.options = options;
    const url = `${options.wsUrl}/ws/inbox/${options.storeId}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data.type;
        this.listeners.get(type)?.forEach((handler) => handler(data));
        this.listeners.get("*")?.forEach((handler) => handler(data));
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this.stopPing();
      if (this.options) {
        setTimeout(() => this.connect(this.options!), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  on(type: string, handler: EventHandler): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
    return () => {
      this.listeners.get(type)?.delete(handler);
    };
  }

  disconnect() {
    this.stopPing();
    this.ws?.close();
    this.ws = null;
    this.options = null;
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

export const createInboxSocket = () => new InboxSocket();