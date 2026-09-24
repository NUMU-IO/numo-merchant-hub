/**
 * The hub side of the embedded-app bridge: messages an app framed at
 * `/apps/<slug>/app` may post to the hub. Only a message from that iframe's
 * window AND from the app's own origin is answered.
 */
export interface BridgeHost {
  origin: string;
  source: MessageEventSource | null;
  sessionToken: () => Promise<string>;
  navigate: (path: string) => void;
  toast: (message: string, kind: "success" | "error") => void;
  resize: (height: number) => void;
}

export async function handleAppMessage(event: MessageEvent, host: BridgeHost): Promise<void> {
  if (!host.source || event.source !== host.source || event.origin !== host.origin) return;
  const data = event.data as Record<string, unknown> | null;
  if (!data || typeof data !== "object") return;
  switch (data.type) {
    case "numu:session-token": {
      const reply: Record<string, unknown> = { type: "numu:session-token", id: data.id };
      try {
        reply.token = await host.sessionToken();
      } catch {
        reply.error = "unavailable";
      }
      (host.source as Window).postMessage(reply, host.origin);
      return;
    }
    case "numu:navigate":
      if (typeof data.path === "string" && /^\/(?![/\\])/.test(data.path)) host.navigate(data.path);
      return;
    case "numu:toast":
      if (typeof data.message === "string" && data.message.trim()) {
        host.toast(data.message.slice(0, 200), data.kind === "error" ? "error" : "success");
      }
      return;
    case "numu:resize":
      if (typeof data.height === "number" && Number.isFinite(data.height)) {
        host.resize(Math.min(Math.max(Math.round(data.height), 200), 10000));
      }
  }
}
