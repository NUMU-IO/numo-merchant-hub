import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useQueries } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import type { Order } from "@/services/orderApi";
import { getProduct } from "@/services/productApi";
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

  const productImageById = useMemo(() => {
    const map = new Map<string, string | null>();
    productQueries.forEach((q, i) => {
      const id = uniqueProductIds[i];
      const firstImage = q.data?.images?.[0] || null;
      map.set(id, firstImage);
    });
    return map;
  }, [productQueries, uniqueProductIds]);

  // Split "Large / Blue" → ["Large", "Blue"] for individual pills.
  const splitVariant = (v: string | null | undefined): string[] => {
    if (!v) return [];
    return v
      .split(/\s*\/\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  return (
    <Card>
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
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
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
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
