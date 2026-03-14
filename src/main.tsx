import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./i18n";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Defer Sentry initialisation until after first render — removes ~1 MB from
// the critical-path bundle. Errors thrown during initial render are still
// caught by the ErrorBoundary in App.tsx.
if (import.meta.env.VITE_SENTRY_DSN) {
  // requestIdleCallback where available, setTimeout(0) as fallback (Safari).
  // Either way, Sentry loads after the first render frame, removing ~1 MB
  // from the critical-path bundle.
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => import("./sentry"), { timeout: 3000 });
  } else {
    setTimeout(() => import("./sentry"), 0);
  }
}
