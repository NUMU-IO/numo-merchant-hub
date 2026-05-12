import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  getOrder,
  markOrderPaid,
  updateOrderStatus,
  type Order,
} from "@/services/orderApi";
import { listOrderRefunds } from "@/services/refundApi";
import { showError } from "@/lib/show-error";
import { OrdersSkeleton } from "@/components/skeletons/OrdersSkeleton";
import { OrderHeader } from "@/components/orders/OrderHeader";
import { OrderLineItemsCard } from "@/components/orders/OrderLineItemsCard";
import { PaymentSummaryCard } from "@/components/orders/PaymentSummaryCard";
import { FulfillmentCard } from "@/components/orders/FulfillmentCard";
import { RefundsCard } from "@/components/orders/RefundsCard";
import { CustomerPanel } from "@/components/orders/CustomerPanel";
import { ShippingAddressCard } from "@/components/orders/ShippingAddressCard";
import { NotesCard } from "@/components/orders/NotesCard";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { formatOrderCurrency } from "@/components/orders/_shared";

/**
 * Order detail page — Shopify-style layout.
 *
 * Replaces the old in-place modal at Orders.tsx:491-905. Each section is a
 * standalone component under @/components/orders/ to keep this page short and
 * testable. The list page (Orders.tsx) now navigates to `/orders/:orderId`
 * behind the `ff_order_detail_v2` feature flag.
 */
const OrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const orderQuery = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrder(storeId!, orderId!),
    enabled: !!storeId && !!orderId,
  });

  const refundsQuery = useQuery({
    queryKey: ["order-refunds", storeId, orderId],
    queryFn: () => listOrderRefunds(storeId!, orderId!),
    enabled: !!storeId && !!orderId,
  });

  const order = orderQuery.data;
  const refunds = refundsQuery.data?.items ?? [];

  const invalidateOrder = () => {
    queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    queryClient.invalidateQueries({ queryKey: ["order-timeline", storeId, orderId] });
    queryClient.invalidateQueries({ queryKey: ["order-activities", storeId, orderId] });
    queryClient.invalidateQueries({ queryKey: ["orders", storeId] });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      updateOrderStatus(storeId!, orderId!, status),
    onSuccess: () => {
      toast.success(
        language === "ar" ? "تم تحديث حالة الطلب" : "Order status updated",
      );
      invalidateOrder();
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "";
      const isTransition =
        msg.toLowerCase().includes("cannot") ||
        (err instanceof Object &&
          "status" in err &&
          (err as Record<string, unknown>).status === 422);
      if (isTransition) {
        toast.error(
          language === "ar"
            ? "لا يمكن تغيير الحالة مباشرة. يرجى اتباع الترتيب: معلق ← قيد المعالجة ← تم الشحن ← تم التسليم"
            : "Can't skip steps. Follow the order: Pending → Processing → Shipped → Delivered",
        );
      } else {
        showError(err, language);
      }
    },
  });

  const markPaid = useMutation({
    mutationFn: () => markOrderPaid(storeId!, orderId!),
    onSuccess: () => {
      toast.success(
        language === "ar" ? "تم تأكيد الدفع" : "Payment confirmed",
      );
      invalidateOrder();
    },
    onError: (err) => showError(err, language),
  });

  // RTO confirmation dialog (same pattern as Orders.tsx — destructive +
  // sends a cross-merchant network signal, so gated behind a styled dialog
  // rather than window.confirm).
  const [rtoOpen, setRtoOpen] = useState(false);
  const [rtoSubmitting, setRtoSubmitting] = useState(false);

  const handleRtoConfirm = async () => {
    setRtoSubmitting(true);
    try {
      await updateStatus.mutateAsync("returned");
      setRtoOpen(false);
    } finally {
      setRtoSubmitting(false);
    }
  };

  const handlePrint = (o: Order) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<html><head><title>${o.order_number}</title><style>body{font-family:system-ui;padding:24px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #ddd;text-align:left}</style></head><body>`,
    );
    w.document.write(`<h1>Order ${o.order_number}</h1>`);
    w.document.write(
      `<p>Address: ${o.shipping_address.address_line1}, ${o.shipping_address.city}</p>`,
    );
    w.document.write(
      `<table><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr>`,
    );
    o.line_items.forEach((item) => {
      w.document.write(
        `<tr><td>${item.product_name}</td><td>${item.quantity}</td><td>${formatOrderCurrency(item.unit_price, language)}</td><td>${formatOrderCurrency(item.total_price, language)}</td></tr>`,
      );
    });
    w.document.write(
      `</table><p><strong>Total: ${formatOrderCurrency(o.total, language)}</strong></p></body></html>`,
    );
    w.document.close();
    w.print();
  };

  if (orderQuery.isLoading) {
    return <OrdersSkeleton />;
  }

  if (orderQuery.isError || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-muted-foreground">
          {language === "ar" ? "تعذر تحميل الطلب" : "Couldn't load this order"}
        </p>
        <Button variant="outline" onClick={() => navigate("/orders")}>
          {t("orders.back")}
        </Button>
      </div>
    );
  }

  if (!storeId) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <OrderHeader
        order={order}
        onAdvanceStatus={(next) => updateStatus.mutate(next)}
        onMarkReturned={() => setRtoOpen(true)}
        onPrint={() => handlePrint(order)}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <OrderLineItemsCard order={order} />
          <PaymentSummaryCard
            order={order}
            refunds={refunds}
            onMarkPaid={() => markPaid.mutate()}
          />
          <FulfillmentCard
            storeId={storeId}
            order={order}
            onUpdateStatus={(next) => updateStatus.mutate(next)}
          />
          <RefundsCard storeId={storeId} order={order} refunds={refunds} />
          <OrderTimeline storeId={storeId} orderId={order.id} />
        </div>

        <div className="space-y-4">
          <CustomerPanel storeId={storeId} order={order} />
          <ShippingAddressCard order={order} />
          <NotesCard storeId={storeId} order={order} />
        </div>
      </div>

      <AlertDialog
        open={rtoOpen}
        onOpenChange={(open) => {
          if (!open && !rtoSubmitting) setRtoOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "ar" ? "تحديد كمرتجع" : "Mark as returned"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ar"
                ? "سيتم تحديد الطلب كمرتجع وإرسال إشارة RTO إلى شبكة نمو. لا يمكن التراجع عن هذا الإجراء."
                : "This will mark the order as returned and send an RTO signal to شبكة نمو. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rtoSubmitting}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRtoConfirm();
              }}
              disabled={rtoSubmitting}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {rtoSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              {language === "ar" ? "تأكيد المرتجع" : "Confirm RTO"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrderDetail;
