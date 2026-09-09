/**
 * The double-submit guard compares header to cookie. These pin that the
 * header is READ FROM the cookie, which is what makes two open tabs agree.
 *
 * Before this, the token lived only in a per-tab JS variable while
 * `/auth/csrf-token` minted a new one and overwrote the shared cookie on
 * every call — so opening the hub in a second tab (or the admin app, same
 * `.numueg.app` cookie) silently broke every mutation in the first:
 *
 *   CSRF validation failed for POST /agent/chat
 *   Cookie token: w-HRbDyMEB1Dv…  Header token: 5cMU8h8T2EK5e…
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearCSRFToken, getCSRFToken, initCSRF } from "../csrf";

function setCookie(value: string | null) {
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => (value === null ? "" : `csrf_token=${value}`),
  });
}

describe("csrf", () => {
  beforeEach(() => {
    clearCSRFToken();
    setCookie(null);
    vi.restoreAllMocks();
    if (typeof AbortSignal.timeout !== "function") {
      // jsdom does not implement it; every browser the hub supports has since
      // 2022. Without this the fetch throws before it is ever issued, and the
      // module's own retry loop swallows it as a network failure.
      (AbortSignal as unknown as { timeout: () => AbortSignal }).timeout = () =>
        new AbortController().signal;
    }
  });

  it("sends whatever the cookie currently says, not what this tab booted with", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { csrf_token: "first" } }), {
          status: 200,
        }),
      );

    await initCSRF();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Another tab loaded and rotated the shared cookie.
    setCookie("rotated-by-another-tab");
    expect(getCSRFToken()).toBe("rotated-by-another-tab");
  });

  it("does not mint a new token when the cookie already has one", async () => {
    // Minting is the rotation that breaks the other tab, so a boot with a
    // usable cookie must not call the endpoint at all.
    const fetchMock = vi.spyOn(globalThis, "fetch");
    setCookie("already-here");

    await expect(initCSRF()).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getCSRFToken()).toBe("already-here");
  });

  it("mints on force, because a real 403 means the cookie itself is rejected", async () => {
    setCookie("stale-but-present");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { csrf_token: "fresh" } }), {
          status: 200,
        }),
      );

    await expect(initCSRF(true)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the in-memory token when the cookie cannot be read", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { csrf_token: "in-memory" } }), {
        status: 200,
      }),
    );

    await initCSRF();
    // Cookie stays unreadable (blocked third-party context, for instance).
    expect(getCSRFToken()).toBe("in-memory");
  });

  it("gives up quietly with no session rather than retrying a 401", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("", { status: 401 }));

    await expect(initCSRF()).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
