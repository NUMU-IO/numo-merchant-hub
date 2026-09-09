/**
 * `/auth/me` decides who the hub thinks it is talking to: the greeting, the
 * tenant, the plan, the feature flags, the read-only state, the trial banner.
 *
 * It authenticated by COOKIE alone, and in an admin impersonation tab the
 * cookie belongs to the ADMIN. So it answered with the operator's identity and
 * the operator's tenant, while every other request — which does send the
 * handoff Bearer — answered as the merchant. The hub greeted the operator by
 * name over the merchant's dashboard, and the merchant's trial banner never
 * appeared because the lifecycle came off the wrong account.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMe } from "../authApi";

function ok(body: unknown) {
  return new Response(JSON.stringify({ data: body }), { status: 200 });
}

describe("getMe", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    if (typeof AbortSignal.timeout !== "function") {
      (AbortSignal as unknown as { timeout: () => AbortSignal }).timeout = () =>
        new AbortController().signal;
    }
  });

  it("sends the impersonation Bearer, so it answers as the merchant", async () => {
    sessionStorage.setItem("numu.impersonation_token", "handoff-abc");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok({ id: "u1" }));

    await getMe();

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer handoff-abc");
  });

  it("scopes the tenant to the store the hub is showing", async () => {
    // A multi-store merchant otherwise gets their NEWEST tenant reported,
    // which is not necessarily the store on screen — so plan, lifecycle and
    // the trial countdown would describe a different shop.
    localStorage.setItem("numu-current-store", "store-42");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok({ id: "u1" }));

    await getMe();

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-Tenant-Id"]).toBe("store-42");
  });

  it("sends no Authorization header in an ordinary session", async () => {
    // A normal merchant authenticates by cookie; an empty Bearer would be
    // rejected outright.
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok({ id: "u1" }));

    await getMe();

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect((fetchMock.mock.calls[0][1] as RequestInit).credentials).toBe("include");
  });
});
