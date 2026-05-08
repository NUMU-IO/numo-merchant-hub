/**
 * Shared resource search picker.
 *
 * Used by SettingInputV3 for the single-select (`product`, `collection`)
 * AND multi-select (`product_list`, `collection_list`) inputs. Replaces
 * the previous `window.prompt("Enter ID:")` placeholder with a real
 * combobox UX:
 *   - Debounced text search against the merchant's catalog
 *   - Selected-pill rendering for multi-select
 *   - Removable badges; click-to-load on focus
 *
 * Generic over the resource shape: callers supply `searchFn(query)` and
 * `getDisplay(item)`. The store id comes from the customizer store.
 *
 * For resource types whose backend doesn't exist yet (pages, blogs,
 * link_lists, variants) the parent component falls back to the free-
 * text input below — those still ship in SettingInputV3 directly.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { EditorLocale } from "../../types";

export interface ResourceSearchItem {
  id: string;
  /** What to render inside the badge / row title. */
  label: string;
  /** Optional extra detail (e.g. price, slug) shown subdued under label. */
  sublabel?: string;
  /** Optional thumbnail URL. */
  image?: string | null;
}

export interface ResourceSearchPickerProps {
  /** Selected ids — `string[]` when `multi=true`, `string` when not. */
  value: string | string[] | null | undefined;
  onChange: (next: string | string[]) => void;
  /** Locale for picker chrome (placeholders, "no results", etc.). */
  locale: EditorLocale;
  /** Resource search — called with the trimmed user query. */
  searchFn: (query: string) => Promise<ResourceSearchItem[]>;
  /** Fetch a single resource by id; used to hydrate already-stored values. */
  resolveById: (id: string) => Promise<ResourceSearchItem | null>;
  /** Multi-select. When false, picking an item closes the popover. */
  multi?: boolean;
  /** Cap on multi-select size. Defaults to 50 for parity with Shopify. */
  maxItems?: number;
  /** Empty-state copy shown when no item is selected. */
  emptyLabel?: { en: string; ar: string };
  /** Icon rendered inside the trigger button. */
  icon?: React.ReactNode;
}

const DEBOUNCE_MS = 200;

export function ResourceSearchPicker({
  value,
  onChange,
  locale,
  searchFn,
  resolveById,
  multi = false,
  maxItems = 50,
  emptyLabel,
  icon,
}: ResourceSearchPickerProps) {
  // Memo so the array identity is stable across renders — without this,
  // the togglePick / removeId useCallbacks would invalidate every
  // render and the search popover would re-mount unnecessarily.
  const ids: string[] = useMemo(
    () => (Array.isArray(value) ? value : value ? [value] : []),
    [value],
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResourceSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Hydrated label cache so selected ids show their real names. We
  // don't reach into the search results because the user may have
  // selected something on a previous session — those rows aren't in
  // the current results array.
  const [hydrated, setHydrated] = useState<Record<string, ResourceSearchItem>>({});

  // Hydrate any stored ids that aren't yet in cache. Runs once per id
  // change. Failed lookups stay un-hydrated and fall back to the id
  // string — themes that wipe a referenced resource shouldn't break
  // the customizer.
  useEffect(() => {
    let cancelled = false;
    const missing = ids.filter((id) => !hydrated[id]);
    if (missing.length === 0) return;
    void (async () => {
      const next: Record<string, ResourceSearchItem> = {};
      for (const id of missing) {
        try {
          const item = await resolveById(id);
          if (item) next[item.id] = item;
        } catch {
          /* swallow — stale id falls back to bare display */
        }
      }
      if (!cancelled && Object.keys(next).length > 0) {
        setHydrated((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // We only re-hydrate when ids change. hydrated is intentionally
    // omitted — we'd loop otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  // Debounced search. Cancels in-flight when the query changes again.
  const lastQueryRef = useRef<string>("");
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    lastQueryRef.current = trimmed;
    setSearchError(null);
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const items = await searchFn(trimmed);
        if (lastQueryRef.current !== trimmed) return; // superseded
        setResults(items);
      } catch (err) {
        if (lastQueryRef.current !== trimmed) return;
        setSearchError(
          err instanceof Error ? err.message : "Search failed",
        );
        setResults([]);
      } finally {
        if (lastQueryRef.current === trimmed) setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, open, searchFn]);

  const togglePick = useCallback(
    (item: ResourceSearchItem) => {
      // Cache hydration for the just-picked item.
      setHydrated((prev) => ({ ...prev, [item.id]: item }));
      if (!multi) {
        onChange(item.id);
        setOpen(false);
        return;
      }
      const has = ids.includes(item.id);
      let next: string[];
      if (has) {
        next = ids.filter((id) => id !== item.id);
      } else {
        if (ids.length >= maxItems) return; // soft cap
        next = [...ids, item.id];
      }
      onChange(next);
    },
    [ids, multi, onChange, maxItems],
  );

  const removeId = useCallback(
    (id: string) => {
      if (multi) {
        onChange(ids.filter((x) => x !== id));
      } else {
        onChange("");
      }
    },
    [ids, multi, onChange],
  );

  const placeholder =
    emptyLabel?.[locale] ||
    (locale === "ar" ? "ابحث..." : "Search...");

  return (
    <div className="space-y-2">
      {/* Selected display. Single-select shows a row, multi-select a wrap of badges. */}
      {ids.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap gap-1.5 rounded-md border bg-muted/20 p-2",
            !multi && "flex-nowrap items-center",
          )}
        >
          {ids.map((id) => {
            const item = hydrated[id];
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-xs"
                title={id}
              >
                {item?.image && (
                  <img
                    src={item.image}
                    alt=""
                    className="h-4 w-4 rounded-sm object-cover"
                  />
                )}
                <span className="max-w-[140px] truncate">
                  {item?.label ?? (
                    <span className="text-muted-foreground">{id}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => removeId(id)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={locale === "ar" ? "إزالة" : "Remove"}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Trigger */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        {icon ?? <Search className="h-4 w-4" />}
        <span className="truncate text-muted-foreground">
          {open
            ? locale === "ar"
              ? "إغلاق البحث"
              : "Close search"
            : multi
              ? locale === "ar"
                ? `إضافة (${ids.length}/${maxItems})`
                : `Add (${ids.length}/${maxItems})`
              : ids.length === 0
                ? placeholder
                : locale === "ar"
                  ? "تغيير"
                  : "Change"}
        </span>
      </Button>

      {/* Search popover. Inline rather than positioned so it stays inside the
          right-rail panel; matches existing FontPickerButton pattern. */}
      {open && (
        <div className="space-y-2 rounded-md border bg-popover p-2 shadow-sm">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="pl-7 text-xs"
            />
          </div>
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {searching ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              </div>
            ) : searchError ? (
              <p className="px-2 py-2 text-xs text-destructive">
                {searchError}
              </p>
            ) : results.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                {query.trim()
                  ? locale === "ar"
                    ? "لا توجد نتائج"
                    : "No results"
                  : locale === "ar"
                    ? "ابدأ الكتابة للبحث"
                    : "Start typing to search"}
              </p>
            ) : (
              results.map((item) => {
                const picked = ids.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => togglePick(item)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent",
                      picked && "bg-primary/10",
                    )}
                  >
                    {item.image && (
                      <img
                        src={item.image}
                        alt=""
                        className="h-6 w-6 rounded-sm object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.label}</p>
                      {item.sublabel && (
                        <p className="truncate text-[10px] text-muted-foreground">
                          {item.sublabel}
                        </p>
                      )}
                    </div>
                    {picked && (
                      <span className="text-[10px] font-medium text-primary">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
