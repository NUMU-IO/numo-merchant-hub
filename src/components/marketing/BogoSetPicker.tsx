/**
 * BogoSetPicker — "Customer buys" / "Customer gets" set selector.
 *
 * Used twice in the BOGO promotion form: once for the buy-side and
 * once for the get-side. Each instance lets the merchant pick:
 *
 *   • "Any product" — no filter; the BOGO calc falls back to "any
 *     product, cheapest-unit free" (the legacy semantics).
 *   • "Specific product" — searchable combobox; emits a UUID.
 *   • "Specific category" — same shape; emits a UUID.
 *
 * v1 ships single-id-per-role to hit the >90% case (one shirt → one
 * hat). Multi-select is a follow-up — the API already accepts a list
 * of ids per target_value, so it's purely a UI extension.
 *
 * The picker is intentionally not the existing `LinkPicker` from the
 * announcement-bar / popup CTA fields. That one emits a URL string
 * (`/product/{id}` / `/collections/{slug}`); BOGO targeting needs the
 * raw IDs to round-trip cleanly into the PromotionTarget rows.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, FolderOpen, Globe, Package } from "lucide-react";

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

interface Props {
  storeId: string | undefined;
  mode: BogoSetMode;
  productId: string;
  categoryId: string;
  onChange: (next: {
    mode: BogoSetMode;
    productId: string;
    categoryId: string;
  }) => void;
  /** Either "buy" or "get" — picks the localized labels. */
  side: "buy" | "get";
}

export function BogoSetPicker({
  storeId,
  mode,
  productId,
  categoryId,
  onChange,
  side,
}: Props) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const titleKey =
    side === "buy" ? "promotions.form.bogo_buy_set" : "promotions.form.bogo_get_set";
  const anyHintKey =
    side === "buy"
      ? "promotions.form.bogo_buy_any_hint"
      : "promotions.form.bogo_get_any_hint";

  return (
    <div className="space-y-2">
      <Tabs
        value={mode}
        onValueChange={(v) =>
          onChange({
            mode: v as BogoSetMode,
            productId: v === "product" ? productId : "",
            categoryId: v === "category" ? categoryId : "",
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
            {isAr ? "منتج محدد" : "Specific product"}
          </TabsTrigger>
          <TabsTrigger value="category" className="flex-1 gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            {isAr ? "فئة محددة" : "Specific category"}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "any" && (
        <p className="text-xs text-muted-foreground">{t(anyHintKey)}</p>
      )}
      {mode === "product" && (
        <ProductCombobox
          storeId={storeId}
          value={productId}
          onChange={(id) => onChange({ mode: "product", productId: id, categoryId: "" })}
        />
      )}
      {mode === "category" && (
        <CategoryCombobox
          storeId={storeId}
          value={categoryId}
          onChange={(id) =>
            onChange({ mode: "category", productId: "", categoryId: id })
          }
        />
      )}

      {/* Title is just a sr-only marker so screen readers can tell the
          two pickers apart on the page. */}
      <span className="sr-only">{t(titleKey)}</span>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Product combobox                                                            //
// --------------------------------------------------------------------------- //

function ProductCombobox({
  storeId,
  value,
  onChange,
}: {
  storeId: string | undefined;
  value: string;
  onChange: (id: string) => void;
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
  const selected = items.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value
            ? selected?.name ?? `${isAr ? "منتج" : "Product"} ${value.slice(0, 8)}…`
            : isAr
              ? "اختر منتج…"
              : "Select a product…"}
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
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "me-2 h-4 w-4",
                      value === p.id ? "opacity-100" : "opacity-0",
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
  );
}

// --------------------------------------------------------------------------- //
// Category combobox                                                           //
// --------------------------------------------------------------------------- //

function CategoryCombobox({
  storeId,
  value,
  onChange,
}: {
  storeId: string | undefined;
  value: string;
  onChange: (id: string) => void;
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
  const selected = categories.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value
            ? selected?.name ?? `${isAr ? "فئة" : "Category"} ${value.slice(0, 8)}…`
            : isAr
              ? "اختر فئة…"
              : "Select a category…"}
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
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "me-2 h-4 w-4",
                      value === c.id ? "opacity-100" : "opacity-0",
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
  );
}
