import { lazy, type ComponentType } from "react";

const RELOAD_FLAG = "numu:chunk-reloaded";

/**
 * `lazy()` that survives a deploy happening mid-session.
 *
 * Vite emits content-hashed chunks. After a redeploy the old hashes are
 * gone, so a route imported later in the session 404s — and because the
 * SPA rewrite serves index.html for unknown paths, the browser reports
 * "text/html is not a valid JavaScript MIME type" and the app dies.
 *
 * On that failure we reload once (a fresh index.html points at the new
 * hashes). The sessionStorage flag stops a reload loop if the import is
 * broken for any other reason; it clears on the next successful import.
 */
export function lazyWithRetry<T extends ComponentType<never>>(
  importer: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const module = await importer();
      try {
        window.sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        // Private mode / blocked storage — the import worked, move on.
      }
      return module;
    } catch (error) {
      let alreadyReloaded = false;
      try {
        alreadyReloaded = window.sessionStorage.getItem(RELOAD_FLAG) === "1";
        window.sessionStorage.setItem(RELOAD_FLAG, "1");
      } catch {
        alreadyReloaded = true;
      }
      if (!alreadyReloaded) {
        window.location.reload();
        // Never resolves — the reload takes over.
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}
