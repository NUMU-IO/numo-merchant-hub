/**
 * PreviewResourcePicker — TopBar control for picking which product /
 * collection the iframe renders against when on a resource template.
 *
 * Shopify-parity. The Product and Collection templates only render
 * meaningfully when bound to a specific resource — the merchant's
 * section settings are template-level (apply to ALL products using
 * the template), but the resource data (title, images, price) comes
 * from the store. Without a picker, the iframe lands on `/product`
 * or `/collections` and 404s.
 *
 * Behavior:
 *   - Renders only when activePage is `product` or `collection`.
 *   - First mount on a resource template auto-picks the first
 *     available item from the catalog (so the merchant doesn't have
 *     to click into the menu before seeing anything).
 *   - Switching the resource updates `customizerStore.previewResources`;
 *     LivePreview rebuilds the iframe URL and the iframe hard-navs.
 *   - The picker is a popover with a search input + result list. We
 *     don't lazy-load like Shopify does because category counts are
 *     small in practice; client-side filter is fine.
 *
 * Stored state shape (`previewResources`):
 *   {
 *     productId: string | null,
 *     productLabel: string | null,
 *     collectionSlug: string | null,
 *     collectionLabel: string | null,
 *   }
 *
 * The label is denormalized so the trigger button can show
 * "Product: Red shirt" without a re-fetch on every render. It's
 * always populated from whatever the picker showed at selection
 * time; if the underlying product is later renamed, the trigger
 * stays stale until the merchant re-opens the picker. Acceptable
 * trade-off vs. round-trips on every render.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Loader2,
  Search,
  ShoppingBag,
  FolderOpen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { listProducts } from "@/services/productApi";
import { listCategories } from "@/services/categoryApi";
import { useCustomizerStore } from "../../store/customizerStore";

type Mode = "product" | "collection";

interface ResourceOption {
  id: string;
  slug?: string;
  name: string;
  image?: string | null;
}

export function PreviewResourcePicker() {
  const activePage = useCustomizerStore((s) => s.activePage);
  const storeId = useCustomizerStore((s) => s.storeId);
  const locale = useCustomizerStore((s) => s.locale);
  const previewResources = useCustomizerStore((s) => s.previewResources);
  const setPreviewResource = useCustomizerStore((s) => s.setPreviewResource);
  const isAr = locale === "ar";

  // Determine current mode from activePage. Component returns null
  // for any other template — the parent TopBar can render this
  // unconditionally and the picker hides itself.
  const mode: Mode | null =
    activePage === "product"
      ? "product"
      : activePage === "collection"
        ? "collection"
        : null;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ResourceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Fetch list whenever the mode changes (or query changes for product).
  // Collections are loaded once; products refetch per search (server-
  // side filter via `listProducts`).
  useEffect(() => {
    if (!mode || !storeId) return;
    let cancelled = false;
    setLoading(true);
    const fetcher =
      mode === "product"
        ? listProducts(storeId, { search: query, limit: 30 }).then(
            (res) => {
              const list = (((res as { items?: unknown[]; products?: unknown[] })
                .items ??
                (res as { products?: unknown[] }).products ??
                []) as Array<{
                id: string;
                slug?: string;
                name?: string;
                primary_image?: string | null;
              }>);
              return list.map<ResourceOption>((p) => ({
                id: p.id,
                slug: p.slug,
                name: p.name ?? p.id,
                image: p.primary_image ?? null,
              }));
            },
          )
        : listCategories(storeId).then((list) => {
            const cats = (list as Array<{
              id: string;
              slug?: string;
              name: string;
              image_url?: string | null;
            }>);
            // Client-side filter for collections since the categories
            // endpoint doesn't accept a search arg today.
            const q = query.toLowerCase().trim();
            return cats
              .filter(
                (c) =>
                  !q ||
                  c.name.toLowerCase().includes(q) ||
                  (c.slug ?? "").toLowerCase().includes(q),
              )
              .map<ResourceOption>((c) => ({
                id: c.id,
                slug: c.slug,
                name: c.name,
                image: c.image_url ?? null,
              }));
          });
    fetcher
      .then((list) => {
        if (cancelled) return;
        setItems(list);
      })
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [mode, storeId, query]);

  // Auto-pick first available item when entering the template with no
  // prior selection. Done in a separate effect (not in the fetcher
  // above) so query changes don't trigger auto-pick.
  useEffect(() => {
    if (!mode || !storeId) return;
    if (mode === "product" && previewResources.productId) return;
    if (mode === "collection" && previewResources.collectionSlug) return;
    if (items.length === 0) return;
    const first = items[0];
    if (mode === "product") {
      setPreviewResource("product", first.slug ?? first.id, first.name);
    } else {
      setPreviewResource("collection", first.slug ?? first.id, first.name);
    }
    // We intentionally depend on items but NOT previewResources here —
    // re-running on every preview-resource change would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, storeId, items]);

  // Close dropdown on outside click.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Reset search when the dropdown reopens or mode changes.
  useEffect(() => {
    if (open) setQuery("");
  }, [open, mode]);

  if (!mode) return null;

  const triggerLabel = (() => {
    if (mode === "product") {
      return previewResources.productLabel || (isAr ? "اختر منتجاً" : "Pick a product");
    }
    return previewResources.collectionLabel || (isAr ? "اختر مجموعة" : "Pick a collection");
  })();

  const Icon = mode === "product" ? ShoppingBag : FolderOpen;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs max-w-48"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open ? "true" : "false"}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
      </Button>

      {open && (
        <div
          className="absolute end-0 top-full z-40 mt-1 w-72 rounded-md border bg-popover p-2 shadow-lg"
          role="listbox"
          aria-label={
            mode === "product"
              ? isAr ? "اختر منتج للمعاينة" : "Pick product to preview"
              : isAr ? "اختر مجموعة للمعاينة" : "Pick collection to preview"
          }
        >
          <p className="px-1 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            {isAr ? "معاينة في القالب" : "Preview in template"}
          </p>
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                mode === "product"
                  ? isAr ? "ابحث عن منتج..." : "Search products…"
                  : isAr ? "ابحث عن مجموعة..." : "Search collections…"
              }
              className="ps-8 h-8 text-xs"
              autoFocus
            />
          </div>
          <div className="mt-2 max-h-72 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </div>
            )}
            {!loading && items.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                {mode === "product"
                  ? isAr ? "لا توجد منتجات." : "No products."
                  : isAr ? "لا توجد مجموعات." : "No collections."}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const selectedId =
                  mode === "product"
                    ? previewResources.productId
                    : previewResources.collectionSlug;
                const itemKey = item.slug ?? item.id;
                const isSelected = selectedId === itemKey;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected ? "true" : "false"}
                      onClick={() => {
                        setPreviewResource(mode, itemKey, item.name);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-xs transition-colors",
                        isSelected
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted",
                      )}
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt=""
                          className="h-6 w-6 rounded object-cover"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded bg-muted shrink-0" />
                      )}
                      <span className="flex-1 truncate">{item.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
