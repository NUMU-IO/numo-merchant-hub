import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Users, Search, ChevronLeft, ChevronRight, Mail, ShieldCheck, UserCheck,
  ArrowLeft, ShoppingCart, Calendar, Phone, DollarSign,
  CheckCircle2, AlertTriangle, AlertCircle, Network,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { listCustomers, getCustomer, getCustomerTrustStats } from "@/services/customerApi";
import type { Customer } from "@/services/customerApi";
import { listOrders } from "@/services/orderApi";
import type { OrderListItem } from "@/services/orderApi";
import { CustomersSkeleton } from "@/components/skeletons/CustomersSkeleton";

const PAGE_SIZE = 20;

export default function Customers() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Detail view
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<OrderListItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const customersQuery = useQuery({
    queryKey: ["customers", storeId, currentPage, debouncedSearch],
    queryFn: () =>
      listCustomers(storeId!, {
        page: currentPage,
        limit: PAGE_SIZE,
        query: debouncedSearch || undefined,
      }),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const customers = customersQuery.data?.items ?? [];
  const total = customersQuery.data?.total ?? 0;
  const totalPages = customersQuery.data?.total_pages ?? 1;

  const formatCurrency = (cents: number) => {
    const val = cents / 100;
    return isAr ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString(isAr ? "ar-EG" : "en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  };

  const activeCount = customers.filter((c) => c.total_orders > 0).length;

  const openCustomerDetail = async (customer: Customer) => {
    if (!storeId) return;
    setLoadingDetail(true);
    setSelectedCustomer(customer);
    setCustomerOrders([]);
    try {
      const ordersResult = await listOrders(storeId, { limit: 10, customer_id: customer.id });
      setCustomerOrders(ordersResult.items);
    } catch {
      // Silent — orders are supplementary
    } finally {
      setLoadingDetail(false);
    }
  };

  if (customersQuery.isLoading && customers.length === 0) {
    return <CustomersSkeleton />;
  }

  const statusColorMap: Record<string, string> = {
    delivered: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    fulfilled: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    shipped: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    confirmed: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800",
    processing: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    pending: "bg-muted text-muted-foreground border-border",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  };

  // === Customer Detail View ===
  if (selectedCustomer) {
    const c = selectedCustomer;
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setSelectedCustomer(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight">{c.full_name || `${c.first_name} ${c.last_name}`}</h1>
            <p className="text-[13px] text-muted-foreground">{c.email}</p>
          </div>
          <Badge variant="outline" className={`text-xs py-0.5 ${c.is_verified ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" : "bg-muted text-muted-foreground border-border"}`}>
            {c.is_verified ? (isAr ? "مُفعّل" : "Verified") : (isAr ? "غير مُفعّل" : "Unverified")}
          </Badge>
        </div>

        {/* Info Cards */}
        <div className="grid gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{isAr ? "إجمالي الطلبات" : "Total Orders"}</p>
              <p className="text-2xl font-bold tabular-nums">{c.total_orders}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{isAr ? "إجمالي الإنفاق" : "Total Spent"}</p>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(c.total_spent)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{isAr ? "عميل منذ" : "Customer Since"}</p>
              <p className="text-sm font-semibold mt-1">{formatDate(c.created_at)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{isAr ? "متوسط الطلب" : "Avg Order"}</p>
              <p className="text-2xl font-bold tabular-nums">{c.total_orders > 0 ? formatCurrency(c.total_spent / c.total_orders) : "—"}</p>
            </CardContent>
          </Card>
        </div>

        {/* COD Trust Network Stats */}
        {storeId && <TrustStatsCard storeId={storeId} customerId={c.id} isAr={isAr} />}

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Contact Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{isAr ? "معلومات الاتصال" : "Contact Info"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">{isAr ? "الإيميل" : "Email"}</p>
                  <p className="text-sm font-medium truncate">{c.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">{isAr ? "الموبايل" : "Phone"}</p>
                  <p className="text-sm font-medium" dir="ltr">{c.phone || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">{isAr ? "تاريخ التسجيل" : "Joined"}</p>
                  <p className="text-sm font-medium">{formatDate(c.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">{isAr ? "يقبل التسويق" : "Marketing"}</p>
                  <p className="text-sm font-medium">{c.accepts_marketing ? (isAr ? "نعم" : "Yes") : (isAr ? "لا" : "No")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order History */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{isAr ? "سجل الطلبات" : "Order History"}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDetail ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : customerOrders.length > 0 ? (
                <div className="space-y-1">
                  {customerOrders.map((o) => (
                    <div key={o.id} className="flex items-center gap-3 rounded-lg p-2.5 -mx-1 hover:bg-muted/50 transition-colors">
                      <ShoppingCart className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold tabular-nums">{o.order_number}</span>
                          <Badge variant="outline" className={`text-[9px] font-medium px-1.5 py-0 border ${statusColorMap[o.status] || ""}`}>
                            {t(`orders.${o.status}`)}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {" · "}{o.item_count} {isAr ? "منتج" : "items"}
                        </p>
                      </div>
                      <span className="text-[13px] font-semibold tabular-nums shrink-0">{formatCurrency(o.total)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={ShoppingCart} title={isAr ? "لا توجد طلبات" : "No orders yet"} className="py-6" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // === Customer List View ===
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("nav.customers")}</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {isAr ? "إدارة عملاء متجرك" : "Manage your store customers"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: isAr ? "إجمالي العملاء" : "Total Customers", value: total },
          { label: isAr ? "لديهم طلبات" : "With Orders", value: activeCount },
          { label: isAr ? "يقبلون التسويق" : "Accepts Marketing", value: customers.filter((c) => c.accepts_marketing).length },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</p>
              <p className="text-2xl font-bold tabular-nums">{stat.value.toLocaleString(isAr ? "ar-EG" : undefined)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Customer Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-sm font-semibold">{isAr ? "قائمة العملاء" : "Customer List"}</CardTitle>
            <div className="relative w-64">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={isAr ? "بحث بالاسم أو الإيميل..." : "Search by name or email..."}
                className="ps-8 h-8 text-xs rounded-lg bg-muted/40 border-transparent focus:border-border"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {customers.length === 0 && !customersQuery.isFetching ? (
            <div className="px-5 pb-8">
              <EmptyState
                icon={Users}
                title={debouncedSearch ? (isAr ? "مفيش نتائج للبحث" : "No results found") : (isAr ? "أول عميل في الطريق!" : "Your first customer is on the way!")}
                description={debouncedSearch ? undefined : (isAr ? "شارك رابط متجرك وابدأ باستقبال الطلبات — العملاء هيظهروا هنا تلقائياً" : "Share your store link and start receiving orders — customers will appear here automatically")}
              />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-[11px] font-semibold h-9 ps-5">{isAr ? "الاسم" : "Name"}</TableHead>
                    <TableHead className="text-[11px] font-semibold h-9">{isAr ? "الإيميل" : "Email"}</TableHead>
                    <TableHead className="text-[11px] font-semibold h-9">{isAr ? "الموبايل" : "Phone"}</TableHead>
                    <TableHead className="text-[11px] font-semibold h-9 text-center">{isAr ? "الطلبات" : "Orders"}</TableHead>
                    <TableHead className="text-[11px] font-semibold h-9">{isAr ? "إجمالي الإنفاق" : "Total Spent"}</TableHead>
                    <TableHead className="text-[11px] font-semibold h-9 text-center">{isAr ? "الحالة" : "Status"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors border-border/30"
                      onClick={() => openCustomerDetail(c)}
                    >
                      <TableCell className="font-medium text-[13px] py-3 ps-5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/8 text-[10px] font-bold text-primary shrink-0">
                            {(c.full_name || c.first_name || "?").charAt(0).toUpperCase()}
                          </div>
                          {c.full_name || `${c.first_name} ${c.last_name}`}
                        </div>
                      </TableCell>
                      <TableCell className="text-[13px] text-muted-foreground py-3">{c.email}</TableCell>
                      <TableCell className="text-[13px] text-muted-foreground py-3"><span dir="ltr">{c.phone || "—"}</span></TableCell>
                      <TableCell className="text-[13px] py-3 text-center tabular-nums font-medium">{c.total_orders}</TableCell>
                      <TableCell className="text-[13px] tabular-nums font-medium py-3"><span dir="ltr">{formatCurrency(c.total_spent)}</span></TableCell>
                      <TableCell className="py-3 text-center">
                        <Badge variant="outline" className={`text-[10px] font-medium px-1.5 py-0 border ${c.is_verified ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" : "bg-muted text-muted-foreground border-border"}`}>
                          {c.is_verified ? (
                            <><ShieldCheck className="h-2.5 w-2.5 me-0.5 inline" />{isAr ? "مُفعّل" : "Verified"}</>
                          ) : (isAr ? "غير مُفعّل" : "Unverified")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border/40">
                  <p className="text-[11px] text-muted-foreground">
                    {isAr
                      ? `صفحة ${currentPage} من ${totalPages} (${total} عميل)`
                      : `Page ${currentPage} of ${totalPages} (${total} customers)`}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


// ─── Trust Stats Card ──────────────────────────────────────────────────────

interface TrustStatsCardProps {
  storeId: string;
  customerId: string;
  isAr: boolean;
}

function TrustStatsCard({ storeId, customerId, isAr }: TrustStatsCardProps) {
  const trustQuery = useQuery({
    queryKey: ["customer-trust", storeId, customerId],
    queryFn: () => getCustomerTrustStats(storeId, customerId),
    staleTime: 5 * 60 * 1000,
  });

  const data = trustQuery.data;

  // Loading state
  if (trustQuery.isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Network className="h-3.5 w-3.5 text-muted-foreground" />
            {isAr ? "نسبة الثقة في الشبكة" : "Network Trust Score"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 animate-pulse bg-muted/40 rounded" />
        </CardContent>
      </Card>
    );
  }

  // No phone or no data yet — show a preview of what the card will look like
  if (!data || !data.has_data) {
    return (
      <Card className="border-border/60 relative overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Network className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "نسبة الثقة في شبكة نمو" : "NUMU Network Trust"}
            </CardTitle>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
              {isAr ? "في انتظار البيانات" : "Awaiting data"}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {/* Preview placeholder with 4 stat tiles like the real card */}
          <div className="grid gap-3 sm:grid-cols-4 opacity-40">
            {[
              { label: isAr ? "نسبة الاستلام" : "Delivery Rate", value: "—" },
              { label: isAr ? "طلبات الشبكة" : "Network Orders", value: "—" },
              { label: isAr ? "مرتجعات" : "Rejections", value: "—" },
              { label: isAr ? "درجة الخطر" : "Risk Score", value: "—" },
            ].map((tile) => (
              <div key={tile.label} className="rounded-lg border bg-muted/20 p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  {tile.label}
                </p>
                <p className="text-2xl font-bold tabular-nums text-muted-foreground">{tile.value}</p>
                <div className="h-2 mt-1 bg-muted/50 rounded" />
              </div>
            ))}
          </div>
          {/* Explanatory text below the preview */}
          <p className="text-[11px] text-muted-foreground text-center mt-4 leading-relaxed">
            {isAr
              ? "هذه الإحصائيات هتظهر هنا بمجرد ما العميل يعمل أول طلب. شبكة نمو بتجمع بيانات من كل التجار عشان تعرف معدل قبول الطلبات للعميل قبل ما يطلب من متجرك."
              : "These stats will appear here as soon as the customer places their first order. The NUMU network aggregates data from all merchants so you know the customer's delivery acceptance rate before they order from your store."}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Has data — full card
  const recommendationConfig = {
    safe: {
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      label_en: "Trustworthy",
      label_ar: "موثوق",
    },
    caution: {
      icon: AlertTriangle,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      label_en: "Caution",
      label_ar: "تحذير",
    },
    risky: {
      icon: AlertCircle,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      label_en: "High Risk",
      label_ar: "خطر عالي",
    },
  };

  const config = recommendationConfig[data.recommendation];
  const RecommendationIcon = config.icon;

  // Delivery score visual: 0-100 scale (delivery_rate_pct)
  const deliveryScoreLabel = data.delivery_rate_pct >= 80
    ? (isAr ? "ممتاز" : "Excellent")
    : data.delivery_rate_pct >= 60
      ? (isAr ? "جيد" : "Good")
      : data.delivery_rate_pct >= 40
        ? (isAr ? "متوسط" : "Average")
        : (isAr ? "ضعيف" : "Poor");

  return (
    <Card className={`border-border/60 ${config.border}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Network className="h-3.5 w-3.5 text-muted-foreground" />
            {isAr ? "نسبة الثقة في شبكة نمو" : "NUMU Network Trust"}
          </CardTitle>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg}`}>
            <RecommendationIcon className={`h-3.5 w-3.5 ${config.color}`} />
            <span className={`text-[11px] font-bold ${config.color}`}>
              {isAr ? config.label_ar : config.label_en}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-4">
          {/* Delivery Score */}
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              {isAr ? "نسبة الاستلام" : "Delivery Rate"}
            </p>
            <p className={`text-2xl font-bold tabular-nums ${data.delivery_rate_pct >= 70 ? "text-emerald-600 dark:text-emerald-400" : data.delivery_rate_pct >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
              {data.delivery_rate_pct}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{deliveryScoreLabel}</p>
          </div>

          {/* Total Network Orders */}
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              {isAr ? "طلبات الشبكة" : "Network Orders"}
            </p>
            <p className="text-2xl font-bold tabular-nums">{data.network_orders}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isAr ? `من ${data.contributing_store_count} متجر` : `from ${data.contributing_store_count} stores`}
            </p>
          </div>

          {/* RTOs */}
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              {isAr ? "مرتجعات" : "Rejections"}
            </p>
            <p className={`text-2xl font-bold tabular-nums ${data.network_rtos === 0 ? "text-emerald-600 dark:text-emerald-400" : data.rto_rate_pct < 20 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
              {data.network_rtos}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{data.rto_rate_pct}% {isAr ? "من الكل" : "of total"}</p>
          </div>

          {/* Risk Score */}
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              {isAr ? "درجة الخطر" : "Risk Score"}
            </p>
            <p className={`text-2xl font-bold tabular-nums ${data.risk_score < 40 ? "text-emerald-600 dark:text-emerald-400" : data.risk_score < 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
              {data.risk_score}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isAr ? `ثقة ${data.confidence === "high" ? "عالية" : data.confidence === "medium" ? "متوسطة" : "منخفضة"}` : `${data.confidence} confidence`}
            </p>
          </div>
        </div>

        {/* Footer with last activity */}
        {(data.last_order_at || data.last_rto_at) && (
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
            {data.last_order_at && (
              <span>
                {isAr ? "آخر طلب: " : "Last order: "}
                {new Date(data.last_order_at).toLocaleDateString(isAr ? "ar-EG" : "en-US")}
              </span>
            )}
            {data.last_rto_at && (
              <span className="text-red-500/70">
                {isAr ? "آخر مرتجع: " : "Last rejection: "}
                {new Date(data.last_rto_at).toLocaleDateString(isAr ? "ar-EG" : "en-US")}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
