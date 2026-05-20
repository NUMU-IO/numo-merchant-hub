/**
 * AddSectionDialog — Shopify-grade section browser.
 *
 * Step 5 upgrade over the prior simple list:
 *
 *   1. **Compatibility filtering.** Sections tagged with a template
 *      slug ("product", "collection", "cart", etc.) only appear in
 *      that template. Sections tagged for a section group (header,
 *      footer) never appear here — they live in the group editor.
 *      Untagged sections show on every template (content-neutral
 *      sections like rich-text, hero, marquee).
 *
 *   2. **Categories.** Cards group under named chips (Hero, Products,
 *      Marketing, Content, Footer...). The chip strip is the primary
 *      navigation aid when the section count gets large; merchants
 *      who know what they want still have search.
 *
 *   3. **Per-section icons.** Replaces the previous generic
 *      LayoutGrid with type-specific Lucide icons in colored tiles.
 *      A real thumbnail/preview system can replace this later
 *      without changing the surrounding shell.
 *
 *   4. **Insertion position.** The store already tracks
 *      `insertAfterSectionId` set by the section-row "Add section
 *      after" hover button. We pass it untouched to `addSection`;
 *      the customizer handles the placement.
 *
 *   5. **Bilingual.** EN/AR for categories, search placeholder, and
 *      empty-state copy.
 */

import { useState, useMemo, useEffect } from "react";
import {
  X,
  Search,
  Image as ImageIcon,
  Type,
  ShoppingBag,
  Mail,
  Quote,
  LayoutGrid,
  Layers,
  Star,
  Megaphone,
  FileText,
  CreditCard,
  CheckCircle2,
  AlignJustify,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { useCustomizerStore } from "../../store/customizerStore";

// ─── Per-section icon map ─────────────────────────────────────────────────
//
// Keys are section `type` values. Falls back to LayoutGrid for any type
// not in the map (most theme-specific exotic sections). The icon is
// shown inside a tinted tile whose color comes from the category.
const ICON_BY_TYPE: Record<string, typeof LayoutGrid> = {
  hero: ImageIcon,
  marquee: AlignJustify,
  "featured-collection": ShoppingBag,
  categories: LayoutGrid,
  newsletter: Mail,
  "promo-banner": Megaphone,
  testimonials: Quote,
  "rich-text": FileText,
  "product-gallery": ImageIcon,
  "product-info": ShoppingBag,
  "product-recommendations": Sparkles,
  "collection-header": Type,
  "product-grid": LayoutGrid,
  "cart-line-items": ShoppingBag,
  "cart-summary": CreditCard,
  "checkout-form": CreditCard,
  "order-status": CheckCircle2,
  "not-found": AlertCircle,
  "image-with-text": ImageIcon,
};

// ─── Category map ─────────────────────────────────────────────────────────
//
// Keys are section `type`. Each section belongs to exactly one category
// for the chip filter. Preset's own `category` field overrides this
// when present (Shopify-style), but most themes today author at the
// section level.
//
// Values are stable category ids; localized labels live in
// `CATEGORY_LABELS` below so we can re-name without touching the map.
const CATEGORY_BY_TYPE: Record<string, string> = {
  hero: "hero",
  marquee: "marketing",
  "featured-collection": "products",
  categories: "products",
  "product-grid": "products",
  "product-gallery": "product-detail",
  "product-info": "product-detail",
  "product-recommendations": "product-detail",
  "collection-header": "products",
  newsletter: "marketing",
  "promo-banner": "marketing",
  testimonials: "marketing",
  "rich-text": "content",
  "image-with-text": "content",
  "cart-line-items": "cart",
  "cart-summary": "cart",
  "checkout-form": "cart",
  "order-status": "cart",
  "not-found": "content",
};

const CATEGORY_ORDER = [
  "all",
  "hero",
  "products",
  "product-detail",
  "marketing",
  "content",
  "cart",
] as const;
type CategoryId = (typeof CATEGORY_ORDER)[number];

const CATEGORY_LABELS: Record<CategoryId, { en: string; ar: string }> = {
  all: { en: "All", ar: "الكل" },
  hero: { en: "Hero", ar: "بانر رئيسي" },
  products: { en: "Products", ar: "المنتجات" },
  "product-detail": { en: "Product detail", ar: "صفحة المنتج" },
  marketing: { en: "Marketing", ar: "تسويق" },
  content: { en: "Content", ar: "محتوى" },
  cart: { en: "Cart & checkout", ar: "السلة والدفع" },
};

// Tile background tint per category — gives the grid visual rhythm so
// merchants can scan for the kind of section they want at a glance.
const CATEGORY_TILE_BG: Record<string, string> = {
  hero: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  products:
    "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  "product-detail":
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  marketing:
    "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300",
  content:
    "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  cart:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

// Section-group tags. These NEVER appear in the page-content browser —
// they live in the dedicated header/footer group editor.
const GROUP_TAGS = new Set(["header", "footer", "announcement-bar"]);

// ─── Component ───────────────────────────────────────────────────────────

export function AddSectionDialog() {
  const schemas = useCustomizerStore((s) => s.schemas);
  const locale = useCustomizerStore((s) => s.locale);
  const activePage = useCustomizerStore((s) => s.activePage);
  const showAddSection = useCustomizerStore((s) => s.showAddSection);
  const setShowAddSection = useCustomizerStore((s) => s.setShowAddSection);
  const addSection = useCustomizerStore((s) => s.addSection);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryId>("all");
  const isAr = locale === "ar";

  // Esc-to-close. Bound at the window level (with `capture`) so it
  // wins over any input-level handling and works regardless of focus.
  // Auto-detaches when the dialog isn't open so we don't leak listeners.
  useEffect(() => {
    if (!showAddSection) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setShowAddSection(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [showAddSection, setShowAddSection]);

  // Reset search + category whenever the dialog reopens so a previous
  // session's filters don't carry over into a fresh add flow.
  useEffect(() => {
    if (showAddSection) {
      setSearch("");
      setCategory("all");
    }
  }, [showAddSection]);

  // Build the flat card list once per (schemas, locale) change. Filtering
  // by category + search happens cheaply at render time off this.
  const allCards = useMemo(() => {
    if (!schemas) return [];
    type Card = {
      sectionType: string;
      sectionTag: string | null;
      presetIndex: number;
      sectionName: string;
      presetName: string;
      hasMultiplePresets: boolean;
      category: string;
    };
    const cards: Card[] = [];
    for (const s of schemas.sections) {
      // Skip sections that belong to a group — they're added via the
      // group editor, not this dialog.
      if (s.tag && GROUP_TAGS.has(s.tag)) continue;
      if (!s.presets || s.presets.length === 0) continue;

      const sectionName = isAr
        ? s.locales?.ar?.name || s.name
        : s.locales?.en?.name || s.name;
      const hasMultiplePresets = s.presets.length > 1;
      const fallbackCategory = CATEGORY_BY_TYPE[s.type] ?? "content";

      s.presets.forEach((preset, idx) => {
        const presetName =
          (isAr
            ? preset.locales?.ar?.name
            : preset.locales?.en?.name) ||
          preset.name ||
          (hasMultiplePresets ? `Variant ${idx + 1}` : sectionName);
        const presetCategory = preset.category ?? fallbackCategory;
        cards.push({
          sectionType: s.type,
          sectionTag: s.tag ?? null,
          presetIndex: idx,
          sectionName,
          presetName,
          hasMultiplePresets,
          category: presetCategory,
        });
      });
    }
    return cards;
  }, [schemas, isAr]);

  // Compatibility filter: hide sections tagged for a DIFFERENT
  // template. Sections without a tag are always compatible. The
  // section's `tag` is matched against the current `activePage`.
  const compatibleCards = useMemo(() => {
    return allCards.filter((c) => {
      if (!c.sectionTag) return true;
      return c.sectionTag === activePage;
    });
  }, [allCards, activePage]);

  // Available category chips — only show categories that have at least
  // one compatible card. Always include "all" first.
  const availableCategories = useMemo(() => {
    const present = new Set<string>();
    for (const c of compatibleCards) present.add(c.category);
    return CATEGORY_ORDER.filter(
      (id) => id === "all" || present.has(id),
    );
  }, [compatibleCards]);

  // Final visible cards: category filter + search filter.
  const visibleCards = useMemo(() => {
    let list = compatibleCards;
    if (category !== "all") {
      list = list.filter((c) => c.category === category);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.sectionName.toLowerCase().includes(q) ||
          c.presetName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [compatibleCards, category, search]);

  if (!showAddSection) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-section-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        // Click on the backdrop closes; clicks inside the dialog do not.
        if (e.target === e.currentTarget) setShowAddSection(false);
      }}
    >
      <div
        className="flex w-full max-w-2xl max-h-[80vh] flex-col rounded-xl border bg-background shadow-2xl"
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
          <div>
            <h2 id="add-section-title" className="text-sm font-semibold">
              {isAr ? "إضافة قسم" : "Add section"}
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isAr
                ? `إلى قالب: ${activePage}`
                : `Adding to template: ${activePage}`}
            </p>
          </div>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setShowAddSection(false)}
            aria-label={isAr ? "إغلاق" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 shrink-0">
          <div className="relative">
            <Search
              className={cn(
                "absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground",
                isAr ? "right-3" : "left-3",
              )}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isAr ? "ابحث عن قسم..." : "Search sections…"
              }
              className={cn("h-9", isAr ? "pr-9" : "pl-9")}
              autoFocus
            />
          </div>
        </div>

        {/* Category chips */}
        {availableCategories.length > 1 && (
          <div className="px-4 py-3 shrink-0 border-b">
            <div
              role="tablist"
              aria-label={isAr ? "تصنيف القسم" : "Section category"}
              className="flex flex-wrap gap-1.5"
            >
              {availableCategories.map((id) => {
                const isActive = category === id;
                const count =
                  id === "all"
                    ? compatibleCards.length
                    : compatibleCards.filter((c) => c.category === id).length;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={isActive ? "true" : "false"}
                    onClick={() => setCategory(id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground/70 hover:bg-muted/70",
                    )}
                  >
                    <span>{CATEGORY_LABELS[id][isAr ? "ar" : "en"]}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                        isActive ? "bg-white/20" : "bg-background/60",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Section grid */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {visibleCards.length === 0 ? (
            <div className="py-10 text-center">
              <Layers className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium">
                {isAr ? "لا توجد نتائج" : "No matching sections"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {search
                  ? isAr
                    ? "جرّب كلمة بحث مختلفة أو تصنيفًا آخر."
                    : "Try a different search or category."
                  : isAr
                    ? "هذا القالب لا يقبل أي قسم في هذا التصنيف."
                    : "No sections in this category for the current template."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {visibleCards.map((card) => {
                const Icon = ICON_BY_TYPE[card.sectionType] ?? LayoutGrid;
                const tileClass =
                  CATEGORY_TILE_BG[card.category] ?? CATEGORY_TILE_BG.content;
                return (
                  <button
                    key={`${card.sectionType}:${card.presetIndex}`}
                    type="button"
                    onClick={() => {
                      addSection(card.sectionType, card.presetIndex);
                      setShowAddSection(false);
                    }}
                    className="group flex flex-col items-center gap-2 rounded-lg border bg-card p-3 text-center transition-all hover:border-primary hover:shadow-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <div
                      className={cn(
                        "flex h-14 w-full items-center justify-center rounded-md transition-transform group-hover:scale-105",
                        tileClass,
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium leading-tight">
                        {card.presetName}
                      </p>
                      {card.hasMultiplePresets && (
                        <p className="text-[10px] text-muted-foreground">
                          {card.sectionName}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — count + ESC hint. Helps the merchant gauge whether
            they've scrolled past everything available. */}
        <div className="flex items-center justify-between border-t px-4 py-2 text-[11px] text-muted-foreground shrink-0">
          <span>
            {isAr
              ? `${visibleCards.length} قسم متاح`
              : `${visibleCards.length} sections`}
          </span>
          <span className="font-mono">
            {isAr ? "Esc للإغلاق" : "Esc to close"}
          </span>
        </div>
      </div>
    </div>
  );
}
