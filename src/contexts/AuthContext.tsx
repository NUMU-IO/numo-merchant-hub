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
} from "@/services/authApi";
import { initCSRF } from "@/services/csrf";
import type { User, RegisterData } from "@/services/authApi";

/** Thrown by `login()` when the account requires 2FA verification. */
export class TwoFactorRequiredError extends Error {
  constructor(public readonly challengeToken: string) {
    super("2fa_required");
    this.name = "TwoFactorRequiredError";
  }
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Validate session on mount by calling /auth/me.
  // initCSRF is independent of the session check — run both in parallel.
  useEffect(() => {
    Promise.all([getMe(), initCSRF()])
      .then(([u]) => {
        setUser(u);
      })
      .catch(() => {
        // No valid session — don't call setUser(null) here: initial state is already
        // null, and overriding would race with a concurrent register/login action.
      })
      .finally(() => setIsLoading(false));
  }, []);


  const login = useCallback(async (email: string, password: string) => {
    const res = await loginApi(email, password);
    if (res.requires_2fa && res.challenge_token) {
      throw new TwoFactorRequiredError(res.challenge_token);
    }
    setUser(res.user);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const res = await registerApi(data);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
