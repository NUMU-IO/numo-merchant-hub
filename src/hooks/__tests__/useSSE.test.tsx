import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshSession = vi.fn();
vi.mock("@/services/authApi", () => ({ refreshSession: () => refreshSession() }));

import { useSSE } from "@/hooks/useSSE";

const URL = "/api/v1/stores/s1/notifications/stream";

describe("useSSE on 401", () => {
  beforeEach(() => {
    refreshSession.mockReset().mockResolvedValue("ok");
    sessionStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 401, ok: false, body: null, headers: new Headers() }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("gives up while impersonating, because refreshing the cookie can't revive a handoff token", async () => {
    sessionStorage.setItem("numu.impersonation_token", "dead-token");

    renderHook(() => useSSE({ url: URL, reconnectInterval: 10 }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 80));
    expect(refreshSession).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refreshes once for a cookie session, then backs off instead of looping", async () => {
    renderHook(() => useSSE({ url: URL, reconnectInterval: 10_000 }));

    await waitFor(() => expect(refreshSession).toHaveBeenCalledTimes(1));
    // The retry after the refresh 401s too; the next attempt waits for the
    // backoff rather than refreshing again.
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 120));
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
