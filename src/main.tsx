import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./i18n";
import "./index.css";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
  release: import.meta.env.VITE_SENTRY_RELEASE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,

  beforeSend(event) {
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
          // Redact tokens from URLs in breadcrumbs
          if (typeof breadcrumb.data.url === "string") {
            breadcrumb.data.url = breadcrumb.data.url.replace(
              /([?&])(token|session_id|access_token|refresh_token)=[^&]*/gi,
              "$1$2=[REDACTED]",
            );
          }
        }
      }
    }

    return event;
  },
});

createRoot(document.getElementById("root")!).render(<App />);
