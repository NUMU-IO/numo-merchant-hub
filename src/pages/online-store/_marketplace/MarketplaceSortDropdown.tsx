/**
 * MarketplaceSortDropdown — Session E (2026-05-28).
 *
 * Six sort options for the V3 marketplace catalog per file 06 §4.1:
 *
 *   - Relevance (default; no-op sort — keeps the backend's order)
 *   - Newest (published_at desc)
 *   - Most installed (install_count desc)
 *   - Highest rated (average_rating desc)
 *   - Price low → high
 *   - Price high → low
 *
 * Lifted into its own component so it can sit above the catalog grid
 * separately from the filter rail. Sort state lives in the parent.
 *
 * TODO_I18N — Session F.
 */

import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CatalogTheme } from "@/services/marketplaceApi";

export type MarketplaceSort =
  | "relevance"
  | "newest"
  | "installs"
  | "rating"
  | "price-asc"
  | "price-desc";

// Sort VALUES are canonical (used by applySort); the i18nKey drives the
// translated label so adding a locale never breaks the sort logic.
const SORT_OPTIONS: Array<{ value: MarketplaceSort; i18nKey: string }> = [
  { value: "relevance", i18nKey: "relevance" },
  { value: "newest", i18nKey: "newest" },
  { value: "installs", i18nKey: "installs" },
  { value: "rating", i18nKey: "rating" },
  { value: "price-asc", i18nKey: "priceAsc" },
  { value: "price-desc", i18nKey: "priceDesc" },
];

export interface MarketplaceSortDropdownProps {
  value: MarketplaceSort;
  onValueChange: (value: MarketplaceSort) => void;
}

export function MarketplaceSortDropdown({
  value,
  onValueChange,
}: MarketplaceSortDropdownProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">
        {t("marketplace.sort.label")}
      </span>
      <Select value={value} onValueChange={(v) => onValueChange(v as MarketplaceSort)}>
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {t(`marketplace.sort.${opt.i18nKey}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Apply the chosen sort to a list of themes. Always returns a new array
 * so the caller can hand it straight to React without worrying about
 * reference identity. Relevance is a no-op — it preserves whatever order
 * the backend returned, which for now is the repository's default
 * (created_at desc for v1).
 */
export function applySort(
  themes: CatalogTheme[],
  sort: MarketplaceSort,
): CatalogTheme[] {
  const sorted = [...themes];
  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => {
        const aDate = a.published_at ?? "";
        const bDate = b.published_at ?? "";
        return bDate.localeCompare(aDate);
      });
    case "installs":
      return sorted.sort(
        (a, b) => (b.install_count ?? 0) - (a.install_count ?? 0),
      );
    case "rating":
      return sorted.sort(
        (a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0),
      );
    case "price-asc":
      return sorted.sort((a, b) => a.price_cents - b.price_cents);
    case "price-desc":
      return sorted.sort((a, b) => b.price_cents - a.price_cents);
    case "relevance":
    default:
      return sorted;
  }
}
