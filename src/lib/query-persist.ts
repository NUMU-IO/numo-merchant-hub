/**
 * Offline reads — TanStack Query persistence to IndexedDB.
 *
 * ─── WHY NOT THE CACHE API ───────────────────────────────────────────────────
 * The service worker deliberately refuses to cache `/api/` (see src/sw.ts): the
 * Cache API keys by URL and IGNORES the `X-Tenant-Id` header the hub uses to
 * select a store, so a cached response for store A could be replayed to store
 * B. Persisting at the QUERY layer is safe in a way HTTP caching is not,
 * because query keys carry the store id — but only if that is ENFORCED rather
 * than assumed, which is what `shouldPersistQuery` below does.
 *
 * Audited 2026-08-08: the store id sits at DIFFERENT positions per query
 * (`["orders", storeId, …]` vs `["dashboard", "stats", storeId, …]`), and
 * several real keys have no store id at all (`["analytics"]`, `["themes"]`,
 * `["merchant-hub-nav"]`). So a prefix allowlist alone is not sufficient — the
 * active store id must literally appear in the key.
 *
 * No new dependency: `dehydrate`/`hydrate` ship with @tanstack/react-query.
 */
import { dehydrate, hydrate, type QueryClient, type Query } from "@tanstack/react-query";

const DB_NAME = "numu-query-cache";
const STORE_NAME = "kv";
const KEY = "dehydrated";

/**
 * Bumped by the build. A deploy can change a query's response shape, and
 * restoring yesterday's shape into today's components is a crash, not a
 * feature.
 */
const BUSTER = import.meta.env.VITE_SENTRY_RELEASE || import.meta.env.MODE || "dev";

/** Persisted snapshots older than this are discarded wholesale. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Query-key prefixes eligible for persistence.
 *
 * DEFAULT-DENY: anything not listed here is memory-only. Deliberately narrow —
 * these are read-only, low-sensitivity, "what happened in my store" views.
 *
 * NOT listed, on purpose:
 *   • customers / order detail — carry customer PII (name, phone, address).
 *     IndexedDB survives browser restarts and is readable by any script on the
 *     origin; a merchant's customer list does not belong there.
 *   • payments / wallet / reconciliation — money data.
 *   • anything realtime (useSSE-backed) — persisting a live feed is meaningless.
 *   • auth/session state.
 */
const PERSIST_PREFIXES: readonly (readonly string[])[] = [
  ["dashboard", "stats"],
  ["dashboard", "topProducts"],
  ["dashboard", "chart"],
  ["products"],
];

/*
 * REMOVED after QA (defect D14-2): `["dashboard","recentOrders"]` and
 * `["orders"]`.
 *
 * Both were on this list, and both return order rows carrying `customer_name`
 * — so the "no customer PII" rule three paragraphs up was being violated by
 * this very allowlist. QA found the name sitting in IndexedDB, which survives
 * browser restarts and is readable by any script on the origin.
 *
 * Removed rather than field-stripped on purpose: a strip-list has to be kept
 * in sync with an API response shape forever, and the first field someone
 * forgets is a silent leak. What survives here — revenue totals, the chart,
 * top products, the product catalogue — is genuinely PII-free and still
 * answers the question offline reads exist for ("how is my store doing?").
 *
 * Restoring order-level offline reads needs a PII-free projection from the
 * API, not a client-side filter.
 */

function keyStartsWith(key: readonly unknown[], prefix: readonly string[]): boolean {
  return prefix.every((part, i) => key[i] === part);
}

/**
 * The tenant-safety gate.
 *
 * A query is persisted only when its key both matches an allowlisted prefix
 * AND contains the ACTIVE store id. The second half is what makes this safe:
 * a key like `["orders"]` or `["analytics"]` matches no store and is refused,
 * so it can never be restored under a different merchant.
 */
export function shouldPersistQuery(query: Query, activeStoreId: string | null): boolean {
  if (!activeStoreId) return false;
  if (query.state.status !== "success") return false;

  const key = query.queryKey as readonly unknown[];
  if (!PERSIST_PREFIXES.some((p) => keyStartsWith(key, p))) return false;

  // Positional-agnostic on purpose — see the header note.
  return key.some((part) => part === activeStoreId);
}

// ─── Minimal IndexedDB key/value store ──────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet<T>(): Promise<T | undefined> {
  const db = await openDb();
  const out = await new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(KEY);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return out;
}

/** Wipe everything. Called on logout and on store switch. */
export async function clearPersistedQueries(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    /* private mode / blocked — nothing was persisted anyway */
  }
}

interface Snapshot {
  buster: string;
  storeId: string;
  savedAt: number;
  state: ReturnType<typeof dehydrate>;
}

/**
 * Restore a previous snapshot into the cache.
 *
 * Refuses on ANY mismatch — different build, different store, too old. All
 * three are "we cannot prove this is safe to show", and showing the wrong
 * store's numbers is far worse than showing none.
 */
export async function restorePersistedQueries(
  client: QueryClient,
  activeStoreId: string | null,
): Promise<boolean> {
  if (!activeStoreId) return false;
  try {
    const snap = await idbGet<Snapshot>();
    if (!snap) return false;
    if (snap.buster !== BUSTER) return false;
    if (snap.storeId !== activeStoreId) return false;
    if (Date.now() - snap.savedAt > MAX_AGE_MS) return false;

    hydrate(client, snap.state);
    return true;
  } catch {
    return false;
  }
}

/**
 * Start persisting. Returns an unsubscribe.
 *
 * Writes are debounced: the cache fires on every fetch, and a dashboard mount
 * can produce a dozen in a second.
 */
export function startPersistingQueries(
  client: QueryClient,
  activeStoreId: string | null,
): () => void {
  if (!activeStoreId) return () => {};

  let timer: ReturnType<typeof setTimeout> | undefined;

  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const state = dehydrate(client, {
          shouldDehydrateQuery: (q) => shouldPersistQuery(q, activeStoreId),
        });
        void idbSet({
          buster: BUSTER,
          storeId: activeStoreId,
          savedAt: Date.now(),
          state,
        } satisfies Snapshot).catch(() => {});
      } catch {
        /* quota exceeded or serialisation failure — offline reads degrade, nothing breaks */
      }
    }, 1500);
  };

  const unsubscribe = client.getQueryCache().subscribe(save);
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
