/**
 * TokenHandoff — exchanges tokens handed over in the URL for httpOnly cookies.
 *
 * Used by the landing page's demo, signup and login flows when redirecting
 * cross-origin to the merchant hub. The landing page puts
 * `access_token`, `refresh_token` and `redirect` in the URL fragment, which
 * never reaches a server log. The older query-string form is still read so
 * links minted before the landing deploy keep working. This page calls
 * POST /auth/token-handoff to set proper httpOnly cookies on this origin,
 * then redirects within the hub.
 */

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
const API_BASE = import.meta.env.VITE_API_URL || "";

function readHandoff() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const params = hash.has("access_token") ? hash : new URLSearchParams(window.location.search);
  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    redirect: safeRedirect(params.get("redirect")),
  };
}

export function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith("/")) return "/";
  const url = new URL(value, window.location.origin);
  if (url.origin !== window.location.origin) return "/";
  return url.pathname + url.search + url.hash;
}

const TokenHandoff = () => {
  const [handoff] = useState(readHandoff);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);

    const { accessToken, refreshToken, redirect } = handoff;
    if (!accessToken || !refreshToken) {
      setStatus("error");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/token-handoff`, {
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
  }, [handoff]);

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
