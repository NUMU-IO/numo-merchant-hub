import { createRoot } from "react-dom/client";
import type { Event } from "@sentry/react";
import App from "./App.tsx";
import { registerServiceWorker } from "./lib/register-sw";
import { initAnalytics } from "./lib/analytics";
import { initInstallPromptCapture } from "./lib/install-prompt";
import "./i18n";
import "./index.css";

// Chrome can fire `beforeinstallprompt` before React mounts, and the event is
// only usable if it was captured when it fired. So this runs FIRST — earlier
// than everything below, including the impersonation intercept.
initInstallPromptCapture();

// ────────────────────────────────────────────────────────────────────────────
// IMPERSONATION URL INTERCEPT
// Intercept ?by=admin#handoff_token=... before the app mounts so that the
// initial /auth/me call in AuthContext immediately uses the Bearer token
// and loads the target merchant rather than the admin's own cookie session.
// ────────────────────────────────────────────────────────────────────────────
try {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const fragParams = new URLSearchParams(hash);
  const queryParams = new URLSearchParams(window.location.search);

  const handoffToken = fragParams.get("handoff_token");
  const by =
    queryParams.get("by") ||
    fragParams.get("by") ||
    (queryParams.get("impersonating") === "1" ? "admin" : null);

  if (handoffToken) {
    sessionStorage.setItem("numu.impersonation_token", handoffToken);
    if (by) sessionStorage.setItem("numu.impersonating_by", by);
    
    // Strip from URL so it doesn't linger
    queryParams.delete("by");
    queryParams.delete("impersonating");
    const rest = queryParams.toString();
    const clean = window.location.pathname + (rest ? `?${rest}` : "");
    window.history.replaceState({}, "", clean);
  } else if (by && queryParams.get("impersonating") === "1") {
    // Legacy fallback without handoff_token
    sessionStorage.setItem("numu.impersonating_by", by);
    queryParams.delete("by");
    queryParams.delete("impersonating");
    const rest = queryParams.toString();
    const clean = window.location.pathname + (rest ? `?${rest}` : "");
    window.history.replaceState({}, "", clean);
  }
} catch {
  // Ignore URL parsing errors
}
// ────────────────────────────────────────────────────────────────────────────

const redactUrl = (url: string) =>
  url.replace(
    /([?&#])(token|session_id|access_token|refresh_token|handoff_token|code|state|email)=[^&#]*/gi,
    "$1$2=[REDACTED]",
  );

function scrubEvent<T extends Event>(event: T): T {
  // Strip Authorization headers, session tokens, and CSRF tokens
  if (event.request?.headers) {
    const sensitiveHeaders = [
      "Authorization",
      "authorization",
      "Cookie",
      "cookie",
      "Set-Cookie",
      "set-cookie",
      "X-CSRF-Token",
      "x-csrf-token",
    ];
    for (const header of sensitiveHeaders) {
      delete event.request.headers[header];
    }
    if (event.request.headers.Referer) {
      event.request.headers.Referer = redactUrl(event.request.headers.Referer);
    }
  }

  // Redact tokens from the page URL (reset/invite links, OAuth callbacks)
  if (event.request?.url) {
    event.request.url = redactUrl(event.request.url);
  }
  if (event.request?.query_string) {
    delete event.request.query_string;
  }

  // Remove raw cookies
  if (event.request?.cookies) {
    event.request.cookies = {};
  }

  // Strip user email addresses
  if (event.user?.email) {
    delete event.user.email;
  }

  // Scrub breadcrumbs for PII
  if (event.breadcrumbs) {
    for (const breadcrumb of event.breadcrumbs) {
      if (breadcrumb.data) {
        delete breadcrumb.data["Authorization"];
        delete breadcrumb.data["authorization"];
        delete breadcrumb.data["Cookie"];
        delete breadcrumb.data["cookie"];
        // Redact tokens from URLs in breadcrumbs (fetch/xhr url, navigation from/to)
        for (const key of ["url", "from", "to"]) {
          if (typeof breadcrumb.data[key] === "string") {
            breadcrumb.data[key] = redactUrl(breadcrumb.data[key]);
          }
        }
      }
    }
  }

  return event;
}

createRoot(document.getElementById("root")!).render(<App />);

// Sentry loads after mount so it never competes with first paint. Errors
// thrown before it arrives are not reported.
if (import.meta.env.VITE_SENTRY_DSN) {
  void import("@sentry/react").then(({ init, browserTracingIntegration, replayIntegration, addIntegration }) => {
    init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
      release: import.meta.env.VITE_SENTRY_RELEASE,
      integrations: [browserTracingIntegration()],
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      beforeSend: scrubEvent,
      beforeSendTransaction: scrubEvent,
      beforeSendSpan(span) {
        if (typeof span.data?.url === "string") span.data.url = redactUrl(span.data.url);
        if (typeof span.data?.["http.query"] === "string") {
          span.data["http.query"] = redactUrl(span.data["http.query"]);
        }
        return span;
      },
    });

    // Replay buffers the DOM of every session for on-error capture, so it
    // starts only once the page is idle.
    const startReplay = () => addIntegration(replayIntegration());
    if ("requestIdleCallback" in window) requestIdleCallback(startReplay);
    else setTimeout(startReplay, 2000);
  });
}

// PostHog — internal product analytics, started after mount so it never
// competes with first paint. No-ops when VITE_POSTHOG_KEY is unset.
// Events only: no session replay and no autocapture, because every screen
// in this app can contain a real customer's name, phone and address.
// See src/lib/analytics.ts.
initAnalytics();

// Service worker — registered AFTER mount so the worker fetch never competes
// with first paint. No-ops in dev and when VITE_PWA_ENABLED=false.
// See src/lib/register-sw.ts for why we prompt rather than auto-update.
void registerServiceWorker();
