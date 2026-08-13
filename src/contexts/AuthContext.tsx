/**
 * AuthContext — manages authentication state for the dashboard.
 *
 * Session is determined by an httpOnly cookie set by the backend.
 * On mount, validates the session by calling GET /auth/me.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  login as loginApi,
  register as registerApi,
  logout as logoutApi,
  getMe,
  complete2FALogin as complete2FALoginApi,
  googleLogin as googleLoginApi,
  TwoFactorRequiredError,
} from "@/services/authApi";
import { initCSRF } from "@/services/csrf";
import { purgeServiceWorkerCaches } from "@/lib/register-sw";
import { revokePushSubscription } from "@/services/pushApi";
import { clearPersistedQueries } from "@/lib/query-persist";
import type { User, RegisterData, TenantInfo } from "@/services/authApi";

/**
 * Last known signed-in user, so an OFFLINE boot can render the app instead of
 * bouncing to /login.
 *
 * Holds the merchant's own identity (name, email, tenant) — never customer
 * data — and is cleared on logout alongside the SW caches and the offline
 * query snapshot. It is a rendering hint, not an authorisation decision: every
 * API call still goes through the real 401 → refresh → redirect path.
 */
const SESSION_USER_KEY = "numu.session-user";

function cacheSessionUser(user: User): void {
  try {
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  } catch {
    /* private mode / quota — offline boot simply falls back to /login */
  }
}

function readCachedSessionUser(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function clearCachedSessionUser(): void {
  try {
    localStorage.removeItem(SESSION_USER_KEY);
  } catch {
    /* nothing to clear */
  }
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Tenant lifecycle info from GET /auth/me. Null if user has no tenant. */
  tenant: TenantInfo | null;
  /** True when the current session is a Try-a-Demo sandbox. */
  isDemoMode: boolean;
  /** True when the tenant is on a 30-day trial (not yet paid). */
  isTrialMode: boolean;
  /** True when the tenant is in the read-only grace period. */
  isReadOnly: boolean;
  login: (email: string, password: string) => Promise<void>;
  complete2FALogin: (challengeToken: string, code: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  tenant: null,
  isDemoMode: false,
  isTrialMode: false,
  isReadOnly: false,
  login: async () => {},
  complete2FALogin: async () => {},
  register: async () => {},
  googleLogin: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Validate session on mount by calling /auth/me
  useEffect(() => {
    getMe()
      .then(async (u) => {
        setUser(u);
        cacheSessionUser(u);
        // Ensure we have a CSRF token for subsequent requests
        await initCSRF();
      })
      .catch((err) => {
        // ─── A NETWORK FAILURE IS NOT A LOGOUT ───────────────────────────
        // This used to be a bare `.catch(() => setUser(null))`, which treated
        // "the server said no" and "there is no server" as the same thing.
        // Offline, that meant: every reload signed the merchant out, bounced
        // them to /login, and the login chunk isn't precached — so they got
        // "Failed to fetch dynamically imported module" instead of the app.
        // It made the entire offline-reads feature unreachable, because you
        // could never get past the boot check to see it.
        //
        // ApiError uses status 0 for network/timeout. In that case we restore
        // the last known user and let the app render. This is optimistic, not
        // a security hole: every subsequent API call still goes through the
        // real 401 → refresh → redirect path, so a genuinely dead session is
        // caught the moment the merchant does anything.
        const isNetworkFailure = (err as { status?: number } | null)?.status === 0;
        const cached = isNetworkFailure ? readCachedSessionUser() : null;

        if (cached) {
          setUser(cached);
        } else {
          setUser(null);
          clearCachedSessionUser();
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Refetch user when the tab regains focus so per-tenant feature flag
  // flips made elsewhere (admin panel, another tab) propagate without
  // needing a hard reload.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        getMe()
          .then((u) => setUser(u))
          .catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // Throws TwoFactorRequiredError if 2FA is enabled — caller should catch it
    const res = await loginApi(email, password);
    setUser(res.user);
  }, []);

  const complete2FALogin = useCallback(async (challengeToken: string, code: string) => {
    const res = await complete2FALoginApi(challengeToken, code);
    setUser(res.user);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const res = await registerApi(data);
    setUser(res.user);
  }, []);

  const googleLogin = useCallback(async (idToken: string) => {
    const res = await googleLoginApi(idToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      // SECURITY: a signed-out device must stop receiving this store's order
      // notifications. Shared phones are common among merchant staff, and a
      // push subscription outlives the session unless it is revoked.
      // Best-effort and never throws — it must not be able to block logout.
      try {
        const reg = await navigator.serviceWorker?.ready;
        const sub = await reg?.pushManager?.getSubscription();
        if (sub) {
          // Server first: if the browser unsubscribes but the API call fails,
          // the backend keeps pushing to a dead endpoint until it 410s.
          await revokePushSubscription(sub.endpoint).catch(() => {});
          await sub.unsubscribe().catch(() => {});
        }
      } catch {
        /* no service worker, or push unsupported */
      }

      // SECURITY: drop every service-worker cache this app owns before the
      // session ends. Shared devices are common among merchant staff, so no
      // cached application state may outlive a sign-out. Never throws and is
      // time-limited, so it cannot block or delay logout.
      await purgeServiceWorkerCaches();

      // Same reason, for the offline-reads snapshot (Phase 3). IndexedDB
      // survives browser restarts, so a signed-out merchant's dashboard
      // figures would otherwise still be on the device.
      await clearPersistedQueries().catch(() => {});

      // The offline-boot hint must not outlive the session either.
      clearCachedSessionUser();

      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const u = await getMe();
      setUser(u);
    } catch {
      // Session may have expired
    }
  }, []);

  const tenant = user?.tenant ?? null;
  const isDemoMode = tenant?.is_demo ?? false;
  const isTrialMode = tenant?.is_on_trial ?? false;
  const isReadOnly = tenant?.is_read_only ?? false;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        tenant,
        isDemoMode,
        isTrialMode,
        isReadOnly,
        login,
        complete2FALogin,
        register,
        googleLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
