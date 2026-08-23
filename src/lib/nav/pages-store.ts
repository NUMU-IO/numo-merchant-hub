/**
 * Recent / pinned / custom pages (Zid-style "My pages").
 *
 * Per-store, per-browser state in localStorage, exposed through a tiny
 * external store so the top-bar popover, the dashboard "Recently viewed"
 * strip and the route tracker all read the same snapshot and re-render
 * together. Only URLs are persisted — labels and icons are resolved at
 * render time from the nav registry so they follow the active language.
 */

import { useSyncExternalStore } from "react";

export type CustomPage = { url: string; label: string };

export interface PagesState {
  /** Most recent first. */
  recent: { url: string; at: number }[];
  /** Insertion order = display order. */
  pinned: string[];
  custom: CustomPage[];
  /** The "Pin your important pages" explainer was dismissed. */
  introDismissed: boolean;
}

export const MAX_RECENT = 12;
export const MAX_PINNED = 12;
export const MAX_CUSTOM = 10;

const EMPTY: PagesState = { recent: [], pinned: [], custom: [], introDismissed: false };
const KEY_PREFIX = "numu:pages:";

const cache = new Map<string, PagesState>();
const listeners = new Set<() => void>();

function keyFor(storeId: string) {
  return `${KEY_PREFIX}${storeId}`;
}

function read(storeId: string): PagesState {
  const hit = cache.get(storeId);
  if (hit) return hit;
  let state = EMPTY;
  try {
    const raw = localStorage.getItem(keyFor(storeId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PagesState>;
      state = {
        recent: Array.isArray(parsed.recent) ? parsed.recent.filter((r) => typeof r?.url === "string") : [],
        pinned: Array.isArray(parsed.pinned) ? parsed.pinned.filter((u) => typeof u === "string") : [],
        custom: Array.isArray(parsed.custom)
          ? parsed.custom.filter((c) => typeof c?.url === "string" && typeof c?.label === "string")
          : [],
        introDismissed: Boolean(parsed.introDismissed),
      };
    }
  } catch {
    state = EMPTY;
  }
  cache.set(storeId, state);
  return state;
}

function write(storeId: string, next: PagesState) {
  cache.set(storeId, next);
  try {
    localStorage.setItem(keyFor(storeId), JSON.stringify(next));
  } catch {
    /* quota / private mode — in-memory state still works for the session */
  }
  listeners.forEach((l) => l());
}

function update(storeId: string, fn: (prev: PagesState) => PagesState) {
  write(storeId, fn(read(storeId)));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key && e.key.startsWith(KEY_PREFIX)) {
      cache.delete(e.key.slice(KEY_PREFIX.length));
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Normalise a hub path: internal only, no trailing slash, keeps `?query`. */
export function normalizePageUrl(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  // Accept a full hub URL pasted from the address bar.
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      if (u.origin !== window.location.origin) return null;
      s = u.pathname + u.search;
    }
  } catch {
    return null;
  }
  if (!s.startsWith("/")) s = `/${s}`;
  if (s.startsWith("//")) return null;
  const [path, query = ""] = s.split("?");
  const cleanPath = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return query ? `${cleanPath}?${query}` : cleanPath;
}

export const pagesStore = {
  get: read,
  subscribe,
  recordVisit(storeId: string, url: string) {
    update(storeId, (prev) => {
      if (prev.recent[0]?.url === url) return prev;
      const recent = [{ url, at: Date.now() }, ...prev.recent.filter((r) => r.url !== url)].slice(0, MAX_RECENT);
      return { ...prev, recent };
    });
  },
  togglePin(storeId: string, url: string) {
    update(storeId, (prev) => {
      const pinned = prev.pinned.includes(url)
        ? prev.pinned.filter((u) => u !== url)
        : [...prev.pinned, url].slice(-MAX_PINNED);
      return { ...prev, pinned };
    });
  },
  addCustom(storeId: string, page: CustomPage) {
    update(storeId, (prev) => {
      const custom = [...prev.custom.filter((c) => c.url !== page.url), page].slice(-MAX_CUSTOM);
      // A custom page is added because the merchant wants it handy → pin it.
      const pinned = prev.pinned.includes(page.url) ? prev.pinned : [...prev.pinned, page.url].slice(-MAX_PINNED);
      return { ...prev, custom, pinned };
    });
  },
  removeCustom(storeId: string, url: string) {
    update(storeId, (prev) => ({
      ...prev,
      custom: prev.custom.filter((c) => c.url !== url),
      pinned: prev.pinned.filter((u) => u !== url),
      recent: prev.recent.filter((r) => r.url !== url),
    }));
  },
  clearRecent(storeId: string) {
    update(storeId, (prev) => ({ ...prev, recent: [] }));
  },
  dismissIntro(storeId: string) {
    update(storeId, (prev) => ({ ...prev, introDismissed: true }));
  },
};

/** Reactive snapshot for a store (stable EMPTY when no store yet). */
export function usePagesState(storeId: string | undefined): PagesState {
  return useSyncExternalStore(
    subscribe,
    () => (storeId ? read(storeId) : EMPTY),
    () => EMPTY,
  );
}
