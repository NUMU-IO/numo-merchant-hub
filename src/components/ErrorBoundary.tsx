import { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { isStaleChunkError } from "@/lib/lazy-with-retry";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const RELOAD_GUARD_KEY = "numu:stale-chunk-reload";

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidMount() {
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (isStaleChunkError(error)) {
      // Stale dynamic chunk — usually means the dev server restarted or a new
      // build was deployed while this tab was open. Reload once to pick up the
      // current asset URLs. The sessionStorage flag prevents an infinite loop
      // if the chunk really is missing.
      const alreadyReloaded = sessionStorage.getItem(RELOAD_GUARD_KEY);
      if (!alreadyReloaded) {
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
        window.location.reload();
        return;
      }
      sessionStorage.removeItem(RELOAD_GUARD_KEY);
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
              onClick={() => window.location.reload()}
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
