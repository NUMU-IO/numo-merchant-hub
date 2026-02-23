/**
 * AuthContext — manages JWT authentication state for the dashboard.
 *
 * Stores access + refresh tokens in localStorage.
 * On mount, validates the stored token by calling GET /auth/me.
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
  getMe,
} from "@/services/authApi";
import type { User, RegisterData } from "@/services/authApi";

const TOKEN_KEY = "numu-token";
const REFRESH_KEY = "numu-refresh-token";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check stored token on mount (also accept tokens from URL params for cross-origin handoff)
  useEffect(() => {
    // Accept tokens passed via URL from the landing page (different origin)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    const urlRefresh = params.get("refresh_token");
    if (urlToken && urlRefresh) {
      localStorage.setItem(TOKEN_KEY, urlToken);
      localStorage.setItem(REFRESH_KEY, urlRefresh);
      // Clean tokens from URL without reload
      window.history.replaceState({}, "", window.location.pathname);
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }

    getMe()
      .then((u) => setUser(u))
      .catch(() => {
        // Token expired or invalid
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginApi(email, password);
    localStorage.setItem(TOKEN_KEY, res.tokens.access_token);
    localStorage.setItem(REFRESH_KEY, res.tokens.refresh_token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const res = await registerApi(data);
    localStorage.setItem(TOKEN_KEY, res.tokens.access_token);
    localStorage.setItem(REFRESH_KEY, res.tokens.refresh_token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setUser(null);
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
