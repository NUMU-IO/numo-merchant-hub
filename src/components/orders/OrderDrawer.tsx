import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  X, Check, Truck, Printer, ExternalLink, Loader2,
  Banknote, CreditCard, Copy, MoreHorizontal, XCircle,
  Package as PackageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { getOrder, updateOrderStatus } from "@/services/orderApi";
import { getProduct } from "@/services/productApi";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* Brand-faithful WhatsApp mark — small inline SVG so the chip reads
   instantly as WhatsApp (the lucide MessageCircle was too generic). */
const WhatsAppGlyph = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 32 32"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M16.001 4C9.373 4 4 9.373 4 16c0 2.116.555 4.105 1.523 5.825L4 28l6.343-1.487A11.94 11.94 0 0 0 16.001 28C22.628 28 28 22.627 28 16S22.628 4 16.001 4Zm0 21.818c-1.85 0-3.585-.5-5.078-1.37l-.363-.214-3.766.884.91-3.664-.236-.376A9.79 9.79 0 0 1 6.185 16c0-5.412 4.404-9.816 9.816-9.816 5.413 0 9.815 4.404 9.815 9.816 0 5.412-4.402 9.818-9.815 9.818Zm5.387-7.354c-.295-.148-1.745-.86-2.015-.957-.27-.099-.467-.148-.664.148-.196.295-.762.957-.934 1.153-.172.197-.344.222-.638.074-.295-.148-1.245-.459-2.372-1.464-.876-.781-1.467-1.747-1.639-2.042-.172-.296-.018-.456.13-.604.133-.132.295-.345.443-.517.148-.172.197-.295.295-.492.099-.197.05-.369-.025-.517-.074-.148-.664-1.604-.91-2.196-.24-.577-.484-.499-.664-.508l-.566-.01a1.09 1.09 0 0 0-.787.369c-.27.296-1.032 1.008-1.032 2.461 0 1.453 1.057 2.857 1.204 3.054.148.197 2.081 3.18 5.045 4.456.706.305 1.256.487 1.685.624.708.225 1.351.193 1.86.117.567-.085 1.745-.713 1.991-1.402.246-.69.246-1.281.172-1.402-.074-.123-.27-.197-.566-.345Z" />
  </svg>
);

interface OrderDrawerProps {
  orderId: string | null;
  onClose: () => void;
}

/**
 * Souq order drawer — slides in from the inline-end with a quick
 * summary (customer, items, payment, timeline). Clicking the order
 * id header (or the "View full details" button) navigates to the
 * dedicated /orders/:id page for full edit access.
 */
const OrderDrawer = ({ orderId, onClose }: OrderDrawerProps) => {
  const { isRTL } = useLanguage();
  const { currentStore } = useDashboardStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const storeId = currentStore?.id;

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", storeId, orderId],
    queryFn: () => getOrder(storeId!, orderId!),
    enabled: !!storeId && !!orderId,
  });

  // Fetch each line item's product in parallel so we can show the
  // real thumbnail (the OrderLineItem wire type doesn't carry image
  // URLs). Cached per product so re-opening the drawer is instant.
  const productQueries = useQueries({
    queries: (order?.line_items ?? []).map((item) => ({
      queryKey: ["product", storeId, item.product_id],
      queryFn: () => getProduct(storeId!, item.product_id),
      enabled: !!storeId && !!item.product_id,
      staleTime: 5 * 60 * 1000,
    })),
  });
  const productImageFor = (idx: number): string | null => {
    const img = productQueries[idx]?.data?.images?.[0];
    if (!img) return null;
    // Backend sometimes stores emoji as the first image. Treat short
    // non-URL strings as emoji thumbnails, not broken image URLs.
    if (!/^(https?:|\/)/.test(img) && img.length <= 4) return img;
    return img;
  };

  const open = !!orderId;
  const goFullPage = () => {
    if (orderId) {
      onClose();
      navigate(`/orders/${orderId}`);
    }
  };

  // Quick-action helpers
  const copyOrderId = () => {
    if (order) {
      navigator.clipboard.writeText(order.order_number);
      toast.success(isRTL ? "اتنسخ رقم الطلب ✓" : "Order # copied ✓");
    }
  };

  const advanceStatus = async (next: string) => {
    if (!storeId || !orderId) return;
    try {
      await updateOrderStatus(storeId, orderId, next);
      toast.success(isRTL ? "اتحدّثت الحالة ✓" : "Status updated ✓");
      queryClient.invalidateQueries({ queryKey: ["order", storeId, orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders", storeId] });
    } catch {
      toast.error(isRTL ? "حصلت مشكلة" : "Update failed");
    }
  };

  // Next-status mapping: pending → processing → shipped → delivered.
  const STATUS_FLOW: Record<string, { next: string; label: string; labelAr: string; Icon: typeof Truck }> = {
    pending:    { next: "processing", label: "Mark processing", labelAr: "ابدأ التجهيز", Icon: PackageIcon },
    processing: { next: "shipped",    label: "Mark shipped",    labelAr: "علّم اتشحن",   Icon: Truck },
    shipped:    { next: "delivered",  label: "Mark delivered",  labelAr: "علّم اتسلّم",   Icon: Check },
  };
  const flowAction = order ? STATUS_FLOW[order.status] : null;

  const fmt = (cents: number) => {
    const v = cents / 100;
    return isRTL ? `${v.toLocaleString("ar-EG")} ج.م` : `EGP ${v.toLocaleString()}`;
  };

  const fmtTimeAgo = (dt: string) => {
    const ms = Date.now() - new Date(dt).getTime();
    const m = Math.round(ms / 60000);
    if (m < 60) return isRTL ? `من ${m} د` : `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return isRTL ? `من ${h} س` : `${h}h ago`;
    const d = Math.round(h / 24);
    return isRTL ? (d === 1 ? "إمبارح" : `من ${d} يوم`) : `${d}d ago`;
  };

  // Status pill — soft 14% tint, colored dot
  const statusToneMap: Record<string, { bg: string; color: string; label: string; labelAr: string }> = {
    pending:    { bg: "bg-muted",                color: "text-muted-foreground", label: "Pending",    labelAr: "في الانتظار" },
    processing: { bg: "bg-amber-500/14",         color: "text-amber-700 dark:text-amber-400", label: "Processing", labelAr: "بيتجهز" },
    confirmed:  { bg: "bg-teal-500/14",          color: "text-teal-700 dark:text-teal-400", label: "Confirmed", labelAr: "متأكد" },
    shipped:    { bg: "bg-blue-500/14",          color: "text-blue-700 dark:text-blue-400", label: "Shipped",   labelAr: "اتشحن" },
    delivered:  { bg: "bg-emerald-500/14",       color: "text-emerald-700 dark:text-emerald-400", label: "Delivered", labelAr: "اتسلّم" },
    fulfilled:  { bg: "bg-emerald-500/14",       color: "text-emerald-700 dark:text-emerald-400", label: "Fulfilled", labelAr: "اتجهز" },
    cancelled:  { bg: "bg-destructive/14",       color: "text-destructive", label: "Cancelled", labelAr: "ملغي" },
    returned:   { bg: "bg-orange-500/14",        color: "text-orange-700 dark:text-orange-400", label: "Returned",  labelAr: "مرتجع" },
  };

  const StatusPill = ({ status }: { status: string }) => {
    const t = statusToneMap[status] || statusToneMap.pending;
    return (
      <span className={`souq-pill ${t.bg} ${t.color}`}>
        <span className="dot" />
        {isRTL ? t.labelAr : t.label}
      </span>
    );
  };

  // Timeline steps (sage filled for completed; static order)
  const steps = order ? [
    { t: isRTL ? "اتعمل الطلب" : "Order placed", on: true },
    { t: isRTL ? "اتأكد الطلب" : "Order confirmed", on: ["confirmed", "processing", "shipped", "delivered", "fulfilled"].includes(order.status) },
    { t: isRTL ? "بيتجهز" : "Processing", on: ["processing", "shipped", "delivered", "fulfilled"].includes(order.status) },
    { t: isRTL ? "اتشحن" : "Shipped", on: ["shipped", "delivered"].includes(order.status) },
    { t: isRTL ? "اتسلّم" : "Delivered", on: order.status === "delivered" },
  ] : [];

  const customerName = order?.shipping_address?.full_name
    || `${order?.shipping_address?.first_name ?? ""} ${order?.shipping_address?.last_name ?? ""}`.trim()
    || "—";
  const customerPhone = order?.shipping_address?.phone;
  const customerCity = order?.shipping_address?.city;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={isRTL ? "left" : "right"}
        className="w-full sm:max-w-md p-0 flex flex-col gap-0"
      >
        {/* Header — clickable to navigate to full order page */}
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-card">
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl bg-muted/40 hover:bg-muted grid place-items-center shrink-0"
            aria-label={isRTL ? "إغلاق" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goFullPage}
            className="flex-1 min-w-0 text-start hover:opacity-80 transition-opacity"
            title={isRTL ? "فتح صفحة الطلب الكاملة" : "Open full order page"}
          >
            <div className="font-mono font-extrabold text-base tabular-nums truncate">
              {order?.order_number || (isLoading ? "—" : orderId)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {order ? fmtTimeAgo(order.created_at) : isLoading ? (isRTL ? "جاري التحميل…" : "Loading…") : ""}
            </div>
          </button>
          {order && <StatusPill status={order.status} />}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading || !order ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y">
              {/* Customer + quick actions — wrapped so divide-y treats
                  them as one block (no hairline between them). */}
              <div>
              <div className="p-4 flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-navy text-white grid place-items-center text-sm font-extrabold shrink-0">
                  {customerName.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold truncate">{customerName}</div>
                  <div className="text-[11.5px] text-muted-foreground truncate">
                    {customerCity && <span>{customerCity}</span>}
                    {customerCity && customerPhone && <span> · </span>}
                    {customerPhone && (
                      <span className="ltr-nums font-mono">{customerPhone}</span>
                    )}
                  </div>
                </div>
                {customerPhone && (
                  <a
                    href={`https://wa.me/${customerPhone.replace(/[^\d]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 h-9 ps-2.5 pe-3.5 rounded-full bg-[#E3F1E2] text-[#1F7A35] dark:bg-emerald-900/25 dark:text-emerald-300 text-[13px] font-bold hover:bg-[#D1E8D0] transition-colors shrink-0"
                  >
                    <WhatsAppGlyph className="h-[18px] w-[18px]" />
                    {isRTL ? "واتساب" : "WhatsApp"}
                  </a>
                )}
              </div>

              {/* ── Quick actions row ─────────────────────────────────
                  Status advance (saffron primary when applicable),
                  Copy ID, Print, More menu. Mirrors NHUB pattern of
                  immediate at-a-glance actions before scrolling to
                  items/payment. */}
              <div className="px-4 pb-4 -mt-1 flex items-center gap-2 flex-wrap">
                {flowAction && (
                  <Button
                    variant="accent"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => advanceStatus(flowAction.next)}
                  >
                    <flowAction.Icon className="h-4 w-4" strokeWidth={2.4} />
                    {isRTL ? flowAction.labelAr : flowAction.label}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={copyOrderId}
                >
                  <Copy className="h-4 w-4" strokeWidth={2.2} />
                  {isRTL ? "انسخ الرقم" : "Copy ID"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4" strokeWidth={2.2} />
                  {isRTL ? "طباعة" : "Print"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                      <MoreHorizontal className="h-4 w-4" strokeWidth={2.4} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isRTL ? "start" : "end"} className="w-48">
                    <DropdownMenuItem onClick={goFullPage}>
                      <ExternalLink className="h-4 w-4 me-2" strokeWidth={2.2} />
                      {isRTL ? "الصفحة الكاملة" : "Full page"}
                    </DropdownMenuItem>
                    {order?.can_be_cancelled && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => advanceStatus("cancelled")}
                      >
                        <XCircle className="h-4 w-4 me-2" strokeWidth={2.2} />
                        {isRTL ? "إلغاء الطلب" : "Cancel order"}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              </div>

              {/* Items */}
              <div>
                <div className="px-4 pt-4 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {isRTL ? "المنتجات" : "Items"}
                </div>
                {order.line_items.map((item, i) => {
                  const img = productImageFor(i);
                  const isEmoji = !!img && !/^(https?:|\/)/.test(img);
                  const isUrl = !!img && /^(https?:|\/)/.test(img);
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 border-t first:border-t-0">
                      <div className="souq-thumb h-11 w-11 overflow-hidden ring-1 ring-border">
                        {isUrl ? (
                          <img
                            src={img!}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : isEmoji ? (
                          <span className="text-xl leading-none">{img}</span>
                        ) : (
                          <PackageIcon className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-semibold truncate">{item.product_name}</div>
                        {item.variant_name && (
                          <div className="text-[11px] text-muted-foreground/80 truncate">
                            {item.variant_name}
                          </div>
                        )}
                        <div className="text-[11.5px] text-muted-foreground tabular-nums">
                          {isRTL ? item.quantity.toLocaleString("ar-EG") : item.quantity}
                          {" × "}
                          {fmt(item.unit_price)}
                        </div>
                      </div>
                      <div className="text-[13.5px] font-extrabold tabular-nums shrink-0">
                        {fmt(item.total_price)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Payment summary */}
              <div className="p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  {isRTL ? "ملخص الدفع" : "Payment"}
                </div>
                <div className="space-y-1.5 text-[13px]">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{isRTL ? "الإجمالي الفرعي" : "Subtotal"}</span>
                    <span className="tabular-nums">{fmt(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{isRTL ? "الشحن" : "Shipping"}</span>
                    <span className="tabular-nums">{fmt(order.shipping_cost)}</span>
                  </div>
                  {order.discount_amount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{isRTL ? "خصم" : "Discount"}</span>
                      <span className="tabular-nums">−{fmt(order.discount_amount)}</span>
                    </div>
                  )}
                  {order.tax_amount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{isRTL ? "ضريبة" : "Tax"}</span>
                      <span className="tabular-nums">{fmt(order.tax_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 mt-2 border-t font-extrabold text-base">
                    <span>{isRTL ? "الإجمالي" : "Total"}</span>
                    <span className="tabular-nums">{fmt(order.total)}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <span className={`souq-pill ${order.is_paid ? "bg-emerald-500/14 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                    {order.payment_method === "cod" || order.payment_method === "cash_on_delivery"
                      ? <Banknote className="h-4 w-4" strokeWidth={2.2} />
                      : <CreditCard className="h-4 w-4" strokeWidth={2.2} />}
                    {order.payment_method === "cod" || order.payment_method === "cash_on_delivery"
                      ? (isRTL ? "عند الاستلام" : "COD")
                      : order.is_paid
                        ? (isRTL ? "مدفوع" : "Paid")
                        : (isRTL ? "غير مدفوع" : "Unpaid")}
                  </span>
                </div>
              </div>

              {/* Timeline */}
              <div className="p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  {isRTL ? "مسار الطلب" : "Timeline"}
                </div>
                <div className="space-y-0">
                  {steps.map((s, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`h-[18px] w-[18px] rounded-full grid place-items-center ${s.on ? "bg-sage text-white" : "bg-muted"}`}
                        >
                          {s.on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                        </div>
                        {i < steps.length - 1 && (
                          <div className={`w-0.5 h-4 ${s.on ? "bg-sage" : "bg-border"}`} />
                        )}
                      </div>
                      <div
                        className={`text-[13px] pt-0.5 ${s.on ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                      >
                        {s.t}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {order && (
          <div className="flex items-center gap-2 p-3 border-t bg-card">
            <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => window.print()}>
              <Printer className="h-4 w-4" strokeWidth={2.2} />
              {isRTL ? "طباعة" : "Print"}
            </Button>
            <Button variant="accent" size="sm" className="gap-1.5 flex-1" onClick={goFullPage}>
              {isRTL ? "الصفحة الكاملة" : "Open full page"}
              <ExternalLink className="h-4 w-4" strokeWidth={2.2} />
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default OrderDrawer;
