import { ComponentType, lazy } from "react";

const STALE_CHUNK_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /ChunkLoadError/i,
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
