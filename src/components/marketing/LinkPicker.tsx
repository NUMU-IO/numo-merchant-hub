/**
 * LinkPicker — three-tab control for promotion click-through URLs.
 *
 * Replaces the bare URL text input on announcement bars / popup CTAs /
 * floating-widget CTAs. Keeps the persisted shape unchanged (`link_url`
 * / `cta_url` are still simple strings) so the API and storefront don't
 * need to know this picker exists — the merchant just gets a friendlier
 * editor that:
 *
 *   • "Custom URL"  → free-text input (kept for /about, external)
 *   • "Specific product"  → searchable combobox; emits `/product/{id}`
 *   • "Specific category" → searchable combobox; emits `/collections/{slug}`
 *
 * On hydrate the picker parses the saved value back to the right tab
 * so editing an existing promo lands on the matching mode.
 */

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { listCategories } from "@/services/categoryApi";
import { listProducts } from "@/services/productApi";
import { cn } from "@/lib/utils";

type LinkMode = "url" | "product" | "category";

interface LinkPickerProps {
  storeId: string | undefined;
  value: string;
  onChange: (next: string) => void;
  /** Override the input id so multiple pickers in the same form don't collide. */
  id?: string;
  placeholder?: string;
}

// Match storefront route shapes — see numu-egyptian-bazaar/app/(store)/.
const PRODUCT_PREFIX = "/product/";
const CATEGORY_PREFIX = "/collections/";

function detectMode(value: string): LinkMode {
  if (value.startsWith(PRODUCT_PREFIX)) return "product";
  if (value.startsWith(CATEGORY_PREFIX)) return "category";
  return "url";
}

export function LinkPicker({
  storeId,
  value,
  onChange,
  id,
  placeholder,
}: LinkPickerProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  // Initial mode is derived from the persisted value once; after that
  // the merchant is in charge via the tabs. Re-deriving on every value
  // change would yank the merchant back to "url" the moment they
  // start typing in the URL input.
  const initialModeRef = useRef<LinkMode>(detectMode(value));
  const [mode, setMode] = useState<LinkMode>(initialModeRef.current);

  // Hydrate when the parent swaps in a fresh value (edit-mode load).
  useEffect(() => {
    const incoming = detectMode(value);
    if (incoming !== initialModeRef.current) {
      initialModeRef.current = incoming;
      setMode(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="space-y-2">
      <Tabs value={mode} onValueChange={(v) => setMode(v as LinkMode)}>
        <TabsList className="w-full">
          <TabsTrigger value="url" className="flex-1 gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            {isAr ? "رابط" : "URL"}
          </TabsTrigger>
          <TabsTrigger value="product" className="flex-1 gap-1.5">
            <Package className="h-3.5 w-3.5" />
            {isAr ? "منتج" : "Product"}
          </TabsTrigger>
          <TabsTrigger value="category" className="flex-1 gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            {isAr ? "فئة" : "Category"}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "url" && (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "/products"}
          dir="ltr"
        />
      )}

      {mode === "product" && (
        <ProductPicker
          storeId={storeId}
          value={value.startsWith(PRODUCT_PREFIX) ? value : ""}
          onChange={onChange}
        />
      )}

      {mode === "category" && (
        <CategoryPicker
          storeId={storeId}
          value={value.startsWith(CATEGORY_PREFIX) ? value : ""}
          onChange={onChange}
        />
      )}

      {/* Show the resolved canonical URL so merchants always know what
          will be persisted, regardless of which tab they used. */}
      {value && (
        <p className="text-xs text-muted-foreground font-mono truncate" dir="ltr">
          → {value}
        </p>
      )}
      {t("placeholder") && null /* keep `t` referenced for future i18n keys */}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Product picker                                                              //
// --------------------------------------------------------------------------- //

interface PickerProps {
  storeId: string | undefined;
  value: string;
  onChange: (next: string) => void;
}

function ProductPicker({ storeId, value, onChange }: PickerProps) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const productsQuery = useQuery({
    queryKey: ["promotions-link-picker", "products", storeId, search],
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
  const selectedId = value.startsWith(PRODUCT_PREFIX)
    ? value.slice(PRODUCT_PREFIX.length)
    : "";
  const selectedItem = useMemo(
    () => items.find((p) => p.id === selectedId),
    [items, selectedId],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selectedId
            ? selectedItem?.name ?? `${isAr ? "منتج" : "Product"} ${selectedId.slice(0, 8)}…`
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
                    onChange(`${PRODUCT_PREFIX}${p.id}`);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "me-2 h-4 w-4",
                      selectedId === p.id ? "opacity-100" : "opacity-0",
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
// Category picker                                                             //
// --------------------------------------------------------------------------- //

function CategoryPicker({ storeId, value, onChange }: PickerProps) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Categories list is small — fetch all once and filter client-side.
  const categoriesQuery = useQuery({
    queryKey: ["promotions-link-picker", "categories", storeId],
    queryFn: () => listCategories(storeId!, false),
    enabled: !!storeId,
    staleTime: 60_000,
  });

  const categories = categoriesQuery.data ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.trim().toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q),
    );
  }, [categories, search]);

  const selectedSlug = value.startsWith(CATEGORY_PREFIX)
    ? value.slice(CATEGORY_PREFIX.length)
    : "";
  const selectedItem = categories.find((c) => c.slug === selectedSlug);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selectedSlug
            ? selectedItem?.name ?? `${isAr ? "فئة" : "Category"} ${selectedSlug}`
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
                  value={c.slug}
                  onSelect={() => {
                    onChange(`${CATEGORY_PREFIX}${c.slug}`);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "me-2 h-4 w-4",
                      selectedSlug === c.slug ? "opacity-100" : "opacity-0",
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
