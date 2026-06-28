/**
 * WordingPanel — "Edit theme content" (Shopify parity).
 *
 * Data-driven: when the active theme ships a locale catalog
 * (`locales/<lang>.json`, embedded in the bundle manifest as
 * `manifest.locales`), this panel lists the theme's REAL, FULL string
 * set — flattened to dot-keys, grouped by namespace, searchable, with
 * EN + AR columns. That replaces the old fixed ~25-key dictionary, which
 * now only serves as a FALLBACK for themes that ship no locale catalog.
 *
 * Storage shape (unchanged):
 *   `draft.global_settings.__translations: {
 *      en: { "cart.subtotal": "Basket total", ... },
 *      ar: { "cart.subtotal": "إجمالي السلة", ... }
 *    }`
 *   Reserved `__translations` namespace; the bundle's ThemeSettingsBridge
 *   passes `__translations[locale]` to `<NuMuProvider translations>` and
 *   sections call `useTranslation().t("cart.subtotal", "Subtotal")`.
 *
 * Catalog source: the editor fetches `<bundle_base>/manifest.json` (R2
 * sends permissive CORS) and reads `.locales`. No backend round-trip.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Type, RotateCcw, Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { useCustomizerStore } from "../../store/customizerStore";

// ─── Entry shape (unified for catalog + fallback) ────────────────────
interface WordingEntry {
  key: string;
  defaultEn: string;
  defaultAr: string;
  group: string;
}

// ─── Fallback dictionary (themes with no locale catalog) ─────────────
const FALLBACK_WORDING: WordingEntry[] = [
  { key: "addToCart", defaultEn: "Add to cart", defaultAr: "أضف إلى السلة", group: "product" },
  { key: "buyNow", defaultEn: "Buy now", defaultAr: "اشترِ الآن", group: "product" },
  { key: "soldOut", defaultEn: "Sold out", defaultAr: "نفد المخزون", group: "product" },
  { key: "quantity", defaultEn: "Quantity", defaultAr: "الكمية", group: "product" },
  { key: "cartTitle", defaultEn: "Cart", defaultAr: "السلة", group: "cart" },
  { key: "cartEmpty", defaultEn: "Your cart is empty", defaultAr: "سلتك فارغة", group: "cart" },
  { key: "subtotal", defaultEn: "Subtotal", defaultAr: "المجموع الفرعي", group: "cart" },
  { key: "continueShopping", defaultEn: "Continue shopping", defaultAr: "متابعة التسوق", group: "cart" },
  { key: "checkout", defaultEn: "Check out", defaultAr: "إتمام الشراء", group: "checkout" },
  { key: "searchPlaceholder", defaultEn: "Search the store", defaultAr: "ابحث في المتجر", group: "search" },
  { key: "searchNoResults", defaultEn: "No results found", defaultAr: "لا توجد نتائج", group: "search" },
  { key: "loading", defaultEn: "Loading…", defaultAr: "جاري التحميل...", group: "general" },
  { key: "errorGeneric", defaultEn: "Something went wrong", defaultAr: "حدث خطأ ما", group: "general" },
];

const GROUP_LABELS: Record<string, { en: string; ar: string }> = {
  product: { en: "Product", ar: "المنتج" },
  cart: { en: "Cart", ar: "السلة" },
  checkout: { en: "Checkout", ar: "الدفع" },
  search: { en: "Search", ar: "البحث" },
  navigation: { en: "Navigation", ar: "التنقل" },
  general: { en: "General", ar: "عام" },
};

/** Flatten a nested locale object to dot-keys: { cart: { subtotal } } → { "cart.subtotal" }. */
function flattenLocale(
  obj: unknown,
  prefix = "",
  out: Record<string, string> = {},
): Record<string, string> {
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flattenLocale(v, key, out);
    } else if (v != null) {
      out[key] = String(v);
    }
  }
  return out;
}

function humanizeGroup(group: string, isAr: boolean): string {
  if (GROUP_LABELS[group]) return GROUP_LABELS[group][isAr ? "ar" : "en"];
  return group.charAt(0).toUpperCase() + group.slice(1).replace(/[_-]/g, " ");
}

// ─── Component ────────────────────────────────────────────────────────

export function WordingPanel() {
  const draft = useCustomizerStore((s) => s.draft);
  const locale = useCustomizerStore((s) => s.locale);
  const updateTranslation = useCustomizerStore((s) => s.updateTranslation);
  const setActiveMode = useCustomizerStore((s) => s.setActiveMode);
  const bundleUrl = useCustomizerStore(
    (s) => s.draft?.external_theme?.bundle_url,
  );
  const isAr = locale === "ar";

  const [filter, setFilter] = useState("");
  const [editingLocale, setEditingLocale] = useState<"en" | "ar">(
    isAr ? "ar" : "en",
  );

  // ── Fetch the theme's locale catalog from its bundle manifest ──
  const [catalog, setCatalog] = useState<{
    en: Record<string, string>;
    ar: Record<string, string>;
  } | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  useEffect(() => {
    if (!bundleUrl) {
      setCatalog(null);
      return;
    }
    const manifestUrl = bundleUrl.replace(/\/[^/]*$/, "/manifest.json");
    let cancelled = false;
    setLoadingCatalog(true);
    fetch(manifestUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (cancelled) return;
        const locales = (m?.locales ?? {}) as Record<string, unknown>;
        const en = flattenLocale(locales.en);
        const ar = flattenLocale(locales.ar);
        // Only adopt the catalog when it actually carries keys; else the
        // fallback dictionary stays in charge.
        setCatalog(Object.keys(en).length > 0 ? { en, ar } : null);
      })
      .catch(() => {
        if (!cancelled) setCatalog(null);
      })
      .finally(() => !cancelled && setLoadingCatalog(false));
    return () => {
      cancelled = true;
    };
  }, [bundleUrl]);

  // Build the entry list from the theme catalog (preferred) or fallback.
  const entries: WordingEntry[] = useMemo(() => {
    if (catalog) {
      return Object.keys(catalog.en)
        .sort()
        .map((key) => ({
          key,
          defaultEn: catalog.en[key] ?? "",
          defaultAr: catalog.ar[key] ?? "",
          group: key.includes(".") ? key.split(".")[0] : "general",
        }));
    }
    return FALLBACK_WORDING;
  }, [catalog]);

  const overrides = useMemo(() => {
    const gs = (draft?.global_settings ?? {}) as Record<string, unknown>;
    return (gs.__translations ?? {}) as Record<
      string,
      Record<string, string>
    >;
  }, [draft]);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return entries;
    return entries.filter(
      (w) =>
        w.key.toLowerCase().includes(q) ||
        w.defaultEn.toLowerCase().includes(q) ||
        w.defaultAr.toLowerCase().includes(q),
    );
  }, [filter, entries]);

  const grouped = useMemo(() => {
    const byGroup = new Map<string, WordingEntry[]>();
    for (const e of filtered) {
      if (!byGroup.has(e.group)) byGroup.set(e.group, []);
      byGroup.get(e.group)!.push(e);
    }
    return Array.from(byGroup.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
  }, [filtered]);

  const overrideCount = useMemo(
    () => ({
      en: Object.keys(overrides.en ?? {}).length,
      ar: Object.keys(overrides.ar ?? {}).length,
    }),
    [overrides],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => setActiveMode("sections")}
          aria-label={isAr ? "العودة إلى الأقسام" : "Back to sections"}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Type className="h-4 w-4 text-muted-foreground" />
        <h2 className="flex-1 truncate text-sm font-semibold">
          {isAr ? "نصوص الثيم" : "Theme content"}
        </h2>
        {loadingCatalog ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {catalog
              ? isAr
                ? "من الثيم"
                : "From theme"
              : isAr
                ? "الافتراضي"
                : "Defaults"}
          </span>
        )}
      </div>

      {/* Locale tab strip */}
      <div className="border-b px-4 py-2">
        <div role="tablist" className="flex gap-1">
          {(["en", "ar"] as const).map((loc) => {
            const isActive = editingLocale === loc;
            const count = overrideCount[loc];
            return (
              <button
                key={loc}
                type="button"
                role="tab"
                aria-selected={isActive ? "true" : "false"}
                onClick={() => setEditingLocale(loc)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <span>
                  {loc === "ar"
                    ? isAr
                      ? "العربية"
                      : "Arabic"
                    : isAr
                      ? "الإنجليزية"
                      : "English"}
                </span>
                {count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                      isActive ? "bg-white/20" : "bg-background/60",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter */}
      <div className="border-b px-4 py-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={isAr ? "ابحث عن نص..." : "Filter strings…"}
          className="h-8 text-xs"
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {grouped.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {isAr ? "لا توجد نتائج." : "No matching strings."}
          </p>
        ) : (
          <div className="space-y-6">
            {grouped.map(([group, items]) => (
              <div key={group} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {humanizeGroup(group, isAr)}
                </h3>
                {items.map((entry) => (
                  <WordingRow
                    key={entry.key}
                    entry={entry}
                    editingLocale={editingLocale}
                    isAr={isAr}
                    override={overrides[editingLocale]?.[entry.key]}
                    onChange={(value) =>
                      updateTranslation(entry.key, editingLocale, value)
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Row component ────────────────────────────────────────────────────

function WordingRow({
  entry,
  editingLocale,
  isAr,
  override,
  onChange,
}: {
  entry: WordingEntry;
  editingLocale: "en" | "ar";
  isAr: boolean;
  override: string | undefined;
  onChange: (value: string) => void;
}) {
  const fallback = editingLocale === "ar" ? entry.defaultAr : entry.defaultEn;
  const hasOverride = override !== undefined && override.length > 0;
  const [draft, setDraft] = useState(override ?? "");
  useMemo(() => setDraft(override ?? ""), [override]);

  function commit() {
    const next = draft.trim();
    if (next === (override ?? "")) return;
    onChange(next);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-foreground">
          {fallback || entry.key}
        </label>
        {hasOverride && (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              onChange("");
            }}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            title={isAr ? "العودة إلى النص الافتراضي" : "Reset to default"}
          >
            <RotateCcw className="h-3 w-3" />
            {isAr ? "افتراضي" : "Reset"}
          </button>
        )}
      </div>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder={fallback}
        dir={editingLocale === "ar" ? "rtl" : "ltr"}
        className={cn("text-sm", hasOverride && "border-primary/40 bg-primary/5")}
      />
      <p className="font-mono text-[10px] text-muted-foreground/60">{entry.key}</p>
    </div>
  );
}
