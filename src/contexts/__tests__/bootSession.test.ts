/**
 * Boot-time session restore.
 *
 * The installed PWA is killed by the OS when backgrounded, so the 20-minute
 * proactive rotation inside AuthProvider stops the moment the merchant
 * switches away. Prod issues a 30-minute access token against a multi-day
 * refresh token, so every cold start past that half hour arrives with an
 * expired access cookie and a perfectly good refresh cookie.
 *
 * The boot check used to read that 401 as "session over" and bounce to
 * /login without ever spending the refresh cookie — which is why the PWA
 * asked for a password several times a day while a desktop tab left open
 * never did.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@/lib/api-error";

const getMe = vi.fn();
const refreshSession = vi.fn();

vi.mock("@/services/authApi", () => ({
  getMe: (...args: unknown[]) => getMe(...args),
  refreshSession: (...args: unknown[]) => refreshSession(...args),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  complete2FALogin: vi.fn(),
  googleLogin: vi.fn(),
  TwoFactorRequiredError: class extends Error {},
}));
vi.mock("@/services/csrf", () => ({ initCSRF: vi.fn() }));
vi.mock("@/lib/register-sw", () => ({ purgeServiceWorkerCaches: vi.fn() }));
vi.mock("@/services/pushApi", () => ({ revokePushSubscription: vi.fn() }));
vi.mock("@/lib/query-persist", () => ({ clearPersistedQueries: vi.fn() }));

const { bootSession } = await import("../AuthContext");

const USER = { id: "u1", email: "merchant@numueg.app" };

beforeEach(() => {
  getMe.mockReset();
  refreshSession.mockReset();
});

describe("bootSession", () => {
  it("returns the user when the access cookie is still valid", async () => {
    getMe.mockResolvedValueOnce(USER);

    await expect(bootSession()).resolves.toEqual(USER);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("spends the refresh cookie when the access token has expired", async () => {
    // The PWA cold-start case: 401, but the session is alive.
    getMe.mockRejectedValueOnce(new ApiError(401, null));
    refreshSession.mockResolvedValueOnce("ok");
    getMe.mockResolvedValueOnce(USER);

    await expect(bootSession()).resolves.toEqual(USER);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(getMe).toHaveBeenCalledTimes(2);
  });

  it("gives up only when the refresh cookie is itself expired", async () => {
    getMe.mockRejectedValueOnce(new ApiError(401, null));
    refreshSession.mockResolvedValueOnce("expired");

    await expect(bootSession()).rejects.toMatchObject({ status: 401 });
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it("reports a blipped refresh as a network failure, not a logout", async () => {
    // 429 / 5xx / offline. Status 0 routes the caller into the cached-session
    // branch instead of clearing the session.
    getMe.mockRejectedValueOnce(new ApiError(401, null));
    refreshSession.mockResolvedValueOnce("transient");

    await expect(bootSession()).rejects.toMatchObject({ status: 0 });
  });

  it("never burns a refresh on a non-401 failure", async () => {
    getMe.mockRejectedValueOnce(new ApiError(0, null));

    await expect(bootSession()).rejects.toMatchObject({ status: 0 });
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("does not retry forever when the refreshed token is also rejected", async () => {
    getMe.mockRejectedValueOnce(new ApiError(401, null));
    refreshSession.mockResolvedValueOnce("ok");
    getMe.mockRejectedValueOnce(new ApiError(401, null));

    await expect(bootSession()).rejects.toMatchObject({ status: 401 });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(getMe).toHaveBeenCalledTimes(2);
  });
});
