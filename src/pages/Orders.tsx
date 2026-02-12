import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { orders as allOrders, type FulfillmentStatus, type Order } from "@/data/mock-orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, CheckCircle2, Circle, Clock, Package, Truck, XCircle } from "lucide-react";

const Orders = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<"all" | FulfillmentStatus>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const formatCurrency = (val: number) =>
    language === "ar" ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;

  const filtered = statusFilter === "all" ? allOrders : allOrders.filter((o) => o.fulfillmentStatus === statusFilter);

  const statusColor: Record<FulfillmentStatus, string> = {
    delivered: "bg-primary/10 text-primary",
    shipped: "bg-blue-100 text-blue-700",
    processing: "bg-yellow-100 text-yellow-700",
    pending: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive",
  };

  const paymentColor: Record<string, string> = {
    paid: "bg-primary/10 text-primary",
    unpaid: "bg-destructive/10 text-destructive",
    cod: "bg-yellow-100 text-yellow-700",
  };

  const timelineIcons: Record<string, React.ReactNode> = {
    "Order placed": <Circle className="h-4 w-4" />,
    Processing: <Clock className="h-4 w-4" />,
    Shipped: <Truck className="h-4 w-4" />,
    Delivered: <CheckCircle2 className="h-4 w-4" />,
    Cancelled: <XCircle className="h-4 w-4" />,
  };

  if (selectedOrder) {
    const o = selectedOrder;
    const subtotal = o.items.reduce((acc, item) => acc + item.price * item.qty, 0);
    return (
      <div className="space-y-6">
        <Button variant="ghost" className="gap-2" onClick={() => setSelectedOrder(null)}>
          <ArrowLeft className="h-4 w-4" />
          {t("orders.back")}
        </Button>

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
                      <TableCell><span className="text-xl">{item.image}</span></TableCell>
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

          {/* Sidebar Info */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("orders.customerInfo")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">{language === "ar" ? o.customerNameAr : o.customerName}</p>
                <p className="text-muted-foreground">{o.customerEmail}</p>
                <p className="text-muted-foreground">{o.customerPhone}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("orders.shippingAddress")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{language === "ar" ? o.shippingAddressAr : o.shippingAddress}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("orders.paymentInfo")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className={paymentColor[o.paymentStatus]}>
                  {t(`orders.${o.paymentStatus}`)}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("orders.timeline")}</CardTitle>
              </CardHeader>
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("orders.title")}</h1>

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
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{t("orders.noOrders")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("orders.orderNumber")}</TableHead>
                  <TableHead>{t("orders.customer")}</TableHead>
                  <TableHead>{t("orders.date")}</TableHead>
                  <TableHead>{t("orders.total")}</TableHead>
                  <TableHead>{t("orders.payment")}</TableHead>
                  <TableHead>{t("orders.fulfillment")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => setSelectedOrder(o)}>
                    <TableCell className="font-medium">{o.orderNumber}</TableCell>
                    <TableCell>{language === "ar" ? o.customerNameAr : o.customerName}</TableCell>
                    <TableCell className="text-muted-foreground">{o.date}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(o.total)}</TableCell>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Orders;
