import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useQueries } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink, Package } from "lucide-react";
import { formatMoney } from "@/lib/format-money";
import type { Order, OrderLineItem } from "@/services/orderApi";
import { getProduct, type ApiProductResponse } from "@/services/productApi";
import { formatOrderCurrency } from "./_shared";

interface Props {
  order: Order;
}

/**
 * Line items with product imagery + variant pills.
 *
 * The order line items themselves don't snapshot the product image (only
 * name/variant_name/sku), so we fetch each unique product in parallel via
 * `useQueries`. React Query caches per (storeId, productId), so opening
 * the order detail again is instant and other order pages benefit from
 * the same warm cache. A placeholder icon fills in for deleted products.
 *
 * `variant_name` is a slash-separated string ("Large / Blue") — we split
 * it back into individual pill badges for readability.
 */
export function OrderLineItemsCard({ order }: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const fmt = (cents: number) => formatOrderCurrency(cents, language);
  const returnedQty = (index: number) =>
    order.partial_acceptance?.lines.find((l) => l.order_line_index === index)?.returned_quantity ?? 0;

  const uniqueProductIds = useMemo(() => {
    const seen = new Set<string>();
    for (const it of order.line_items) {
      if (it.product_id) seen.add(it.product_id);
    }
    return Array.from(seen);
  }, [order.line_items]);

  const productQueries = useQueries({
    queries: uniqueProductIds.map((id) => ({
      queryKey: ["product", storeId, id],
      queryFn: () => getProduct(storeId!, id),
      enabled: !!storeId,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const productById = useMemo(() => {
    const map = new Map<string, ApiProductResponse | undefined>();
    productQueries.forEach((q, i) => map.set(uniqueProductIds[i], q.data));
    return map;
  }, [productQueries, uniqueProductIds]);

  const productImageById = useMemo(() => {
    const map = new Map<string, string | null>();
    productQueries.forEach((q, i) => {
      const id = uniqueProductIds[i];
      const firstImage = q.data?.images?.[0] || null;
      map.set(id, firstImage);
    });
    return map;
  }, [productQueries, uniqueProductIds]);

  /** Which line the merchant is looking at up close, if any. */
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Split the variant label into individual pills.
  // The storefront checkout backend formats this as `"Color: Red, Size: M"`
  // (key-prefixed, comma-separated — see api/v1/routes/storefront/checkout.py).
  // Legacy carts may still send slash-delimited `"Large / Blue"`. Handle both.
  const splitVariant = (v: string | null | undefined): string[] => {
    if (!v) return [];
    return v
      .split(/\s*[,/]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{t("orders.lineItems")}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {order.item_count}{" "}
            {language === "ar"
              ? "قطعة"
              : order.item_count === 1
                ? "item"
                : "items"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border/40">
          {order.line_items.map((item, i) => {
            const imageUrl = productImageById.get(item.product_id) ?? null;
            const variantPills = splitVariant(item.variant_name);
            const isDiscounted =
              item.total_price > 0 &&
              item.total_price < item.unit_price * item.quantity;

            return (
              <li
                key={`${item.product_id}-${item.variant_id ?? ""}-${i}`}
                className="first:pt-0 last:pb-0"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(i)}
                  aria-label={t("orders.viewProduct", "View product")}
                  className="flex min-w-0 w-full items-start gap-3 rounded-lg py-3 text-start transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                {/* Image / placeholder */}
                <div className="relative h-14 w-14 rounded-lg bg-muted/50 ring-1 ring-border/40 shrink-0 overflow-hidden">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={item.product_name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                      <Package className="h-5 w-5" />
                    </div>
                  )}
                  {item.quantity > 1 && (
                    <span className="absolute -top-1.5 -end-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-foreground text-background text-[10px] font-semibold flex items-center justify-center tabular-nums">
                      {item.quantity}
                    </span>
                  )}
                  {returnedQty(i) > 0 && (
                    <span className="absolute -bottom-1.5 -end-1.5 rounded-full bg-terracotta px-1.5 h-5 min-w-[20px] text-[10px] font-semibold text-white flex items-center justify-center tabular-nums" title={t("orders.partial.returnedBadge", { count: returnedQty(i) })}>
                      −{returnedQty(i)}
                    </span>
                  )}
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {item.product_name}
                      </p>
                      {variantPills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {variantPills.map((v, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-[10px] py-0 px-1.5 font-normal text-muted-foreground border-border/60"
                            >
                              {v}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {item.sku && (
                        <p className="text-[11px] text-muted-foreground/70 mt-1 font-mono truncate">
                          {language === "ar" ? "كود: " : "SKU: "}
                          {item.sku}
                        </p>
                      )}
                    </div>

                    {/* Price column */}
                    <div className="text-end shrink-0">
                      <p className="text-sm font-semibold tabular-nums">
                        {fmt(item.total_price)}
                      </p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {fmt(item.unit_price)} ×{" "}
                        <span className="tabular-nums">{item.quantity}</span>
                      </p>
                      {isDiscounted && (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {language === "ar" ? "تم الخصم" : "Discounted"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>

      <LineItemDialog
        item={openIndex === null ? null : order.line_items[openIndex]}
        product={
          openIndex === null
            ? undefined
            : productById.get(order.line_items[openIndex].product_id)
        }
        onClose={() => setOpenIndex(null)}
      />
    </Card>
  );
}

/**
 * What a line item looks like up close: the product's photo at a size worth
 * looking at, what was ordered, and what the catalogue says about it today.
 *
 * The order line only snapshots name, variant, SKU and the prices charged, so
 * everything else — the images, current price, stock — comes from the product
 * the card already fetched. A product that has since been deleted still opens:
 * the snapshot is what the merchant needs to read, and the missing catalogue
 * half says so rather than showing an empty panel.
 */
function LineItemDialog({
  item,
  product,
  onClose,
}: {
  item: OrderLineItem | null;
  product: ApiProductResponse | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [shot, setShot] = useState(0);

  const images = product?.images ?? [];
  const cover = images[shot] || images[0] || item?.image_url || null;
  const catalogPrice = product ? Number(product.effective_price ?? product.price) : null;

  return (
    <Dialog
      open={!!item}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setShot(0);
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="text-start">{item.product_name}</DialogTitle>
              {item.sku && (
                <DialogDescription className="text-start font-mono text-[11px]">
                  {isAr ? "كود: " : "SKU: "}
                  {item.sku}
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="aspect-square w-full overflow-hidden rounded-xl bg-muted/50 ring-1 ring-border/40">
                  {cover ? (
                    <img
                      src={cover}
                      alt={item.product_name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Package className="h-10 w-10" />
                    </div>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {images.slice(0, 6).map((src, idx) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() => setShot(idx)}
                        className={
                          "h-12 w-12 overflow-hidden rounded-md ring-1 transition-colors " +
                          (idx === shot ? "ring-2 ring-primary" : "ring-border/50 hover:ring-border")
                        }
                      >
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <dl className="space-y-3 text-sm">
                <Row label={isAr ? "الكمية" : "Quantity"} value={String(item.quantity)} />
                <Row
                  label={isAr ? "سعر القطعة" : "Unit price"}
                  value={formatOrderCurrency(item.unit_price, language)}
                />
                <Row
                  label={isAr ? "الإجمالي" : "Line total"}
                  value={formatOrderCurrency(item.total_price, language)}
                  strong
                />
                {item.variant_name && (
                  <Row label={isAr ? "الخيارات" : "Options"} value={item.variant_name} />
                )}

                {product ? (
                  <>
                    <div className="border-t border-border/50 pt-3">
                      <Row
                        label={isAr ? "سعر المنتج حاليًا" : "Price today"}
                        value={
                          catalogPrice === null
                            ? "—"
                            : formatMoney(catalogPrice, {
                                currency: product.price_currency,
                                locale: language,
                              })
                        }
                      />
                    </div>
                    <Row
                      label={isAr ? "المخزون" : "In stock"}
                      value={
                        product.is_in_stock
                          ? String(product.quantity)
                          : isAr
                            ? "نفد"
                            : "Out of stock"
                      }
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {product.status}
                      </Badge>
                      {product.is_low_stock && (
                        <Badge variant="outline" className="text-[10px] font-normal text-amber-600">
                          {isAr ? "مخزون منخفض" : "Low stock"}
                        </Badge>
                      )}
                      {product.brand && (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {product.brand}
                        </Badge>
                      )}
                    </div>
                    {product.short_description && (
                      <p className="pt-1 text-[12px] leading-relaxed text-muted-foreground">
                        {product.short_description}
                      </p>
                    )}
                    <Button asChild variant="outline" size="sm" className="mt-1 w-full">
                      <Link to={`/products/${product.id}/edit`} onClick={onClose}>
                        <ExternalLink className="me-1.5 h-3.5 w-3.5" />
                        {isAr ? "افتح المنتج" : "Open product"}
                      </Link>
                    </Button>
                  </>
                ) : (
                  <p className="border-t border-border/50 pt-3 text-[12px] text-muted-foreground">
                    {isAr
                      ? "المنتج ده مش موجود في الكتالوج دلوقتي — البيانات فوق من وقت الأوردر."
                      : "This product is no longer in the catalogue — the details above are from the time of the order."}
                  </p>
                )}
              </dl>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className={"tabular-nums " + (strong ? "font-semibold" : "")}>{value}</dd>
    </div>
  );
}
