import { ComponentType, lazy } from "react";

const STALE_CHUNK_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /ChunkLoadError/i,
  // Safari's wording when the SPA fallback answered a vanished chunk with
  // index.html — the exact error Sentry records on /customers/product-requests.
  /is not a valid JavaScript MIME type/i,
];

export function isStaleChunkError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : "";
  return STALE_CHUNK_PATTERNS.some((re) => re.test(message));
}

// Wraps React.lazy with one retry on transient network failures. If the retry
// also fails the rejection is rethrown — the ErrorBoundary then decides whether
// to auto-reload (stale chunks after a deploy/restart) or show the error UI.
//
// It must NOT reload the page itself. A second loader used to, on 107 of the
// 108 routes, and that is why merchants met "Failed to fetch dynamically
// imported module" after every hub deploy: a plain reload re-serves the
// PRECACHED index.html, which still points at the chunk hashes that just
// disappeared, so the same import fails again — and the reload it already
// spent was the one the ErrorBoundary needed for recoverFromStaleAssets(),
// which activates the waiting service worker (or purges the precache) BEFORE
// reloading. Only that sequence replaces the shell.
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): ReturnType<typeof lazy<T>> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (!isStaleChunkError(err)) throw err;
      await new Promise((r) => setTimeout(r, 400));
      return await factory();
    }
  });
}
