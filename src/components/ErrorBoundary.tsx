import { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { isStaleChunkError } from "@/lib/lazy-with-retry";
import { recoverFromStaleAssets } from "@/lib/register-sw";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const RELOAD_GUARD_KEY = "numu:stale-chunk-reload";

/**
 * How long a recorded reload suppresses another one.
 *
 * A stale-chunk reload either fixes the problem within a second or two, or it
 * never will. 30s is far longer than a successful recovery needs, and short
 * enough that a genuine chunk failure weeks later still gets its own retry.
 */
const RELOAD_COOLDOWN_MS = 30_000;

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (isStaleChunkError(error)) {
      // Stale dynamic chunk — the dev server restarted, or a new build was
      // deployed while this tab was open.
      //
      // A plain reload is NOT enough, and the note below about the precached
      // shell is exactly why: the cached index.html still references the
      // chunk hashes that just went away, so reloading serves the same
      // broken shell forever. recoverFromStaleAssets() activates the waiting
      // worker (or purges the precache when none is staged) and then reloads,
      // which is the only sequence that replaces the shell.
      //
      // ─── DO NOT CLEAR THIS GUARD ON MOUNT ────────────────────────────────
      // A previous version cleared it in componentDidMount(). That looked
      // right but guaranteed an infinite reload loop: the boundary always
      // MOUNTS before it can CATCH an async lazy-import rejection, so the flag
      // was wiped on every single page load and the "have I already tried?"
      // check could never be true. Measured in QA at 28-58 navigations, never
      // settling (~2.4/sec, blank page).
      //
      // The service worker makes it worse, which is why this matters: without
      // it the browser shows one error page and stops, but with a precached
      // shell every reload successfully boots the app straight back into the
      // failing route.
      //
      // So the guard is a TIMESTAMP that expires on its own — never cleared
      // eagerly, and never dependent on a lifecycle hook that runs first.
      let lastReload = 0;
      try {
        lastReload = Number(sessionStorage.getItem(RELOAD_GUARD_KEY)) || 0;
      } catch {
        /* private mode — fall through to the error UI rather than looping */
      }

      const reloadedRecently = Date.now() - lastReload < RELOAD_COOLDOWN_MS;
      if (!reloadedRecently) {
        try {
          sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
        } catch {
          // Cannot record the attempt, so we cannot prove we won't loop.
          // Show the error UI instead of reloading blind.
          Sentry.captureException(error, {
            extra: { componentStack: errorInfo.componentStack, reloadSkipped: "no-storage" },
          });
          return;
        }
        void recoverFromStaleAssets();
        return;
      }
      // Already tried within the cooldown — the chunk is genuinely gone.
      // Fall through and render the error UI.
    }
    Sentry.captureException(error, {
      extra: { componentStack: errorInfo.componentStack },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-md text-center">
            <AlertTriangle size={48} className="text-destructive mb-4" />
            <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-muted-foreground mb-6">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              type="button"
              onClick={() => {
                if (isStaleChunkError(this.state.error)) {
                  void recoverFromStaleAssets();
                } else {
                  window.location.reload();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
            >
              <RotateCcw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
