/**
 * WordingPanel — default wording / translation editor.
 *
 * Shopify-parity. Storefront themes ship default strings like "Add to
 * cart", "Sold out", "Continue shopping", "Search". Merchants want to
 * override those without touching code — especially in Arabic where
 * dialect varies between merchants (formal فصحى vs. Egyptian masri).
 *
 * Storage shape:
 *   `draft.global_settings.__translations: {
 *      en: { addToCart: "Add to cart", soldOut: "Sold out", ... },
 *      ar: { addToCart: "أضف إلى السلة", soldOut: "نفد المخزون", ... }
 *    }`
 *
 *   Reserved `__translations` namespace under global_settings so the
 *   value piggybacks on the existing field without an SDK type
 *   change. Themes that don't consume translations ignore the key
 *   entirely.
 *
 * Bundle integration:
 *   `empire-engine-V3/src/main.tsx`'s ThemeSettingsBridge picks
 *   `themeSettings.global_settings.__translations?.[ctx.locale]` and
 *   passes it as `<NuMuProvider translations={...}>`. Sections call
 *   `useTranslation("addToCart", "Add to cart")` and get the
 *   override when present, the fallback otherwise.
 *
 * Categories:
 *   The canonical list below covers the ~25 most-edited Shopify wording
 *   keys. Extending later is easy — just add entries; the panel and
 *   the live-preview round-trip pick them up automatically.
 */

import { useMemo, useState } from "react";
import { ArrowLeft, Type, RotateCcw } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { useCustomizerStore } from "../../store/customizerStore";

// ─── Canonical wording dictionary ────────────────────────────────────
//
// Each entry: a stable key, an English fallback, an Arabic fallback,
// and a category for grouping in the UI. The defaults shown match what
// most Empire-class themes hard-code today — merchants editing here
// just type the override they want.

interface WordingEntry {
  key: string;
  defaultEn: string;
  defaultAr: string;
  category: WordingCategory;
  /** Optional context hint shown under the field for ambiguous keys. */
  context?: { en: string; ar: string };
}

type WordingCategory =
  | "product"
  | "cart"
  | "checkout"
  | "search"
  | "navigation"
  | "general";

const WORDING: WordingEntry[] = [
  // Product
  { key: "addToCart", defaultEn: "Add to cart", defaultAr: "أضف إلى السلة", category: "product" },
  { key: "buyNow", defaultEn: "Buy now", defaultAr: "اشترِ الآن", category: "product" },
  { key: "soldOut", defaultEn: "Sold out", defaultAr: "نفد المخزون", category: "product" },
  { key: "outOfStock", defaultEn: "Out of stock", defaultAr: "غير متوفر", category: "product" },
  { key: "quantity", defaultEn: "Quantity", defaultAr: "الكمية", category: "product" },
  { key: "viewDetails", defaultEn: "View details", defaultAr: "عرض التفاصيل", category: "product" },
  { key: "selectSize", defaultEn: "Select size", defaultAr: "اختر المقاس", category: "product" },
  { key: "selectColor", defaultEn: "Select color", defaultAr: "اختر اللون", category: "product" },

  // Cart
  { key: "cartTitle", defaultEn: "Cart", defaultAr: "السلة", category: "cart" },
  { key: "cartEmpty", defaultEn: "Your cart is empty", defaultAr: "سلتك فارغة", category: "cart" },
  { key: "subtotal", defaultEn: "Subtotal", defaultAr: "المجموع الفرعي", category: "cart" },
  { key: "continueShopping", defaultEn: "Continue shopping", defaultAr: "متابعة التسوق", category: "cart" },
  { key: "removeItem", defaultEn: "Remove", defaultAr: "إزالة", category: "cart" },

  // Checkout
  { key: "checkout", defaultEn: "Check out", defaultAr: "إتمام الشراء", category: "checkout" },
  { key: "free", defaultEn: "Free", defaultAr: "مجاناً", category: "checkout", context: { en: "Used for free shipping / free items", ar: "تستخدم للشحن المجاني والعناصر المجانية" } },
  { key: "orderConfirmed", defaultEn: "Order confirmed", defaultAr: "تم تأكيد الطلب", category: "checkout" },

  // Search
  { key: "searchPlaceholder", defaultEn: "Search the store", defaultAr: "ابحث في المتجر", category: "search" },
  { key: "searchResults", defaultEn: "Results for", defaultAr: "نتائج البحث عن", category: "search" },
  { key: "searchNoResults", defaultEn: "No results found", defaultAr: "لا توجد نتائج", category: "search" },

  // Navigation
  { key: "navHome", defaultEn: "Home", defaultAr: "الرئيسية", category: "navigation" },
  { key: "navShop", defaultEn: "Shop", defaultAr: "تسوق", category: "navigation" },
  { key: "navContact", defaultEn: "Contact", defaultAr: "تواصل معنا", category: "navigation" },

  // General
  { key: "loading", defaultEn: "Loading…", defaultAr: "جاري التحميل...", category: "general" },
  { key: "errorGeneric", defaultEn: "Something went wrong", defaultAr: "حدث خطأ ما", category: "general" },
  { key: "save", defaultEn: "Save", defaultAr: "حفظ", category: "general" },
  { key: "cancel", defaultEn: "Cancel", defaultAr: "إلغاء", category: "general" },
];

const CATEGORY_LABELS: Record<WordingCategory, { en: string; ar: string }> = {
  product: { en: "Product", ar: "المنتج" },
  cart: { en: "Cart", ar: "السلة" },
  checkout: { en: "Checkout", ar: "الدفع" },
  search: { en: "Search", ar: "البحث" },
  navigation: { en: "Navigation", ar: "التنقل" },
  general: { en: "General", ar: "عام" },
};

const CATEGORY_ORDER: WordingCategory[] = [
  "product",
  "cart",
  "checkout",
  "search",
  "navigation",
  "general",
];

// ─── Component ────────────────────────────────────────────────────────

export function WordingPanel() {
  const draft = useCustomizerStore((s) => s.draft);
  const locale = useCustomizerStore((s) => s.locale);
  const updateTranslation = useCustomizerStore((s) => s.updateTranslation);
  const setActiveMode = useCustomizerStore((s) => s.setActiveMode);
  const isAr = locale === "ar";

  const [filter, setFilter] = useState("");
  // Which locale is the merchant editing right now. Defaults to the
  // editor's active locale so the merchant lands on the language they
  // toggled to in the top bar. They can flip independently via the
  // tab strip — letting them edit AR strings while viewing the EN
  // preview if they want.
  const [editingLocale, setEditingLocale] = useState<"en" | "ar">(
    isAr ? "ar" : "en",
  );

  // Pull current overrides off the draft. Defensive against the
  // namespace being missing (themes that haven't been customized yet).
  const overrides = useMemo(() => {
    const gs = (draft?.global_settings ?? {}) as Record<string, unknown>;
    const map = (gs.__translations ?? {}) as Record<
      string,
      Record<string, string>
    >;
    return map;
  }, [draft]);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return WORDING;
    return WORDING.filter((w) => {
      const en = w.defaultEn.toLowerCase();
      const ar = w.defaultAr.toLowerCase();
      return (
        w.key.toLowerCase().includes(q) ||
        en.includes(q) ||
        ar.includes(q)
      );
    });
  }, [filter]);

  // Group filtered entries by category, preserving the canonical order.
  const grouped = useMemo(() => {
    const out: Array<{ category: WordingCategory; items: WordingEntry[] }> = [];
    for (const cat of CATEGORY_ORDER) {
      const items = filtered.filter((w) => w.category === cat);
      if (items.length > 0) out.push({ category: cat, items });
    }
    return out;
  }, [filtered]);

  // How many overrides per locale, for the small badge on each tab.
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
        <h2 className="text-sm font-semibold truncate">
          {isAr ? "نصوص الثيم" : "Theme content"}
        </h2>
      </div>

      {/* Locale tab strip — merchant picks WHICH language they're
          editing. Distinct from the top-bar EN/AR toggle which
          controls preview language only. */}
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
                <span>{loc === "ar" ? (isAr ? "العربية" : "Arabic") : (isAr ? "الإنجليزية" : "English")}</span>
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
            {grouped.map(({ category, items }) => (
              <div key={category} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_LABELS[category][isAr ? "ar" : "en"]}
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
  // Local input state so we don't fire a store update per keystroke
  // (autosave debounces, but the undo stack would still get an entry
  // per character). Commit on blur instead — same pattern V2 used.
  const [draft, setDraft] = useState(override ?? "");
  // Keep local state in sync when the override changes from outside
  // (locale tab flip, undo/redo).
  useMemo(() => setDraft(override ?? ""), [override]);

  function commit() {
    const next = draft.trim();
    if (next === (override ?? "")) return;
    onChange(next);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium text-foreground">
          {fallback}
        </Label>
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
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={fallback}
        dir={editingLocale === "ar" ? "rtl" : "ltr"}
        className={cn(
          "text-sm",
          hasOverride && "border-primary/40 bg-primary/5",
        )}
      />
      {entry.context && (
        <p className="text-[11px] text-muted-foreground">
          {entry.context[isAr ? "ar" : "en"]}
        </p>
      )}
      <p className="font-mono text-[10px] text-muted-foreground/60">
        {entry.key}
      </p>
    </div>
  );
}
