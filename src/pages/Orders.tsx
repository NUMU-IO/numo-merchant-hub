import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { orders as initialOrders, type FulfillmentStatus, type Order } from "@/data/mock-orders";
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
  MoreHorizontal, Printer, FileDown, ChevronRight, ArrowRightCircle,
} from "lucide-react";
import { toast } from "sonner";

const WORKFLOW: FulfillmentStatus[] = ["pending", "processing", "shipped", "delivered"];

const Orders = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [ordersList, setOrdersList] = useState<Order[]>(initialOrders);
  const [statusFilter, setStatusFilter] = useState<"all" | FulfillmentStatus>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const formatCurrency = (val: number) =>
    language === "ar" ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;

  const filtered = statusFilter === "all" ? ordersList : ordersList.filter((o) => o.fulfillmentStatus === statusFilter);

  const statusColor: Record<FulfillmentStatus, string> = {
    delivered: "bg-primary/10 text-primary",
    shipped: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    processing: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    pending: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive",
  };

  const paymentColor: Record<string, string> = {
    paid: "bg-primary/10 text-primary",
    unpaid: "bg-destructive/10 text-destructive",
    cod: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };

  const timelineIcons: Record<string, React.ReactNode> = {
    "Order placed": <Circle className="h-4 w-4" />,
    Processing: <Clock className="h-4 w-4" />,
    Shipped: <Truck className="h-4 w-4" />,
    Delivered: <CheckCircle2 className="h-4 w-4" />,
    Cancelled: <XCircle className="h-4 w-4" />,
  };

  const getNextStatus = (current: FulfillmentStatus): FulfillmentStatus | null => {
    const idx = WORKFLOW.indexOf(current);
    return idx >= 0 && idx < WORKFLOW.length - 1 ? WORKFLOW[idx + 1] : null;
  };

  const updateOrderStatus = (orderId: string, newStatus: FulfillmentStatus) => {
    const statusAr: Record<FulfillmentStatus, string> = {
      pending: "في الانتظار", processing: "قيد المعالجة", shipped: "تم الشحن", delivered: "تم التسليم", cancelled: "ملغي"
    };
    const statusEn: Record<FulfillmentStatus, string> = {
      pending: "Pending", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled"
    };

    setOrdersList(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return {
        ...o,
        fulfillmentStatus: newStatus,
        timeline: [
          ...o.timeline,
          { status: statusEn[newStatus], statusAr: statusAr[newStatus], date: new Date().toISOString().split("T")[0] },
        ],
      };
    }));

    if (selectedOrder?.id === orderId) {
      setSelectedOrder(prev => prev ? {
        ...prev,
        fulfillmentStatus: newStatus,
        timeline: [
          ...prev.timeline,
          { status: statusEn[newStatus], statusAr: statusAr[newStatus], date: new Date().toISOString().split("T")[0] },
        ],
      } : null);
    }

    toast.success(language === "ar" ? `تم التحديث لـ "${statusAr[newStatus]}"` : `Updated to "${statusEn[newStatus]}"`);
  };

  const handleBulkStatus = (newStatus: FulfillmentStatus) => {
    selected.forEach(id => updateOrderStatus(id, newStatus));
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handlePrint = (order: Order) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>${order.orderNumber}</title><style>body{font-family:system-ui;padding:24px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #ddd;text-align:left}</style></head><body>`);
    w.document.write(`<h1>Order ${order.orderNumber}</h1>`);
    w.document.write(`<p>Customer: ${order.customerName} | ${order.customerPhone}</p>`);
    w.document.write(`<p>Address: ${order.shippingAddress}</p>`);
    w.document.write(`<table><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr>`);
    order.items.forEach(item => {
      w.document.write(`<tr><td>${item.name}</td><td>${item.qty}</td><td>EGP ${item.price}</td><td>EGP ${item.price * item.qty}</td></tr>`);
    });
    w.document.write(`</table><p><strong>Total: EGP ${order.total}</strong></p></body></html>`);
    w.document.close();
    w.print();
  };

  const handleExportCSV = () => {
    const rows = [["Order #", "Customer", "Date", "Total", "Payment", "Fulfillment"]];
    (selected.size > 0 ? ordersList.filter(o => selected.has(o.id)) : filtered).forEach(o => {
      rows.push([o.orderNumber, o.customerName, o.date, String(o.total), o.paymentStatus, o.fulfillmentStatus]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "orders.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success(language === "ar" ? "تم تصدير الطلبات!" : "Orders exported!");
  };

  // === Order Detail View ===
  if (selectedOrder) {
    const o = selectedOrder;
    const subtotal = o.items.reduce((acc, item) => acc + item.price * item.qty, 0);
    const nextStatus = getNextStatus(o.fulfillmentStatus);

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-center justify-between">
          <Button variant="ghost" className="gap-2" onClick={() => setSelectedOrder(null)}>
            <ArrowLeft className="h-4 w-4" />
            {t("orders.back")}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handlePrint(o)}>
              <Printer className="h-3.5 w-3.5" />
              {t("orders.print")}
            </Button>
            {nextStatus && o.fulfillmentStatus !== "cancelled" && (
              <Button size="sm" className="gap-1.5" onClick={() => updateOrderStatus(o.id, nextStatus)}>
                <ArrowRightCircle className="h-3.5 w-3.5" />
                {t("orders.moveTo")} {t(`orders.${nextStatus}`)}
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{t("orders.orderDetails")} {o.orderNumber}</h1>
          <Badge variant="secondary" className={statusColor[o.fulfillmentStatus]}>
            {t(`orders.${o.fulfillmentStatus}`)}
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
                    <TableHead></TableHead>
                    <TableHead>{t("products.name")}</TableHead>
                    <TableHead>{t("orders.qty")}</TableHead>
                    <TableHead>{t("products.price")}</TableHead>
                    <TableHead>{t("orders.total")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {o.items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-lg">{item.image}</span></TableCell>
                      <TableCell className="font-medium">{language === "ar" ? item.nameAr : item.name}</TableCell>
                      <TableCell>{item.qty}</TableCell>
                      <TableCell>{formatCurrency(item.price)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(item.price * item.qty)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 space-y-1 text-sm border-t pt-3">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("orders.subtotal")}</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("orders.shipping")}</span><span>{formatCurrency(o.shippingCost)}</span></div>
                <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>{t("orders.total")}</span><span>{formatCurrency(o.total)}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("orders.customerInfo")}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">{language === "ar" ? o.customerNameAr : o.customerName}</p>
                <p className="text-muted-foreground">{o.customerEmail}</p>
                <p className="text-muted-foreground">{o.customerPhone}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("orders.shippingAddress")}</CardTitle></CardHeader>
              <CardContent><p className="text-sm">{language === "ar" ? o.shippingAddressAr : o.shippingAddress}</p></CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("orders.paymentInfo")}</CardTitle></CardHeader>
              <CardContent>
                <Badge variant="secondary" className={paymentColor[o.paymentStatus]}>{t(`orders.${o.paymentStatus}`)}</Badge>
              </CardContent>
            </Card>

            {/* Status workflow */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("orders.updateStatus")}</CardTitle></CardHeader>
              <CardContent>
                <Select
                  value={o.fulfillmentStatus}
                  onValueChange={(v) => updateOrderStatus(o.id, v as FulfillmentStatus)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["pending", "processing", "shipped", "delivered", "cancelled"] as FulfillmentStatus[]).map(s => (
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
                  {o.timeline.map((ev, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-0.5 text-muted-foreground">
                        {timelineIcons[ev.status] || <Circle className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{language === "ar" ? ev.statusAr : ev.status}</p>
                        <p className="text-xs text-muted-foreground">{ev.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // === List View ===
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("orders.title")}</h1>
          <p className="text-sm text-muted-foreground">{ordersList.length} {language === "ar" ? "طلب" : "orders"}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCSV}>
          <FileDown className="h-3.5 w-3.5" />
          {t("orders.export")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
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
                <Select onValueChange={(v) => handleBulkStatus(v as FulfillmentStatus)}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue placeholder={t("orders.bulkStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(["processing", "shipped", "delivered", "cancelled"] as FulfillmentStatus[]).map(s => (
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

          {filtered.length === 0 ? (
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
                        checked={filtered.length > 0 && selected.size === filtered.length}
                        onCheckedChange={() => {
                          if (selected.size === filtered.length) setSelected(new Set());
                          else setSelected(new Set(filtered.map(o => o.id)));
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
                  {filtered.map((o) => (
                    <TableRow key={o.id} className="group">
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggleSelect(o.id)} />
                      </TableCell>
                      <TableCell className="font-medium cursor-pointer" onClick={() => setSelectedOrder(o)}>
                        <span className="hover:underline">{o.orderNumber}</span>
                      </TableCell>
                      <TableCell className="cursor-pointer" onClick={() => setSelectedOrder(o)}>
                        {language === "ar" ? o.customerNameAr : o.customerName}
                      </TableCell>
                      <TableCell className="text-muted-foreground cursor-pointer" onClick={() => setSelectedOrder(o)}>{o.date}</TableCell>
                      <TableCell className="font-medium cursor-pointer" onClick={() => setSelectedOrder(o)}>{formatCurrency(o.total)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={paymentColor[o.paymentStatus]}>
                          {t(`orders.${o.paymentStatus}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColor[o.fulfillmentStatus]}>
                          {t(`orders.${o.fulfillmentStatus}`)}
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
                            <DropdownMenuItem onClick={() => setSelectedOrder(o)}>
                              <ChevronRight className="me-2 h-4 w-4" />
                              {t("orders.viewDetails")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePrint(o)}>
                              <Printer className="me-2 h-4 w-4" />
                              {t("orders.print")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {getNextStatus(o.fulfillmentStatus) && o.fulfillmentStatus !== "cancelled" && (
                              <DropdownMenuItem onClick={() => updateOrderStatus(o.id, getNextStatus(o.fulfillmentStatus)!)}>
                                <ArrowRightCircle className="me-2 h-4 w-4" />
                                {t("orders.moveTo")} {t(`orders.${getNextStatus(o.fulfillmentStatus)}`)}
                              </DropdownMenuItem>
                            )}
                            {o.fulfillmentStatus !== "cancelled" && (
                              <DropdownMenuItem
                                onClick={() => updateOrderStatus(o.id, "cancelled")}
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
        </CardContent>
      </Card>
    </div>
  );
};

export default Orders;
