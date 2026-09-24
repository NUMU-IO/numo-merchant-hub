import { describe, expect, it, vi } from "vitest";

import { type BridgeHost, handleAppMessage } from "../appBridge";

const ORIGIN = "https://app.example.com";

function setup() {
  const frame = { postMessage: vi.fn() };
  const host: BridgeHost = {
    origin: ORIGIN,
    source: frame as unknown as MessageEventSource,
    sessionToken: vi.fn(async () => "jwt"),
    navigate: vi.fn(),
    toast: vi.fn(),
    resize: vi.fn(),
  };
  const send = (data: unknown, origin = ORIGIN, source: unknown = frame) =>
    handleAppMessage({ data, origin, source } as unknown as MessageEvent, host);
  return { frame, host, send };
}

describe("handleAppMessage", () => {
  it("answers a session-token request to the app's origin only", async () => {
    const { frame, send } = setup();
    await send({ type: "numu:session-token", id: 7 });
    expect(frame.postMessage).toHaveBeenCalledWith(
      { type: "numu:session-token", id: 7, token: "jwt" },
      ORIGIN,
    );
  });

  it("ignores another origin, or another window on the right origin", async () => {
    const { frame, host, send } = setup();
    await send({ type: "numu:session-token" }, "https://evil.example");
    await send({ type: "numu:session-token" }, ORIGIN, {});
    await send({ type: "numu:navigate", path: "/orders" }, "https://app.example.com.evil.example");
    expect(host.sessionToken).not.toHaveBeenCalled();
    expect(frame.postMessage).not.toHaveBeenCalled();
    expect(host.navigate).not.toHaveBeenCalled();
  });

  it("navigates only to hub paths", async () => {
    const { host, send } = setup();
    await send({ type: "numu:navigate", path: "/orders" });
    await send({ type: "numu:navigate", path: "//evil.example" });
    await send({ type: "numu:navigate", path: "/\\evil.example" });
    await send({ type: "numu:navigate", path: "https://evil.example" });
    await send({ type: "numu:navigate", path: "javascript:alert(1)" });
    expect(host.navigate).toHaveBeenCalledTimes(1);
    expect(host.navigate).toHaveBeenCalledWith("/orders");
  });

  it("clamps toasts and heights", async () => {
    const { host, send } = setup();
    await send({ type: "numu:toast", message: "x".repeat(500), kind: "error" });
    await send({ type: "numu:resize", height: 99999 });
    await send({ type: "numu:resize", height: "big" });
    expect(host.toast).toHaveBeenCalledWith("x".repeat(200), "error");
    expect(host.resize).toHaveBeenCalledTimes(1);
    expect(host.resize).toHaveBeenCalledWith(10000);
  });

  it("reports a failed token without throwing", async () => {
    const { frame, host, send } = setup();
    host.sessionToken = vi.fn(async () => {
      throw new Error("409");
    });
    await send({ type: "numu:session-token", id: 1 });
    expect(frame.postMessage).toHaveBeenCalledWith(
      { type: "numu:session-token", id: 1, error: "unavailable" },
      ORIGIN,
    );
  });
});
