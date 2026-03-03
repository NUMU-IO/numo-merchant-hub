import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  listOrders, getOrder, updateOrderStatus as apiUpdateStatus,
  bulkUpdateStatus, getOrderTimeline, markOrderPaid,
  type OrderListItem, type Order as ApiOrder, type TimelineEvent,
} from "@/services/orderApi";
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
  ArrowLeft, CheckCircle2, Circle, Clock, Package, Truck, XCircle,
  MoreHorizontal, Printer, FileDown, ChevronRight, ArrowRightCircle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { OrdersSkeleton } from "@/components/skeletons/OrdersSkeleton";

type FulfillmentStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
const WORKFLOW: FulfillmentStatus[] = ["pending", "processing", "shipped", "delivered"];

const Orders = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | FulfillmentStatus>("all");

  const [selectedOrderDetail, setSelectedOrderDetail] = useState<ApiOrder | null>(null);
  const [orderTimeline, setOrderTimeline] = useState<TimelineEvent[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // React Query hook for orders list
  const ordersQuery = useQuery({
    queryKey: ["orders", storeId, page, statusFilter],
    queryFn: () => {
      const params: Record<string, string | number | boolean> = { page, limit: 20 };
      if (statusFilter !== "all") params.status = statusFilter;
      return listOrders(storeId!, params);
    },
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const orders = ordersQuery.data?.items ?? [];
  const totalOrders = ordersQuery.data?.total ?? 0;

  const formatCurrency = (cents: number) => {
    const val = cents / 100;
    return language === "ar" ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;
  };

  const invalidateOrders = () => {
    queryClient.invalidateQueries({ queryKey: ["orders", storeId] });
  };

  const openOrderDetail = async (orderId: string) => {
    if (!storeId) return;
    setDetailLoading(true);
    try {
      const [order, timeline] = await Promise.all([
        getOrder(storeId, orderId),
        getOrderTimeline(storeId, orderId).catch(() => ({ events: [] as TimelineEvent[], order_id: "", order_number: "" })),
      ]);
      setSelectedOrderDetail(order);
      setOrderTimeline(timeline.events || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load order");
    } finally {
      setDetailLoading(false);
    }
  };

  const statusColor: Record<string, string> = {
    delivered: "bg-primary/10 text-primary",
    fulfilled: "bg-primary/10 text-primary",
    shipped: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    processing: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    pending: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive",
  };

  const paymentColor: Record<string, string> = {
    paid: "bg-primary/10 text-primary",
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    unpaid: "bg-destructive/10 text-destructive",
    cod: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    refunded: "bg-blue-500/10 text-blue-600",
  };

  const timelineIcons: Record<string, React.ReactNode> = {
    pending: <Circle className="h-4 w-4" />,
    processing: <Clock className="h-4 w-4" />,
    shipped: <Truck className="h-4 w-4" />,
    delivered: <CheckCircle2 className="h-4 w-4" />,
    fulfilled: <CheckCircle2 className="h-4 w-4" />,
    cancelled: <XCircle className="h-4 w-4" />,
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
        toast.error(msg || (language === "ar" ? "فشل تحديث الحالة" : "Failed to update status"));
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
      toast.error(err instanceof Error ? err.message : "Failed to mark as paid");
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
      toast.error(err instanceof Error ? err.message : "Bulk update failed");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
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
                {o.tracking_number && (
                  <p className="text-sm text-muted-foreground">
                    {language === "ar" ? "رقم التتبع:" : "Tracking:"} {o.tracking_number}
                  </p>
                )}
                {o.payment_status !== "paid" && (
                  <Button size="sm" variant="outline" className="w-full mt-2 gap-1.5" onClick={() => handleMarkPaid(o.id)}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {language === "ar" ? "تأكيد الدفع" : "Mark as Paid"}
                  </Button>
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

  // === List View ===
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("orders.title")}</h1>
          <p className="text-sm text-muted-foreground">{totalOrders} {language === "ar" ? "طلب" : "orders"}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCSV}>
          <FileDown className="h-3.5 w-3.5" />
          {t("orders.export")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v as "all" | FulfillmentStatus); setPage(1); }}>
            <TabsList className="flex-wrap">
              <TabsTrigger value="all">{t("orders.all")}</TabsTrigger>
              <TabsTrigger value="pending">{t("orders.pending")}</TabsTrigger>
              <TabsTrigger value="processing">{t("orders.processing")}</TabsTrigger>
              <TabsTrigger value="shipped">{t("orders.shipped")}</TabsTrigger>
              <TabsTrigger value="delivered">{t("orders.delivered")}</TabsTrigger>
              <TabsTrigger value="cancelled">{t("orders.cancelled")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {/* Bulk actions bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted/50 border border-border animate-in fade-in slide-in-from-top-2 duration-200">
              <span className="text-sm font-medium">
                {selected.size} {language === "ar" ? "محدد" : "selected"}
              </span>
              <div className="flex items-center gap-2 ms-auto">
                <Select onValueChange={(v) => handleBulkStatus(v)}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue placeholder={t("orders.bulkStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(["processing", "shipped", "delivered", "cancelled"] as const).map(s => (
                      <SelectItem key={s} value={s}>{t(`orders.${s}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  {language === "ar" ? "إلغاء" : "Clear"}
                </Button>
              </div>
            </div>
          )}

          {orders.length === 0 && !ordersQuery.isLoading ? (
            <div className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">{t("orders.noOrders")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={orders.length > 0 && selected.size === orders.length}
                        onCheckedChange={() => {
                          if (selected.size === orders.length) setSelected(new Set());
                          else setSelected(new Set(orders.map(o => o.id)));
                        }}
                      />
                    </TableHead>
                    <TableHead>{t("orders.orderNumber")}</TableHead>
                    <TableHead>{t("orders.customer")}</TableHead>
                    <TableHead>{t("orders.date")}</TableHead>
                    <TableHead>{t("orders.total")}</TableHead>
                    <TableHead>{t("orders.payment")}</TableHead>
                    <TableHead>{t("orders.fulfillment")}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id} className="group">
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggleSelect(o.id)} />
                      </TableCell>
                      <TableCell className="font-medium cursor-pointer" onClick={() => openOrderDetail(o.id)}>
                        <span className="hover:underline">{o.order_number}</span>
                      </TableCell>
                      <TableCell className="cursor-pointer" onClick={() => openOrderDetail(o.id)}>
                        {o.customer_name || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground cursor-pointer" onClick={() => openOrderDetail(o.id)}>
                        {new Date(o.created_at).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US")}
                      </TableCell>
                      <TableCell className="font-medium cursor-pointer" onClick={() => openOrderDetail(o.id)}>
                        {formatCurrency(o.total)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={paymentColor[o.payment_status] || ""}>
                          {t(`orders.${o.payment_status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColor[o.status] || ""}>
                          {t(`orders.${o.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openOrderDetail(o.id)}>
                              <ChevronRight className="me-2 h-4 w-4" />
                              {t("orders.viewDetails")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {getNextStatus(o.status) && o.status !== "cancelled" && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(o.id, getNextStatus(o.status)!)}>
                                <ArrowRightCircle className="me-2 h-4 w-4" />
                                {t("orders.moveTo")} {t(`orders.${getNextStatus(o.status)}`)}
                              </DropdownMenuItem>
                            )}
                            {o.status !== "cancelled" && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateStatus(o.id, "cancelled")}
                                className="text-destructive"
                              >
                                <XCircle className="me-2 h-4 w-4" />
                                {t("orders.cancel")}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalOrders > 20 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                {language === "ar" ? "السابق" : "Previous"}
              </Button>
              <span className="text-sm text-muted-foreground">
                {language === "ar" ? `صفحة ${page}` : `Page ${page}`}
              </span>
              <Button variant="outline" size="sm" disabled={page * 20 >= totalOrders} onClick={() => setPage(p => p + 1)}>
                {language === "ar" ? "التالي" : "Next"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Orders;
