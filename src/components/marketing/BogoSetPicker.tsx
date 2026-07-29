/**
 * BogoSetPicker — catalog set selector for rule targeting.
 *
 * Used for BOGO's "Customer buys" / "Customer gets" sides and for
 * MULTIBUY's single "eligible items" set. Each instance lets the merchant
 * pick:
 *
 *   • "Any product" — no filter; BOGO falls back to "any product,
 *     cheapest-unit free" and MULTIBUY treats the whole store as eligible.
 *   • "Specific products" — searchable multi-select; emits UUIDs.
 *   • "Specific categories" — same shape; emits UUIDs.
 *
 * **Multi-select.** It shipped single-id, which was fine for "one shirt →
 * one hat" but made a real offer like "any 3 from these 2 collections for
 * EGP 650" impossible to build in the UI at all — and worse, opening such a
 * promotion (created via the API) and pressing Save silently dropped every
 * id but the first, quietly halving the offer's reach. The engine always
 * accepted a list per `target_value`, so this is purely the UI catching up.
 *
 * The picker is intentionally not the existing `LinkPicker` from the
 * announcement-bar / popup CTA fields. That one emits a URL string
 * (`/product/{id}` / `/collections/{slug}`); rule targeting needs the raw
 * IDs to round-trip cleanly into the PromotionTarget rows.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronsUpDown,
  FolderOpen,
  Globe,
  Package,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { listCategories } from "@/services/categoryApi";
import { listProducts } from "@/services/productApi";
import { cn } from "@/lib/utils";

export type BogoSetMode = "any" | "product" | "category";

export interface BogoSetValue {
  mode: BogoSetMode;
  productIds: string[];
  categoryIds: string[];
}

interface Props {
  storeId: string | undefined;
  mode: BogoSetMode;
  productIds: string[];
  categoryIds: string[];
  onChange: (next: BogoSetValue) => void;
  /** "buy" / "get" for BOGO, "eligible" for multibuy — picks the labels. */
  side: "buy" | "get" | "eligible";
}

/** Add or remove an id, preserving order. */
function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function BogoSetPicker({
  storeId,
  mode,
  productIds,
  categoryIds,
  onChange,
  side,
}: Props) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const titleKey =
    side === "buy"
      ? "promotions.form.bogo_buy_set"
      : side === "get"
        ? "promotions.form.bogo_get_set"
        : "promotions.form.multibuy_eligible_set";
  const anyHintKey =
    side === "get"
      ? "promotions.form.bogo_get_any_hint"
      : side === "eligible"
        ? "promotions.form.multibuy_any_hint"
        : "promotions.form.bogo_buy_any_hint";

  return (
    <div className="space-y-2">
      <Tabs
        value={mode}
        onValueChange={(v) =>
          onChange({
            mode: v as BogoSetMode,
            // Switching kind CLEARS the other kind's ids. A role emits one
            // target of one kind, so carrying both would be ambiguous — and
            // the safe direction is to drop rather than silently ship ids the
            // merchant can no longer see.
            productIds: v === "product" ? productIds : [],
            categoryIds: v === "category" ? categoryIds : [],
          })
        }
      >
        <TabsList className="w-full">
          <TabsTrigger value="any" className="flex-1 gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            {isAr ? "أي منتج" : "Any product"}
          </TabsTrigger>
          <TabsTrigger value="product" className="flex-1 gap-1.5">
            <Package className="h-3.5 w-3.5" />
            {isAr ? "منتجات محددة" : "Specific products"}
          </TabsTrigger>
          <TabsTrigger value="category" className="flex-1 gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            {isAr ? "فئات محددة" : "Specific categories"}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "any" && (
        <p className="text-xs text-muted-foreground">{t(anyHintKey)}</p>
      )}
      {mode === "product" && (
        <ProductMultiCombobox
          storeId={storeId}
          values={productIds}
          onToggle={(id) =>
            onChange({
              mode: "product",
              productIds: toggle(productIds, id),
              categoryIds: [],
            })
          }
        />
      )}
      {mode === "category" && (
        <CategoryMultiCombobox
          storeId={storeId}
          values={categoryIds}
          onToggle={(id) =>
            onChange({
              mode: "category",
              productIds: [],
              categoryIds: toggle(categoryIds, id),
            })
          }
        />
      )}

      {/* Title is just a sr-only marker so screen readers can tell the
          pickers apart on the page. */}
      <span className="sr-only">{t(titleKey)}</span>
    </div>
  );
}

/** Chips for what's selected, each removable. */
function SelectedChips({
  ids,
  labelFor,
  onRemove,
}: {
  ids: string[];
  labelFor: (id: string) => string;
  onRemove: (id: string) => void;
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  if (ids.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {ids.map((id) => (
        <Badge key={id} variant="secondary" className="gap-1 font-normal">
          <span className="max-w-[12rem] truncate">{labelFor(id)}</span>
          <button
            type="button"
            onClick={() => onRemove(id)}
            className="opacity-60 hover:opacity-100"
            aria-label={isAr ? "إزالة" : "Remove"}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}

/** Trigger label: "Select…" / the single name / "N selected". */
function triggerLabel(
  count: number,
  single: string | undefined,
  isAr: boolean,
  kind: "product" | "category",
): string {
  if (count === 0) {
    if (kind === "product") return isAr ? "اختر منتجات…" : "Select products…";
    return isAr ? "اختر فئات…" : "Select categories…";
  }
  if (count === 1 && single) return single;
  return isAr ? `${count} محددة` : `${count} selected`;
}

// --------------------------------------------------------------------------- //
// Product multi-combobox                                                      //
// --------------------------------------------------------------------------- //

function ProductMultiCombobox({
  storeId,
  values,
  onToggle,
}: {
  storeId: string | undefined;
  values: string[];
  onToggle: (id: string) => void;
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const productsQuery = useQuery({
    queryKey: ["bogo-set-picker", "products", storeId, search],
    queryFn: () =>
      listProducts(storeId!, {
        search: search.trim() || undefined,
        limit: 25,
      }),
    enabled: !!storeId,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const items = productsQuery.data?.items ?? [];
  // A selected id may not be in the current (searched/paged) page, so fall
  // back to a truncated id rather than rendering an empty chip.
  const nameFor = (id: string) =>
    items.find((p) => p.id === id)?.name ??
    `${isAr ? "منتج" : "Product"} ${id.slice(0, 8)}…`;

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {triggerLabel(values.length, nameFor(values[0] ?? ""), isAr, "product")}
            <ChevronsUpDown className="ms-2 h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={isAr ? "ابحث عن منتج…" : "Search products…"}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {productsQuery.isLoading
                  ? isAr
                    ? "جاري التحميل…"
                    : "Loading…"
                  : isAr
                    ? "لا توجد منتجات"
                    : "No products found."}
              </CommandEmpty>
              <CommandGroup>
                {items.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    // Stays open on select — picking several is the point.
                    onSelect={() => onToggle(p.id)}
                  >
                    <Check
                      className={cn(
                        "me-2 h-4 w-4",
                        values.includes(p.id) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate flex-1">{p.name}</span>
                    {p.sku && (
                      <span className="ms-2 text-xs text-muted-foreground font-mono">
                        {p.sku}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <SelectedChips ids={values} labelFor={nameFor} onRemove={onToggle} />
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Category multi-combobox                                                     //
// --------------------------------------------------------------------------- //

function CategoryMultiCombobox({
  storeId,
  values,
  onToggle,
}: {
  storeId: string | undefined;
  values: string[];
  onToggle: (id: string) => void;
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["bogo-set-picker", "categories", storeId],
    queryFn: () => listCategories(storeId!, false),
    enabled: !!storeId,
    staleTime: 60_000,
  });

  const categories = categoriesQuery.data ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.trim().toLowerCase();
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
    );
  }, [categories, search]);

  const nameFor = (id: string) =>
    categories.find((c) => c.id === id)?.name ??
    `${isAr ? "فئة" : "Category"} ${id.slice(0, 8)}…`;

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {triggerLabel(values.length, nameFor(values[0] ?? ""), isAr, "category")}
            <ChevronsUpDown className="ms-2 h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={isAr ? "ابحث عن فئة…" : "Search categories…"}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {categoriesQuery.isLoading
                  ? isAr
                    ? "جاري التحميل…"
                    : "Loading…"
                  : isAr
                    ? "لا توجد فئات"
                    : "No categories found."}
              </CommandEmpty>
              <CommandGroup>
                {filtered.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => onToggle(c.id)}
                  >
                    <Check
                      className={cn(
                        "me-2 h-4 w-4",
                        values.includes(c.id) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate flex-1">{c.name}</span>
                    <span className="ms-2 text-xs text-muted-foreground font-mono">
                      {c.slug}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <SelectedChips ids={values} labelFor={nameFor} onRemove={onToggle} />
    </div>
  );
}
