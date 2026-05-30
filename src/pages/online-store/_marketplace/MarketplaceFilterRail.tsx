/**
 * MarketplaceFilterRail — Session E (2026-05-28), i18n'd Session F (2026-05-29).
 *
 * Sticky left-rail filter for the V3 marketplace catalog per file 06
 * §4.1. Four filter groups:
 *
 *   - Price (radio): Any | Free | Paid
 *   - Category (checkbox): 7 buckets from plan file 03 §8
 *   - Features (checkbox, scrollable): dynamic — sourced from the loaded
 *     themes' `feature_tags` arrays.
 *   - Languages (checkbox): English | Arabic
 *
 * Filter state lives in the parent (Themes.tsx → V3MarketplaceSection) so
 * both the rail and the grid see the same selection.
 *
 * i18n: category + language *values* stay canonical (English category
 * strings match `theme.category` from the API; "en"/"ar" are SDK codes).
 * Only the displayed labels are translated via t().
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PriceFilter = "any" | "free" | "paid";

export interface MarketplaceFilters {
  price: PriceFilter;
  categories: string[];
  features: string[];
  languages: string[];
}

export const EMPTY_FILTERS: MarketplaceFilters = {
  price: "any",
  categories: [],
  features: [],
  languages: [],
};

// File 03 §8 — 7 category buckets shipped pre-launch. The VALUE stays the
// canonical English string (it's matched against `theme.category` from the
// API); `i18nKey` only drives the displayed label.
export const CATEGORIES: Array<{ value: string; i18nKey: string }> = [
  { value: "Food & Beverage", i18nKey: "foodBeverage" },
  { value: "Fashion", i18nKey: "fashion" },
  { value: "Sports & Streetwear", i18nKey: "sportsStreetwear" },
  { value: "Electronics & Tech", i18nKey: "electronicsTech" },
  { value: "Beauty & Skincare", i18nKey: "beautySkincare" },
  { value: "Art & Design", i18nKey: "artDesign" },
  { value: "General", i18nKey: "general" },
];

// Language filter values are SDK locale codes; only the label is translated.
const LANGUAGES: Array<{ code: string; labelKey: string }> = [
  { code: "en", labelKey: "marketplace.filters.langEn" },
  { code: "ar", labelKey: "marketplace.filters.langAr" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toggleListItem<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function isFilteredDefault(f: MarketplaceFilters): boolean {
  return (
    f.price === "any" &&
    f.categories.length === 0 &&
    f.features.length === 0 &&
    f.languages.length === 0
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface MarketplaceFilterRailProps {
  filters: MarketplaceFilters;
  onFiltersChange: (filters: MarketplaceFilters) => void;
  /** All distinct `feature_tags` values across the currently loaded
   *  catalog. Sorted alphabetically by the parent. */
  availableFeatures: string[];
}

export function MarketplaceFilterRail({
  filters,
  onFiltersChange,
  availableFeatures,
}: MarketplaceFilterRailProps) {
  const { t } = useTranslation();
  const isClean = useMemo(() => isFilteredDefault(filters), [filters]);

  const priceLabel: Record<PriceFilter, string> = {
    any: t("marketplace.filters.priceAny"),
    free: t("marketplace.filters.priceFree"),
    paid: t("marketplace.filters.pricePaid"),
  };

  return (
    <aside className="lg:sticky lg:top-4 self-start space-y-5 rounded-2xl border bg-card p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold tracking-tight">
          {t("marketplace.filters.title")}
        </h3>
        {!isClean && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => onFiltersChange(EMPTY_FILTERS)}
          >
            <X className="h-3 w-3" />
            {t("marketplace.filters.clearAll")}
          </Button>
        )}
      </div>

      {/* ─── Price ─────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("marketplace.filters.price")}
        </h4>
        <RadioGroup
          value={filters.price}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, price: value as PriceFilter })
          }
          className="space-y-1.5"
        >
          {(["any", "free", "paid"] as PriceFilter[]).map((value) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem id={`price-${value}`} value={value} />
              <Label
                htmlFor={`price-${value}`}
                className="text-sm font-normal cursor-pointer"
              >
                {priceLabel[value]}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </section>

      <Separator />

      {/* ─── Category ──────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("marketplace.filters.category")}
        </h4>
        <div className="space-y-1.5">
          {CATEGORIES.map((category) => {
            const checked = filters.categories.includes(category.value);
            return (
              <div key={category.value} className="flex items-center gap-2">
                <Checkbox
                  id={`category-${category.value}`}
                  checked={checked}
                  onCheckedChange={() =>
                    onFiltersChange({
                      ...filters,
                      categories: toggleListItem(
                        filters.categories,
                        category.value,
                      ),
                    })
                  }
                />
                <Label
                  htmlFor={`category-${category.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {t(`marketplace.categories.${category.i18nKey}`)}
                </Label>
              </div>
            );
          })}
        </div>
      </section>

      <Separator />

      {/* ─── Features ──────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("marketplace.filters.features")}
        </h4>
        {availableFeatures.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            {t("marketplace.filters.noFeatures")}
          </p>
        ) : (
          <ScrollArea className="h-48 rounded-md border bg-background/50">
            <div className="space-y-1.5 p-2">
              {availableFeatures.map((feature) => {
                const checked = filters.features.includes(feature);
                return (
                  <div key={feature} className="flex items-center gap-2">
                    <Checkbox
                      id={`feature-${feature}`}
                      checked={checked}
                      onCheckedChange={() =>
                        onFiltersChange({
                          ...filters,
                          features: toggleListItem(filters.features, feature),
                        })
                      }
                    />
                    <Label
                      htmlFor={`feature-${feature}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {feature}
                    </Label>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </section>

      <Separator />

      {/* ─── Languages ─────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("marketplace.filters.languages")}
        </h4>
        <div className="space-y-1.5">
          {LANGUAGES.map((lang) => {
            const checked = filters.languages.includes(lang.code);
            return (
              <div key={lang.code} className="flex items-center gap-2">
                <Checkbox
                  id={`lang-${lang.code}`}
                  checked={checked}
                  onCheckedChange={() =>
                    onFiltersChange({
                      ...filters,
                      languages: toggleListItem(filters.languages, lang.code),
                    })
                  }
                />
                <Label
                  htmlFor={`lang-${lang.code}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {t(lang.labelKey)}
                </Label>
              </div>
            );
          })}
        </div>
      </section>
    </aside>
  );
}

// ── Filtering applied to a CatalogTheme[] ────────────────────────────────────

import type { CatalogTheme } from "@/services/marketplaceApi";

/**
 * Apply the four filter groups to a list of catalog themes. All groups
 * are ANDed; within each multi-select group, the theme must match at
 * least one selected value (OR within the group). Empty groups don't
 * narrow.
 */
export function applyFilters(
  themes: CatalogTheme[],
  filters: MarketplaceFilters,
): CatalogTheme[] {
  return themes.filter((t) => {
    if (filters.price === "free" && t.price_cents > 0) return false;
    if (filters.price === "paid" && t.price_cents === 0) return false;

    if (filters.categories.length > 0) {
      if (!t.category || !filters.categories.includes(t.category)) return false;
    }

    if (filters.features.length > 0) {
      const themeFeatures = t.feature_tags ?? [];
      const matchesAny = filters.features.some((f) => themeFeatures.includes(f));
      if (!matchesAny) return false;
    }

    if (filters.languages.length > 0) {
      const themeLangs = t.supported_languages ?? [];
      const matchesAny = filters.languages.some((l) => themeLangs.includes(l));
      if (!matchesAny) return false;
    }

    return true;
  });
}

/**
 * Build the alphabetical list of distinct `feature_tags` values across
 * the loaded catalog. Used to populate the Features filter group
 * dynamically. Returns an empty array when no theme has feature_tags
 * (the rail then shows a quiet placeholder).
 */
export function collectAvailableFeatures(themes: CatalogTheme[]): string[] {
  const set = new Set<string>();
  for (const t of themes) {
    for (const tag of t.feature_tags ?? []) {
      if (typeof tag === "string" && tag.trim()) set.add(tag.trim());
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
