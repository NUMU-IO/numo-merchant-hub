import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { getOrder } from "@/services/orderApi";
import { getCustomer } from "@/services/customerApi";
import { formatOrderCurrency } from "./_shared";

interface Props {
  storeId: string;
  orderId: string;
}

/**
 * Zid-style inline order summary, rendered in a full-width row directly
 * under the order it belongs to: Order products · Bill · Customer, plus a
 * "View" button into the full /orders/:id page. Replaces the side drawer
 * so merchants scan orders without leaving the list.
 */
export function OrderRowExpansion({ storeId, orderId }: Props) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const fmt = (cents: number) => formatOrderCurrency(cents, language);

  const orderQuery = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrder(storeId, orderId),
    staleTime: 60_000,
  });
  const order = orderQuery.data;
  const customerQuery = useQuery({
    queryKey: ["customer", storeId, order?.customer_id],
    queryFn: () => getCustomer(storeId, order!.customer_id),
    enabled: !!order?.customer_id,
    staleTime: 5 * 60_000,
  });
  const customer = customerQuery.data;

  if (orderQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!order) {
    return (
      <div className="py-6 text-center text-[12.5px] text-muted-foreground">
        {isAr ? "تعذر تحميل الطلب" : "Couldn't load this order"}
      </div>
    );
  }

  const addr = order.shipping_address;
  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-[12.5px] last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-end font-medium">{value ?? "—"}</span>
    </div>
  );
  const H = ({ children }: { children: React.ReactNode }) => (
    <h4 className="mb-2 text-[13px] font-extrabold">{children}</h4>
  );

  return (
    <div className="grid gap-4 rounded-xl bg-muted/30 p-4 lg:grid-cols-[1.4fr_0.8fr_1fr]" dir={isAr ? "rtl" : "ltr"}>
      {/* Order products */}
      <div className="min-w-0">
        <H>{isAr ? "منتجات الطلب" : "Order products"}</H>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-muted/40 text-start text-[11.5px] font-semibold">
                <th className="px-3 py-2 text-start">{isAr ? "المنتج" : "Product"}</th>
                <th className="px-3 py-2 text-end">{isAr ? "السعر" : "Price"}</th>
                <th className="px-3 py-2 text-end">{isAr ? "الكمية" : "Quantity"}</th>
                <th className="px-3 py-2 text-end">{isAr ? "الإجمالي" : "Total"}</th>
              </tr>
            </thead>
            <tbody>
              {order.line_items.map((li, i) => (
                <tr key={`${li.product_id}-${i}`} className="border-t border-border/60">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground ring-1 ring-border/40">
                        {li.image_url ? (
                          <img src={li.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/products/${li.product_id}/edit`)}
                          className="block max-w-[220px] truncate text-start font-medium text-navy hover:underline dark:text-saffron"
                        >
                          {li.product_name}
                        </button>
                        <div className="truncate font-mono text-[10.5px] text-muted-foreground">
                          {li.variant_name ? `${li.variant_name} · ` : ""}{li.sku || "—"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-end tabular-nums">{fmt(li.unit_price)}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums font-semibold text-navy dark:text-saffron">{li.quantity}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums font-semibold">{fmt(li.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill */}
      <div className="min-w-0">
        <H>{isAr ? "الفاتورة" : "Bill"}</H>
        <Row label={isAr ? "المجموع الفرعي" : "Sub total"} value={fmt(order.subtotal)} />
        {order.discount_amount > 0 && <Row label={isAr ? "الخصم" : "Discount"} value={`− ${fmt(order.discount_amount)}`} />}
        {order.shipping_cost > 0 && <Row label={isAr ? "الشحن" : "Shipping"} value={fmt(order.shipping_cost)} />}
        {order.tax_amount > 0 && <Row label={isAr ? "الضريبة" : "Tax"} value={fmt(order.tax_amount)} />}
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[13px]">
          <span className="font-semibold">{isAr ? "الإجمالي" : "Total"}</span>
          <span className="font-extrabold tabular-nums">{fmt(order.total)}</span>
        </div>
        {order.payment_method && (
          <div className="mt-1 text-[11px] text-muted-foreground">
            {isAr ? "طريقة الدفع: " : "Payment: "}{order.payment_method}
          </div>
        )}
      </div>

      {/* Customer */}
      <div className="flex min-w-0 flex-col">
        <H>{isAr ? "العميل" : "Customer"}</H>
        <Row label={isAr ? "الاسم" : "Name"} value={customer?.full_name || addr?.full_name || null} />
        <Row
          label={isAr ? "رقم الموبايل" : "Phone number"}
          value={
            (customer?.phone || addr?.phone) ? (
              <a href={`tel:${customer?.phone || addr?.phone}`} className="hover:underline" dir="ltr">
                {customer?.phone || addr?.phone}
              </a>
            ) : null
          }
        />
        <Row
          label={isAr ? "الإيميل" : "Email"}
          value={customer?.email ? <a href={`mailto:${customer.email}`} className="hover:underline" dir="ltr">{customer.email}</a> : null}
        />
        <Row label={isAr ? "الدولة" : "Country"} value={addr?.country || null} />
        <Row label={isAr ? "المدينة" : "City"} value={addr?.city || null} />
        <div className="mt-auto flex justify-end pt-3">
          <Button size="sm" className="h-8 rounded-lg px-4" onClick={() => navigate(`/orders/${order.id}`)}>
            {isAr ? "عرض" : "View"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default OrderRowExpansion;
