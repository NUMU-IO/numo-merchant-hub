import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  listOrders, getOrder, updateOrderStatus as apiUpdateStatus,
  bulkUpdateStatus, getOrderTimeline, markOrderPaid, updateOrder,
  type OrderListItem, type Order as ApiOrder, type TimelineEvent,
} from "@/services/orderApi";
import {
  createRefund, listOrderRefunds, approveRefund, rejectRefund, processRefund,
  type RefundListItem, type RefundReason, type CreateRefundRequest,
} from "@/services/refundApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, CheckCircle2, Circle, Clock, Package, Truck, XCircle,
  MoreHorizontal, Printer, FileDown, FileUp, ChevronRight, ArrowRightCircle, Loader2,
  RotateCcw, AlertCircle, FileText, ArrowUpDown, ListFilter, LayoutList, Search,
  RefreshCw,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { downloadInvoicePdf, getInvoiceForOrder } from "@/services/invoiceApi";
import { showError } from "@/lib/show-error";
import { OrdersSkeleton } from "@/components/skeletons/OrdersSkeleton";
import InstapayProofReview from "@/components/payments/InstapayProofReview";
import { fetchPendingInstapayOrders } from "@/services/storeApi";
import {
  DateRangePicker, useDateRangeUrlState,
} from "@/components/filters/DateRangePicker";
import OrderDrawer from "@/components/orders/OrderDrawer";

type FulfillmentStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
const WORKFLOW: FulfillmentStatus[] = ["pending", "processing", "shipped", "delivered"];

const Orders = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  // Initial status filter respects `?status=...` so links from the
  // dashboard attention card (e.g. "/orders?status=pending") land on
  // the right filtered view instead of dropping the merchant on "all".
  const initialStatus = (() => {
    const s = new URLSearchParams(window.location.search).get("status");
    const valid = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;
    return s && (valid as readonly string[]).includes(s) ? (s as FulfillmentStatus) : "all";
  })();
  const [statusFilter, setStatusFilter] = useState<"all" | FulfillmentStatus>(initialStatus);
  // Secondary view: InstaPay orders with an awaiting-review proof. Mutually
  // exclusive with statusFilter — clicking this chip clears statusFilter.
  const [pendingInstapay, setPendingInstapay] = useState(false);

  // Shopify-style date range. URL-synced, shared with any other page
  // mounted on the same route segment.
  const { range, setRange } = useDateRangeUrlState();
  const dateFrom = range.start.toISOString();
  const dateTo = range.end.toISOString();

  const [selectedOrderDetail, setSelectedOrderDetail] = useState<ApiOrder | null>(null);
  const [orderTimeline, setOrderTimeline] = useState<TimelineEvent[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Refund state
  const [orderRefunds, setOrderRefunds] = useState<RefundListItem[]>([]);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [refundReason, setRefundReason] = useState<RefundReason>("customer_request");
  const [refundNote, setRefundNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);

  // Tracking
  const [trackingInput, setTrackingInput] = useState("");
  const [savingTracking, setSavingTracking] = useState(false);

  // React Query hook for orders list
  const ordersQuery = useQuery({
    queryKey: ["orders", storeId, page, statusFilter, dateFrom, dateTo],
    queryFn: () => {
      const params: Record<string, string | number | boolean> = {
        page,
        limit: 20,
        date_from: dateFrom,
        date_to: dateTo,
      };
      if (statusFilter !== "all") params.status = statusFilter;
      return listOrders(storeId!, params);
    },
    enabled: !!storeId && !pendingInstapay,
    placeholderData: keepPreviousData,
  });

  // Lightweight badge query — always runs at page=1&limit=1 just to pull
  // the total count for the "Pending verification" chip so merchants can
  // see the queue size without clicking in.
  const pendingInstapayBadgeQuery = useQuery({
    queryKey: ["instapay-pending-count", storeId],
    queryFn: () => fetchPendingInstapayOrders(storeId!, { page: 1, limit: 1 }),
    enabled: !!storeId,
    refetchInterval: 60_000,
  });
  const pendingInstapayCount = pendingInstapayBadgeQuery.data?.total ?? 0;

  // Actual page fetch when the chip is active.
  const pendingInstapayQuery = useQuery({
    queryKey: ["instapay-pending-orders", storeId, page],
    queryFn: () => fetchPendingInstapayOrders(storeId!, { page, limit: 20 }),
    enabled: !!storeId && pendingInstapay,
    placeholderData: keepPreviousData,
  });

  // Map pending items into the shape the orders table renders. Pending
  // rows are always payment_method=instapay & payment_status=pending so
  // the existing InstapayProofReview block fires automatically.
  const pendingAsOrders: ApiOrder[] = (pendingInstapayQuery.data?.items ?? []).map(
    (p) =>
      ({
        id: p.order_id,
        order_number: p.order_number,
        customer_id: p.customer_id,
        total: p.amount_cents,
        currency: p.currency,
        status: "pending",
        payment_status: "pending",
        payment_method: "instapay",
        fulfillment_status: "unfulfilled",
        created_at: p.created_at,
      }) as unknown as ApiOrder,
  );

  const orders = pendingInstapay
    ? pendingAsOrders
    : (ordersQuery.data?.items ?? []);
  const totalOrders = pendingInstapay
    ? pendingInstapayQuery.data?.total ?? 0
    : ordersQuery.data?.total ?? 0;

  const formatCurrency = (cents: number) => {
    const val = cents / 100;
    return language === "ar" ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;
  };

  const invalidateOrders = () => {
    queryClient.invalidateQueries({ queryKey: ["orders", storeId] });
    // Bust analytics so Top Products / Customer Stats / Sales Chart
    // reflect the newly created or status-changed order without waiting
    // for the next nightly rollup.
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  // Souq drawer-first flow: clicking a row opens the side OrderDrawer
  // (quick summary + items + payment + timeline). The drawer header
  // and footer both link through to the full /orders/:id page for
  // edit-grade work. Holding ⌘/Ctrl on click bypasses the drawer
  // (power-user shortcut to jump straight to the full page).
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const openOrderDetail = (
    orderId: string,
    e?: React.MouseEvent<HTMLElement>,
  ) => {
    if (!storeId) return;
    if (e && (e.metaKey || e.ctrlKey)) {
      navigate(`/orders/${orderId}`);
      return;
    }
    setDrawerOrderId(orderId);
  };

  const statusColor: Record<string, string> = {
    delivered: "bg-primary/10 text-primary",
    fulfilled: "bg-primary/10 text-primary",
    shipped: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    processing: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    pending: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive",
    // Distinct from cancelled: order was shipped but customer refused.
    // Orange to distinguish from cancelled red and shipped blue.
    returned: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  };

  const paymentColor: Record<string, string> = {
    paid: "bg-primary/10 text-primary",
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    unpaid: "bg-destructive/10 text-destructive",
    cod: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    refunded: "bg-blue-500/10 text-blue-600",
    partially_refunded: "bg-blue-500/10 text-blue-600",
  };

  const refundStatusColor: Record<string, string> = {
    requested: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    approved: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    processing: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    processed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    completed: "bg-primary/10 text-primary",
    rejected: "bg-destructive/10 text-destructive",
    failed: "bg-destructive/10 text-destructive",
  };

  const timelineIcons: Record<string, React.ReactNode> = {
    pending: <Circle className="h-4 w-4" />,
    processing: <Clock className="h-4 w-4" />,
    shipped: <Truck className="h-4 w-4" />,
    delivered: <CheckCircle2 className="h-4 w-4" />,
    fulfilled: <CheckCircle2 className="h-4 w-4" />,
    cancelled: <XCircle className="h-4 w-4" />,
    returned: <RotateCcw className="h-4 w-4" />,
    paid: <CheckCircle2 className="h-4 w-4" />,
    refunded: <XCircle className="h-4 w-4" />,
  };

  const getNextStatus = (current: string): FulfillmentStatus | null => {
    const idx = WORKFLOW.indexOf(current as FulfillmentStatus);
    return idx >= 0 && idx < WORKFLOW.length - 1 ? WORKFLOW[idx + 1] : null;
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    if (!storeId) return;
    try {
      const updated = await apiUpdateStatus(storeId, orderId, newStatus);
      toast.success(language === "ar" ? "تم تحديث حالة الطلب" : "Order status updated");
      if (selectedOrderDetail?.id === orderId) {
        setSelectedOrderDetail(updated);
        const tl = await getOrderTimeline(storeId, orderId).catch(() => ({ events: [] as TimelineEvent[], order_id: "", order_number: "" }));
        setOrderTimeline(tl.events || []);
      }
      invalidateOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      const isTransition = msg.toLowerCase().includes("cannot") || (err instanceof Object && 'status' in err && (err as Record<string, unknown>).status === 422);
      if (isTransition) {
        toast.error(
          language === "ar"
            ? "لا يمكن تغيير الحالة مباشرة. يرجى اتباع الترتيب: معلق ← قيد المعالجة ← تم الشحن ← تم التسليم"
            : "Can't skip steps. Follow the order: Pending → Processing → Shipped → Delivered"
        );
      } else {
        showError(err, language);
      }
    }
  };

  const handleMarkPaid = async (orderId: string) => {
    if (!storeId) return;
    try {
      const updated = await markOrderPaid(storeId, orderId);
      toast.success(language === "ar" ? "تم تأكيد الدفع" : "Payment confirmed");
      if (selectedOrderDetail?.id === orderId) {
        setSelectedOrderDetail(updated);
        const tl = await getOrderTimeline(storeId, orderId).catch(() => ({ events: [] as TimelineEvent[], order_id: "", order_number: "" }));
        setOrderTimeline(tl.events || []);
      }
      invalidateOrders();
    } catch (err: unknown) {
      showError(err, language);
    }
  };

  const loadRefunds = async (orderId: string) => {
    if (!storeId) return;
    try {
      const refunds = await listOrderRefunds(storeId, orderId);
      setOrderRefunds(refunds.items || []);
    } catch {
      // ignore
    }
  };

  const handleCreateRefund = async () => {
    if (!storeId || !selectedOrderDetail) return;
    setRefundLoading(true);
    try {
      const data: CreateRefundRequest = {
        refund_type: refundType,
        reason: refundReason,
        reason_note: refundNote || undefined,
        amount: refundType === "partial" ? Math.round(Number(refundAmount) * 100) : undefined,
      };
      await createRefund(storeId, selectedOrderDetail.id, data);
      toast.success(language === "ar" ? "تم إنشاء طلب الاسترداد" : "Refund request created");
      setShowRefundForm(false);
      setRefundNote("");
      setRefundAmount("");
      await loadRefunds(selectedOrderDetail.id);
    } catch (err: unknown) {
      showError(err, language);
    } finally {
      setRefundLoading(false);
    }
  };

  const handleApproveRefund = async (refundId: string) => {
    if (!storeId || !selectedOrderDetail) return;
    try {
      await approveRefund(storeId, selectedOrderDetail.id, refundId);
      toast.success(language === "ar" ? "تمت الموافقة على الاسترداد" : "Refund approved");
      await loadRefunds(selectedOrderDetail.id);
    } catch (err: unknown) {
      showError(err, language);
    }
  };

  const handleRejectRefund = async (refundId: string) => {
    if (!storeId || !selectedOrderDetail) return;
    try {
      await rejectRefund(storeId, selectedOrderDetail.id, refundId);
      toast.success(language === "ar" ? "تم رفض الاسترداد" : "Refund rejected");
      await loadRefunds(selectedOrderDetail.id);
    } catch (err: unknown) {
      showError(err, language);
    }
  };

  const handleProcessRefund = async (refundId: string) => {
    if (!storeId || !selectedOrderDetail) return;
    try {
      const result = await processRefund(storeId, selectedOrderDetail.id, refundId);
      if (result.status === "completed") {
        toast.success(language === "ar" ? "تم معالجة الاسترداد بنجاح" : "Refund processed successfully");
      } else if (result.status === "failed") {
        toast.error(language === "ar" ? "فشلت معالجة الاسترداد" : `Refund failed: ${result.failure_reason || "Unknown error"}`);
      }
      await loadRefunds(selectedOrderDetail.id);
      // Refresh the order to pick up payment_status changes
      const updated = await getOrder(storeId, selectedOrderDetail.id);
      setSelectedOrderDetail(updated);
      invalidateOrders();
    } catch (err: unknown) {
      showError(err, language);
    }
  };

  const handleBulkStatus = async (newStatus: string) => {
    if (!storeId || selected.size === 0) return;
    try {
      const result = await bulkUpdateStatus(storeId, Array.from(selected), newStatus);
      toast.success(
        language === "ar"
          ? `تم تحديث ${result.updated} طلب`
          : `Updated ${result.updated} orders`
      );
      if (result.failed > 0) {
        toast.error(
          language === "ar"
            ? `فشل تحديث ${result.failed} طلب`
            : `Failed to update ${result.failed} orders`
        );
      }
      setSelected(new Set());
      invalidateOrders();
    } catch (err: unknown) {
      showError(err, language);
    }
  };

  // RTO is destructive + sends a cross-merchant network signal, so we
  // gate it behind a styled AlertDialog rather than the browser's
  // native confirm — the latter is jarring (different chrome, ignores
  // the app's RTL/typography) and also blocked by some ad-blockers.
  // The intent encodes which flow opened the dialog so a single
  // dialog instance covers both single + bulk.
  const [rtoIntent, setRtoIntent] = useState<
    | { kind: "single"; orderId: string }
    | { kind: "bulk"; count: number }
    | null
  >(null);
  const [rtoSubmitting, setRtoSubmitting] = useState(false);

  const handleMarkReturned = (orderId: string) => {
    if (!storeId) return;
    setRtoIntent({ kind: "single", orderId });
  };

  const handleBulkMarkReturned = () => {
    if (!storeId || selected.size === 0) return;
    setRtoIntent({ kind: "bulk", count: selected.size });
  };

  const handleRtoConfirm = async () => {
    if (!rtoIntent) return;
    setRtoSubmitting(true);
    try {
      if (rtoIntent.kind === "single") {
        await handleUpdateStatus(rtoIntent.orderId, "returned");
      } else {
        await handleBulkStatus("returned");
      }
      setRtoIntent(null);
    } finally {
      setRtoSubmitting(false);
    }
  };

  // Rendered identically in both the list-view and order-detail-view
  // returns. The detail view returns early before the list-view JSX,
  // so a single dialog at the end of the file would never mount when
  // a merchant clicks "Mark as Returned" from the detail screen — the
  // button at o.status === "shipped" is on that branch.
  const isAr_ = language === "ar";
  const rtoDialog = (
    <AlertDialog
      open={rtoIntent !== null}
      onOpenChange={(open) => {
        if (!open && !rtoSubmitting) setRtoIntent(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isAr_ ? "تحديد كمرتجع" : "Mark as returned"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {rtoIntent?.kind === "bulk"
              ? isAr_
                ? `سيتم تحديد ${rtoIntent.count} طلب كمرتجع وإرسال إشارة RTO إلى شبكة نمو. لا يمكن التراجع عن هذا الإجراء.`
                : `This will mark ${rtoIntent.count} order(s) as returned and send an RTO signal to شبكة نمو. This cannot be undone.`
              : isAr_
                ? "سيتم تحديد الطلب كمرتجع وإرسال إشارة RTO إلى شبكة نمو. لا يمكن التراجع عن هذا الإجراء."
                : "This will mark the order as returned and send an RTO signal to شبكة نمو. This cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={rtoSubmitting}>
            {isAr_ ? "إلغاء" : "Cancel"}
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
            {isAr_ ? "تأكيد المرتجع" : "Confirm RTO"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });
  };

  const handlePrint = (o: ApiOrder) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>${o.order_number}</title><style>body{font-family:system-ui;padding:24px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #ddd;text-align:left}</style></head><body>`);
    w.document.write(`<h1>Order ${o.order_number}</h1>`);
    w.document.write(`<p>Address: ${o.shipping_address.address_line1}, ${o.shipping_address.city}</p>`);
    w.document.write(`<table><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr>`);
    o.line_items.forEach(item => {
      w.document.write(`<tr><td>${item.product_name}</td><td>${item.quantity}</td><td>${formatCurrency(item.unit_price)}</td><td>${formatCurrency(item.total_price)}</td></tr>`);
    });
    w.document.write(`</table><p><strong>Total: ${formatCurrency(o.total)}</strong></p></body></html>`);
    w.document.close();
    w.print();
  };

  const handleExportCSV = () => {
    const rows = [["Order #", "Customer", "Date", "Total", "Payment", "Status"]];
    const data = selected.size > 0 ? orders.filter(o => selected.has(o.id)) : orders;
    data.forEach(o => {
      rows.push([o.order_number, o.customer_name || "", o.created_at?.split("T")[0] || "", String(o.total / 100), o.payment_status, o.status]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "orders.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success(language === "ar" ? "تم تصدير الطلبات!" : "Orders exported!");
  };

  // === Loading state ===
  if (ordersQuery.isLoading && orders.length === 0) {
    return <OrdersSkeleton />;
  }

  // === Order Detail View ===
  if (selectedOrderDetail) {
    const o = selectedOrderDetail;
    const nextStatus = getNextStatus(o.status);

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-center justify-between">
          <Button variant="ghost" className="gap-2" onClick={() => setSelectedOrderDetail(null)}>
            <ArrowLeft className="h-4 w-4" />
            {t("orders.back")}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handlePrint(o)}>
              <Printer className="h-3.5 w-3.5" />
              {t("orders.print")}
            </Button>
            {nextStatus && o.status !== "cancelled" && (
              <Button size="sm" className="gap-1.5" onClick={() => handleUpdateStatus(o.id, nextStatus)}>
                <ArrowRightCircle className="h-3.5 w-3.5" />
                {t("orders.moveTo")} {t(`orders.${nextStatus}`)}
              </Button>
            )}
            {/* Manual-ship merchants record an RTO outcome. Shipped is the
                only state where a return is meaningful — earlier states
                use Cancel; later states are terminal. */}
            {o.status === "shipped" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => handleMarkReturned(o.id)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {language === "ar" ? "تحديد كمرتجع" : "Mark as Returned"}
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{t("orders.orderDetails")} {o.order_number}</h1>
          <Badge variant="secondary" className={statusColor[o.status] || ""}>
            {t(`orders.${o.status}`)}
          </Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Line Items */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("orders.lineItems")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("products.name")}</TableHead>
                    <TableHead>{t("orders.qty")}</TableHead>
                    <TableHead>{t("products.price")}</TableHead>
                    <TableHead>{t("orders.total")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {o.line_items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(item.total_price)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 space-y-1 text-sm border-t pt-3">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("orders.subtotal")}</span><span>{formatCurrency(o.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("orders.shipping")}</span><span>{formatCurrency(o.shipping_cost)}</span></div>
                {o.discount_amount > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">{language === "ar" ? "الخصم" : "Discount"}</span><span className="text-primary">-{formatCurrency(o.discount_amount)}</span></div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>{t("orders.total")}</span><span>{formatCurrency(o.total)}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("orders.shippingAddress")}</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="font-medium">{o.shipping_address.full_name}</p>
                <p className="text-muted-foreground">{o.shipping_address.address_line1}</p>
                {o.shipping_address.address_line2 && <p className="text-muted-foreground">{o.shipping_address.address_line2}</p>}
                <p className="text-muted-foreground">{o.shipping_address.city}{o.shipping_address.state ? `, ${o.shipping_address.state}` : ""}</p>
                {o.shipping_address.phone && <p className="text-muted-foreground">{o.shipping_address.phone}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("orders.paymentInfo")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Badge variant="secondary" className={paymentColor[o.payment_status] || ""}>
                  {t(`orders.${o.payment_status}`)}
                </Badge>
                {o.payment_method && <p className="text-sm text-muted-foreground">{o.payment_method}</p>}
                {o.payment_status !== "paid" && (
                  <Button size="sm" variant="outline" className="w-full mt-2 gap-1.5" onClick={() => handleMarkPaid(o.id)}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {language === "ar" ? "تأكيد الدفع" : "Mark as Paid"}
                  </Button>
                )}
                {o.payment_status === "paid" && currentStore?.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-2 gap-1.5"
                    onClick={async () => {
                      try {
                        // Get-or-create: backend lazily issues the invoice
                        // when the order is paid but the on-paid handler
                        // hasn't completed yet.
                        const invoice = await getInvoiceForOrder(currentStore.id, o.id);
                        await downloadInvoicePdf(currentStore.id, invoice.id);
                      } catch (err: unknown) {
                        const e = err as { status?: number };
                        if (e?.status === 409) {
                          toast.error(language === "ar"
                            ? "ضع علامة على الطلب كمدفوع أولاً لإنشاء الفاتورة"
                            : "Mark the order as paid first to generate the invoice");
                        } else {
                          toast.error(language === "ar" ? "فشل تحميل الفاتورة" : "Failed to download invoice");
                        }
                      }
                    }}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {language === "ar" ? "تحميل الفاتورة" : "Download Invoice"}
                  </Button>
                )}
                {o.payment_method === "instapay" && currentStore?.id && (
                  <div className="mt-3">
                    <InstapayProofReview
                      storeId={currentStore.id}
                      orderId={o.id}
                      isAr={language === "ar"}
                      onPaid={() => {
                        queryClient.invalidateQueries({ queryKey: ["orders"] });
                        queryClient.invalidateQueries({ queryKey: ["analytics"] });
                        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shipping & Tracking */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{language === "ar" ? "الشحن والتتبع" : "Shipping & Tracking"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {o.shipping_method && (
                  <p className="text-sm text-muted-foreground">{o.shipping_method}</p>
                )}
                {o.tracking_number ? (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      {language === "ar" ? "رقم التتبع" : "Tracking Number"}
                    </p>
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/40">
                      <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-mono font-medium flex-1">{o.tracking_number}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => {
                          navigator.clipboard.writeText(o.tracking_number!);
                          toast.success(language === "ar" ? "تم النسخ" : "Copied");
                        }}
                      >
                        {language === "ar" ? "نسخ" : "Copy"}
                      </Button>
                    </div>
                    {o.tracking_url && (
                      <a href={o.tracking_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        {language === "ar" ? "تتبع الشحنة ←" : "Track shipment →"}
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      {language === "ar" ? "إضافة رقم تتبع" : "Add Tracking Number"}
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={trackingInput}
                        onChange={(e) => setTrackingInput(e.target.value)}
                        placeholder={language === "ar" ? "مثلاً: EG123456789" : "e.g. EG123456789"}
                        className="h-9 text-sm rounded-lg flex-1"
                      />
                      <Button
                        size="sm"
                        className="h-9 rounded-lg gap-1.5"
                        disabled={!trackingInput.trim() || savingTracking}
                        onClick={async () => {
                          if (!storeId || !trackingInput.trim()) return;
                          setSavingTracking(true);
                          try {
                            const updated = await updateOrder(storeId, o.id, {
                              tracking_number: trackingInput.trim(),
                            });
                            setSelectedOrderDetail(updated);
                            setTrackingInput("");
                            toast.success(language === "ar" ? "تم حفظ رقم التتبع" : "Tracking number saved");
                          } catch (err) {
                            showError(err, language);
                          } finally {
                            setSavingTracking(false);
                          }
                        }}
                      >
                        {savingTracking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                        {language === "ar" ? "حفظ" : "Save"}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {language === "ar" ? "أضف رقم التتبع قبل تحديث الحالة لشحن" : "Add tracking before marking as shipped"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Refunds Section */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    {t("refunds.title")}
                  </CardTitle>
                  {o.is_paid && !showRefundForm && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowRefundForm(true)}>
                      {t("refunds.requestRefund")}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Create Refund Form */}
                {showRefundForm && (
                  <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">{t("refunds.type")}</label>
                      <Select value={refundType} onValueChange={(v) => setRefundType(v as "full" | "partial")}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">{t("refunds.full")}</SelectItem>
                          <SelectItem value="partial">{t("refunds.partial")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {refundType === "partial" && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium">{t("refunds.amount")}</label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder={language === "ar" ? "المبلغ" : "Amount"}
                          value={refundAmount}
                          onChange={(e) => setRefundAmount(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-xs font-medium">{t("refunds.reason")}</label>
                      <Select value={refundReason} onValueChange={(v) => setRefundReason(v as RefundReason)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="customer_request">{t("refunds.reasons.customer_request")}</SelectItem>
                          <SelectItem value="defective">{t("refunds.reasons.defective")}</SelectItem>
                          <SelectItem value="wrong_item">{t("refunds.reasons.wrong_item")}</SelectItem>
                          <SelectItem value="not_as_described">{t("refunds.reasons.not_as_described")}</SelectItem>
                          <SelectItem value="duplicate_order">{t("refunds.reasons.duplicate_order")}</SelectItem>
                          <SelectItem value="other">{t("refunds.reasons.other")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">{t("refunds.note")}</label>
                      <Textarea
                        placeholder={language === "ar" ? "ملاحظات إضافية..." : "Additional notes..."}
                        value={refundNote}
                        onChange={(e) => setRefundNote(e.target.value)}
                        className="text-xs min-h-[60px]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleCreateRefund} disabled={refundLoading}>
                        {refundLoading && <Loader2 className="h-3 w-3 animate-spin me-1" />}
                        {t("refunds.submit")}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowRefundForm(false)}>
                        {language === "ar" ? "إلغاء" : "Cancel"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Refund List */}
                {orderRefunds.length > 0 ? (
                  <div className="space-y-2">
                    {orderRefunds.map((r) => (
                      <div key={r.id} className="p-2.5 rounded-lg border text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{r.refund_number}</span>
                          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${refundStatusColor[r.status] || ""}`}>
                            {t(`refunds.statuses.${r.status}`)}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>{r.refund_type === "full" ? t("refunds.full") : t("refunds.partial")}</span>
                          <span className="font-medium text-foreground">{formatCurrency(r.amount)}</span>
                        </div>
                        <div className="text-muted-foreground">
                          {t(`refunds.reasons.${r.reason}`)}
                        </div>
                        {/* Action buttons based on status */}
                        {r.status === "requested" && (
                          <div className="flex gap-1.5 pt-1">
                            <Button size="sm" className="h-6 text-[10px] flex-1" onClick={() => handleApproveRefund(r.id)}>
                              {t("refunds.approve")}
                            </Button>
                            <Button size="sm" variant="destructive" className="h-6 text-[10px] flex-1" onClick={() => handleRejectRefund(r.id)}>
                              {t("refunds.reject")}
                            </Button>
                          </div>
                        )}
                        {r.status === "approved" && (
                          <Button size="sm" className="h-6 text-[10px] w-full" onClick={() => handleProcessRefund(r.id)}>
                            <RotateCcw className="h-3 w-3 me-1" />
                            {t("refunds.process")}
                          </Button>
                        )}
                        {r.status === "failed" && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px] w-full" onClick={() => handleProcessRefund(r.id)}>
                            <AlertCircle className="h-3 w-3 me-1" />
                            {t("refunds.retry")}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  !showRefundForm && (
                    <p className="text-xs text-muted-foreground">{t("refunds.noRefunds")}</p>
                  )
                )}
              </CardContent>
            </Card>

            {o.customer_notes && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">{language === "ar" ? "ملاحظات العميل" : "Customer Notes"}</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">{o.customer_notes}</p></CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("orders.updateStatus")}</CardTitle></CardHeader>
              <CardContent>
                <Select
                  value={o.status}
                  onValueChange={(v) => handleUpdateStatus(o.id, v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["pending", "processing", "shipped", "delivered", "cancelled"] as const).map(s => (
                      <SelectItem key={s} value={s}>{t(`orders.${s}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("orders.timeline")}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {orderTimeline.map((ev, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-0.5 text-muted-foreground">
                        {timelineIcons[ev.status] || <Circle className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{ev.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(ev.timestamp).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US")}
                        </p>
                      </div>
                    </div>
                  ))}
                  {orderTimeline.length === 0 && (
                    <p className="text-sm text-muted-foreground">{language === "ar" ? "لا توجد أحداث بعد" : "No events yet"}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        {rtoDialog}
      </div>
    );
  }

  // === Loading detail overlay ===
  if (detailLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // === List View — Zid-style ===
  const isAr = language === "ar";
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric" });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString(isAr ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-4">
      {/* Souq page head — display title + subtitle */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{isAr ? "قائمة الطلبات" : "Orders"}</h1>
          <p className="text-sm text-muted-foreground mt-1">{isAr ? "تابع طلباتك وجهّزها" : "Track and fulfill your orders"}</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}><FileDown className="me-2 h-3.5 w-3.5" />{isAr ? "تصدير الطلبات" : "Export Orders"}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => invalidateOrders()}
            disabled={ordersQuery.isFetching}
            aria-label={isAr ? "تحديث الطلبات" : "Refresh orders"}
            title={isAr ? "تحديث القائمة" : "Refresh list"}
          >
            <RefreshCw className={`h-3 w-3 ${ordersQuery.isFetching ? "animate-spin" : ""}`} />
            {isAr ? "تحديث" : "Refresh"}
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleExportCSV}>
            <FileDown className="h-3 w-3" />{isAr ? "تصدير الطلبات" : "Export"}
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate("/orders/import")}>
            <FileUp className="h-3 w-3" />{isAr ? "استيراد" : "Import"}
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate("/orders/create")}>
            <Package className="h-3 w-3" />{isAr ? "إنشاء" : "Create"}
          </Button>
        </div>
      </div>

      {/* Main card */}
      <div className="rounded-xl border bg-card">
        {/* Status tabs — horizontal scrollable pills */}
        <div className="px-5 pt-4 pb-3 border-b overflow-x-auto">
          <div className="flex gap-1.5 min-w-max">
            {([
              { v: "all", l: isAr ? "الكل" : "All", count: totalOrders },
              { v: "pending", l: isAr ? "جديد" : "New" },
              { v: "processing", l: isAr ? "جاري التجهيز" : "Processing" },
              { v: "shipped", l: isAr ? "جاري التوصيل" : "Shipped" },
              { v: "delivered", l: isAr ? "مُكتمل" : "Delivered" },
              { v: "cancelled", l: isAr ? "مُلغى" : "Cancelled" },
            ] as { v: "all" | FulfillmentStatus; l: string; count?: number }[]).map(f => {
              const active = statusFilter === f.v && !pendingInstapay;
              return (
                <button
                  key={f.v}
                  type="button"
                  data-active={active}
                  onClick={() => { setStatusFilter(f.v); setPendingInstapay(false); setPage(1); setSelected(new Set()); }}
                  className="souq-chip h-9"
                >
                  {f.l}
                  {f.v === "all" && totalOrders > 0 && !pendingInstapay && (
                    <span className={`inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full text-[10px] font-extrabold tabular-nums ms-1 ${active ? "bg-saffron text-navy-900" : "bg-saffron text-navy-900"}`}>
                      {totalOrders > 99 ? "99+" : totalOrders}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Pending InstaPay review — orange badge when queue is non-empty */}
            <button
              type="button"
              onClick={() => {
                setPendingInstapay(true);
                setPage(1);
                setSelected(new Set());
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border whitespace-nowrap cursor-pointer ${
                pendingInstapay
                  ? "border-amber-500/30 bg-amber-600 text-white shadow-sm"
                  : "border-transparent bg-amber-50 text-amber-800 hover:bg-amber-100"
              }`}
            >
              {isAr ? "قيد المراجعة" : "Pending verification"}
              {pendingInstapayCount > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold tabular-nums ms-1.5 ${
                    pendingInstapay ? "bg-white/25 text-white" : "bg-amber-600 text-white"
                  }`}
                >
                  {pendingInstapayCount > 99 ? "99+" : pendingInstapayCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search + Sort + Filter bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b">
          <DateRangePicker
            value={range}
            onChange={(r) => { setRange(r); setPage(1); }}
            size="sm"
            align="start"
            className="h-9"
          />
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg shrink-0"><ArrowUpDown className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg shrink-0"><ListFilter className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg shrink-0"><LayoutList className="h-4 w-4" /></Button>
          <div className="relative flex-1 max-w-sm ms-auto">
            <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input placeholder={isAr ? "بحث" : "Search"} className="pe-9 h-9 rounded-lg bg-muted/40 border-transparent focus:bg-background focus:border-border" />
          </div>
        </div>

        {/* Souq bulk actions bar — navy fill, white text, saffron count.
            Matches NHUB Orders pattern (navy strip with selection chip). */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-5 py-3 bg-navy text-white animate-in fade-in slide-in-from-top-2 duration-200">
            <span className="text-[13px] font-bold">
              <span className="tabular-nums">{selected.size}</span> {isAr ? "متحدد" : "selected"}
            </span>
            <div className="flex items-center gap-2 ms-auto">
              <Select onValueChange={(v) => handleBulkStatus(v)}>
                <SelectTrigger className="w-[150px] h-8 text-xs bg-white/10 border-white/20 text-white hover:bg-white/15"><SelectValue placeholder={t("orders.bulkStatus")} /></SelectTrigger>
                <SelectContent>{(["processing", "shipped", "delivered", "cancelled"] as const).map(s => <SelectItem key={s} value={s}>{t(`orders.${s}`)}</SelectItem>)}</SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/15 shadow-none"
                onClick={handleBulkMarkReturned}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {isAr ? "تحديد كمرتجع" : "Mark Returned"}
              </Button>
              <Button
                variant="accent"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => { handleBulkStatus("processing"); }}
              >
                {isAr ? "تجهيز" : "Fulfill"}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs text-white hover:bg-white/10 hover:text-white" onClick={() => setSelected(new Set())}>{isAr ? "إلغاء" : "Clear"}</Button>
            </div>
          </div>
        )}

        {/* Table */}
        {orders.length === 0 && !ordersQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-muted-foreground/20">
                <rect x="8" y="6" width="32" height="36" rx="4" stroke="currentColor" strokeWidth="2" />
                <path d="M16 16h16M16 22h10M16 28h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="36" cy="36" r="8" fill="hsl(var(--background))" stroke="currentColor" strokeWidth="2" />
                <path d="M34 36h4M36 34v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-base font-semibold text-muted-foreground mb-1">{isAr ? "طلباتك ستظهر هنا" : "Your orders will appear here"}</p>
            <p className="text-xs text-muted-foreground/60 max-w-sm mb-5">
              {isAr ? "ألقِ نظرة سريعة على كل طلب - من اشترى؟ وكم مرة؟ وما الذي يفضله عملائك؟" : "Quick overview of each order — who bought, how much, and what your customers prefer"}
            </p>
            <div className="flex items-center gap-3">
              <Button size="sm" className="h-9 text-xs rounded-lg gap-1.5 px-4">
                <Package className="h-3.5 w-3.5" />{isAr ? "إنشاء طلبك الأول الآن" : "Create your first order"}
              </Button>
              <Button variant="outline" size="sm" className="h-9 text-xs rounded-lg gap-1.5 px-4">
                {isAr ? "كيف تحصل على أول 10 عملاء 🚀" : "How to get your first 10 customers 🚀"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile card list (< md) */}
            <div className="md:hidden divide-y">
              {orders.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-2 bg-muted/10">
                  <Checkbox
                    checked={orders.length > 0 && selected.size === orders.length}
                    onCheckedChange={() => { if (selected.size === orders.length) setSelected(new Set()); else setSelected(new Set(orders.map(o => o.id))); }}
                  />
                  <span className="text-[11px] text-muted-foreground">{isAr ? "تحديد الكل" : "Select all"}</span>
                </div>
              )}
              {orders.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={(e) => openOrderDetail(o.id, e)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-start hover:bg-muted/20 transition-colors"
                >
                  <div onClick={e => { e.stopPropagation(); }} className="pt-0.5">
                    <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggleSelect(o.id)} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold truncate">{o.order_number}</span>
                      <span className="text-xs font-semibold tabular-nums shrink-0">{formatCurrency(o.total)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="truncate">{o.customer_name || "—"}</span>
                      <span className="shrink-0">{fmtDate(o.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] font-medium rounded-md py-0.5 gap-1 ${
                        o.status === "delivered" || o.status === "fulfilled" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50" :
                        o.status === "shipped" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/50" :
                        o.status === "processing" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/50" :
                        o.status === "cancelled" ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/50" :
                        o.status === "returned" ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200/50" :
                        "bg-muted text-muted-foreground border-border"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          o.status === "delivered" || o.status === "fulfilled" ? "bg-emerald-500" :
                          o.status === "shipped" ? "bg-blue-500" :
                          o.status === "processing" ? "bg-amber-500" :
                          o.status === "cancelled" ? "bg-red-500" :
                          o.status === "returned" ? "bg-orange-500" : "bg-muted-foreground/40"
                        }`} />
                        {t(`orders.${o.status}`)}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] font-medium rounded-md py-0.5 ${
                        o.payment_status === "paid" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50" :
                        o.payment_status === "pending" || o.payment_status === "cod" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/50" :
                        o.payment_status === "refunded" ? "bg-blue-500/10 text-blue-600 border-blue-200/50" :
                        "bg-red-500/10 text-red-600 border-red-200/50"
                      }`}>
                        {t(`orders.${o.payment_status}`)}
                      </Badge>
                      {/* backend-031 — WhatsApp customer-confirmation
                          state. Only renders when the store opted into
                          require_order_confirmation (status is non-null).
                          'confirmed' = customer tapped the Confirm
                          button; 'pending' = waiting on their tap. */}
                      {o.customer_confirmation_status && (
                        <Badge variant="outline" className={`text-[10px] font-medium rounded-md py-0.5 gap-1 ${
                          o.customer_confirmation_status === "confirmed" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50" :
                          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/50"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            o.customer_confirmation_status === "confirmed" ? "bg-emerald-500" : "bg-amber-500"
                          }`} />
                          {o.customer_confirmation_status === "confirmed"
                            ? (language === "ar" ? "أكد العميل" : "Customer confirmed")
                            : (language === "ar" ? "بانتظار التأكيد" : "Awaiting confirmation")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-1 rtl:rotate-180" />
                </button>
              ))}
            </div>

            {/* Desktop table (≥ md) */}
            <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={orders.length > 0 && selected.size === orders.length}
                      onCheckedChange={() => { if (selected.size === orders.length) setSelected(new Set()); else setSelected(new Set(orders.map(o => o.id))); }}
                    />
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold">
                    <div>{isAr ? "رقم الطلب" : "Order #"}</div>
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold">
                    <div>{isAr ? "العميل" : "Customer"}</div>
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold">{isAr ? "الدفع" : "Payment"}</TableHead>
                  <TableHead className="text-[11px] font-semibold">{isAr ? "حالة الدفع" : "Pay Status"}</TableHead>
                  <TableHead className="text-[11px] font-semibold">{isAr ? "الشحن" : "Shipping"}</TableHead>
                  <TableHead className="text-[11px] font-semibold">
                    <div>{isAr ? "المجموع" : "Total"}</div>
                    <div className="text-[10px] font-normal text-muted-foreground">{isAr ? "العملة" : "Currency"}</div>
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold">{isAr ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="text-[11px] font-semibold">
                    <div>{isAr ? "تاريخ الإنشاء" : "Created"}</div>
                    <div className="text-[10px] font-normal text-muted-foreground">{isAr ? "تاريخ التحديث" : "Updated"}</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id} className="group cursor-pointer" onClick={(e) => openOrderDetail(o.id, e)}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggleSelect(o.id)} />
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium">{o.order_number}</TableCell>
                    <TableCell>
                      <div className="text-xs font-medium truncate max-w-[120px]">{o.customer_name || "—"}</div>
                      {o.campaign?.name && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[140px]" title={`via ${o.campaign.name}`}>
                          {language === "ar" ? "عبر" : "via"} {o.campaign.name}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.payment_method || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] font-medium rounded-md py-0.5 ${
                        o.payment_status === "paid" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50" :
                        o.payment_status === "pending" || o.payment_status === "cod" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/50" :
                        o.payment_status === "refunded" ? "bg-blue-500/10 text-blue-600 border-blue-200/50" :
                        "bg-red-500/10 text-red-600 border-red-200/50"
                      }`}>
                        {t(`orders.${o.payment_status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">—</TableCell>
                    <TableCell>
                      <div className="text-xs font-semibold tabular-nums">{formatCurrency(o.total)}</div>
                      <div className="text-[10px] text-muted-foreground">EGP</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] font-medium rounded-md py-0.5 gap-1 ${
                        o.status === "delivered" || o.status === "fulfilled" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50" :
                        o.status === "shipped" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/50" :
                        o.status === "processing" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/50" :
                        o.status === "cancelled" ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/50" :
                        o.status === "returned" ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200/50" :
                        "bg-muted text-muted-foreground border-border"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          o.status === "delivered" || o.status === "fulfilled" ? "bg-emerald-500" :
                          o.status === "shipped" ? "bg-blue-500" :
                          o.status === "processing" ? "bg-amber-500" :
                          o.status === "cancelled" ? "bg-red-500" :
                          o.status === "returned" ? "bg-orange-500" : "bg-muted-foreground/40"
                        }`} />
                        {t(`orders.${o.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">{fmtDate(o.created_at)}</div>
                      <div className="text-[10px] text-muted-foreground">{fmtTime(o.created_at)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </>
        )}

        {/* Pagination */}
        {totalOrders > 20 && (
          <div className="flex items-center justify-between px-5 py-3 border-t">
            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              {isAr ? "السابق" : "Previous"}
            </Button>
            <span className="text-[10px] text-muted-foreground tabular-nums">{isAr ? `صفحة ${page}` : `Page ${page}`}</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={page * 20 >= totalOrders} onClick={() => setPage(p => p + 1)}>
              {isAr ? "التالي" : "Next"}
            </Button>
          </div>
        )}
      </div>

      {rtoDialog}

      {/* Souq order drawer — slides in on row click. Header/footer
          buttons navigate to the full /orders/:id page. ⌘/Ctrl+click
          on a row bypasses the drawer entirely. */}
      <OrderDrawer
        orderId={drawerOrderId}
        onClose={() => setDrawerOrderId(null)}
      />
    </div>
  );
};

export default Orders;
