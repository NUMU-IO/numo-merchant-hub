/**
 * PromotedItemPicker — "what is this campaign promoting?"
 *
 * Standalone picker used by both the New Campaign dialog and the Edit
 * Message dialog. Drives the email body via `buildEmailBody()` so the
 * preview iframe always reflects the chosen destination — addresses the
 * core merchant question "shouldn't picking a product change the
 * preview?".
 *
 * Lives entirely in the hub for now. When the backend `promoted_item`
 * field ships, the parent dialog will additionally persist this
 * selection on the campaign so the Trackable-link panel + Detail-page
 * sidebar can read it back.
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";

import { listProducts, type ApiProductResponse } from "@/services/productApi";
import { showError } from "@/lib/show-error";
import type { PromotedSnapshot } from "@/lib/campaignTemplate";

type Kind = "none" | "product" | "collection" | "page";

interface Props {
  storeId: string;
  storeUrl: string; // e.g. https://yarab-test.numueg.app — used to build destination URLs
  isAr: boolean;
  /** Current snapshot, if any. Lets the parent persist + restore state. */
  value: PromotedSnapshot | null;
  /** Fires whenever the merchant picks a complete destination (snapshot has
   *  everything needed to render the email). Fires with `null` if they
   *  clear the picker. */
  onChange: (snapshot: PromotedSnapshot | null) => void;
}

// Pages a merchant can promote that don't need a slug lookup.
const PAGE_OPTIONS: Array<{ path: string; en: string; ar: string }> = [
  { path: "/", en: "Home", ar: "الرئيسية" },
  { path: "/products", en: "All products", ar: "كل المنتجات" },
  { path: "/about", en: "About", ar: "من نحن" },
  { path: "/contact", en: "Contact", ar: "تواصل معنا" },
];

export function PromotedItemPicker({
  storeId,
  storeUrl,
  isAr,
  value,
  onChange,
}: Props) {
  const [kind, setKind] = useState<Kind>(value?.kind ?? "none");

  // Product state
  const [products, setProducts] = useState<ApiProductResponse[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productId, setProductId] = useState<string>(
    value?.kind === "product" ? value.product_id : "",
  );

  // Collection state
  const [collectionSlug, setCollectionSlug] = useState(
    value?.kind === "collection" ? value.collection_slug : "",
  );
  const [collectionName, setCollectionName] = useState(
    value?.kind === "collection" ? value.name : "",
  );

  // Page state
  const [pagePath, setPagePath] = useState<string>(
    value?.kind === "page" ? value.page_path : "/",
  );

  // Lazy-load products list when the merchant flips to "product" mode.
  // Same heuristic as TrackableLinkBuilder — 100 most recently updated.
  useEffect(() => {
    if (kind !== "product" || products.length > 0 || productsLoading) return;
    setProductsLoading(true);
    listProducts(storeId, {
      limit: 100,
      sort_by: "updated_at",
      sort_order: "desc",
    })
      .then((res) => setProducts(res.items))
      .catch((err) => showError(err))
      .finally(() => setProductsLoading(false));
  }, [kind, storeId, products.length, productsLoading]);

  // Emit a snapshot up to the parent whenever the selection completes.
  useEffect(() => {
    if (kind === "none") {
      onChange(null);
      return;
    }

    if (kind === "product") {
      const product = products.find((p) => p.id === productId);
      if (!product) {
        onChange(null);
        return;
      }
      onChange({
        kind: "product",
        product_id: product.id,
        name: product.name,
        image_url: product.images?.[0] ?? null,
        price: product.price ?? null,
        currency: product.price_currency ?? "EGP",
        url: `${storeUrl.replace(/\/$/, "")}/product/${encodeURIComponent(product.slug || product.id)}`,
      });
      return;
    }

    if (kind === "collection") {
      const slug = collectionSlug.trim();
      if (!slug) {
        onChange(null);
        return;
      }
      onChange({
        kind: "collection",
        collection_slug: slug,
        name: collectionName.trim() || slug,
        image_url: null,
        url: `${storeUrl.replace(/\/$/, "")}/products?category=${encodeURIComponent(slug)}`,
      });
      return;
    }

    if (kind === "page") {
      const opt = PAGE_OPTIONS.find((p) => p.path === pagePath);
      if (!opt) {
        onChange(null);
        return;
      }
      onChange({
        kind: "page",
        page_path: opt.path,
        name: isAr ? opt.ar : opt.en,
        url: `${storeUrl.replace(/\/$/, "")}${opt.path}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, productId, products, collectionSlug, collectionName, pagePath, storeUrl, isAr]);

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {isAr ? "ما الذي تروج له؟" : "What are you promoting?"}
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isAr
            ? "اختياري. لو اخترت، نولد لك قالب جاهز."
            : "Optional. Pick one and we'll auto-fill the message body."}
        </p>
      </div>

      <RadioGroup
        value={kind}
        onValueChange={(v) => setKind(v as Kind)}
        className="grid grid-cols-2 gap-2"
      >
        {(
          [
            { v: "product", en: "Product", ar: "منتج" },
            { v: "collection", en: "Collection", ar: "مجموعة" },
            { v: "page", en: "Page", ar: "صفحة" },
            { v: "none", en: "Nothing specific", ar: "لا شيء محدد" },
          ] as const
        ).map((opt) => (
          <label
            key={opt.v}
            className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors"
          >
            <RadioGroupItem value={opt.v} />
            <span>{isAr ? opt.ar : opt.en}</span>
          </label>
        ))}
      </RadioGroup>

      {kind === "product" && (
        <div className="space-y-1.5">
          <Label htmlFor="pi-product" className="text-xs">
            {isAr ? "اختر منتج" : "Pick a product"}
          </Label>
          {productsLoading ? (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 px-1 py-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              {isAr ? "جارٍ التحميل" : "Loading"}
            </div>
          ) : (
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="pi-product" className="h-9">
                <SelectValue
                  placeholder={isAr ? "اختر منتج…" : "Choose product…"}
                />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.price ? ` · ${p.price} ${p.price_currency}` : ""}
                  </SelectItem>
                ))}
                {products.length === 0 && (
                  <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                    {isAr ? "لا توجد منتجات" : "No products yet"}
                  </div>
                )}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {kind === "collection" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="pi-coll-slug" className="text-xs">
              {isAr ? "معرف المجموعة" : "Collection slug"}
            </Label>
            <Input
              id="pi-coll-slug"
              value={collectionSlug}
              onChange={(e) => setCollectionSlug(e.target.value)}
              placeholder="eid-sale"
              className="h-9 font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pi-coll-name" className="text-xs">
              {isAr ? "الاسم (للقالب)" : "Display name"}
            </Label>
            <Input
              id="pi-coll-name"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder={isAr ? "تشكيلة العيد" : "Eid Sale"}
              className="h-9"
            />
          </div>
        </div>
      )}

      {kind === "page" && (
        <div className="space-y-1.5">
          <Label htmlFor="pi-page" className="text-xs">
            {isAr ? "الصفحة" : "Page"}
          </Label>
          <Select value={pagePath} onValueChange={setPagePath}>
            <SelectTrigger id="pi-page" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.path} value={opt.path}>
                  {isAr ? opt.ar : opt.en}{" "}
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {opt.path}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
