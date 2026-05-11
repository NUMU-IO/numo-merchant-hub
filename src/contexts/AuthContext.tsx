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
import type { User, RegisterData, TenantInfo } from "@/services/authApi";

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
        // Ensure we have a CSRF token for subsequent requests
        await initCSRF();
      })
      .catch(() => {
        // No valid session
        setUser(null);
      })
      .finally(() => setIsLoading(false));
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
