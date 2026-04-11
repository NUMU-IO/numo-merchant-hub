/**
 * TokenHandoff — exchanges URL-param tokens for httpOnly cookies.
 *
 * Used by the landing page's demo flow and login flow when redirecting
 * cross-origin to the merchant hub. The landing page appends
 * `?access_token=X&refresh_token=Y` to the redirect URL. This page
 * calls POST /auth/token-handoff to set proper httpOnly cookies on this
 * origin, then redirects to the dashboard.
 */

import { useEffect, useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { rawFetch } from "@/services/api";

const API_BASE = import.meta.env.VITE_API_URL || "";

const TokenHandoff = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");
  const redirect = searchParams.get("redirect") || "/";

  useEffect(() => {
    if (!accessToken || !refreshToken) {
      setStatus("error");
      return;
    }

    (async () => {
      try {
        const res = await rawFetch(`${API_BASE}/auth/token-handoff`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
          }),
        });

        if (res.ok) {
          // Cookies are now set on this origin. Hard-navigate so
          // AuthContext re-initializes with the new session.
          window.location.href = redirect;
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    })();
  }, [accessToken, refreshToken, redirect]);

  if (status === "error") {
    return <Navigate to="/login" replace />;
  }

  // Show a minimal loading spinner while the handoff completes
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <p className="text-xs text-muted-foreground animate-pulse">
          Setting up your session...
        </p>
      </div>
    </div>
  );
};

export default TokenHandoff;
