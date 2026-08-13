import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable, MobileCardList, MobileCard } from "@/components/ui/responsive-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Users, Search, ChevronLeft, ChevronRight, Mail, ShieldCheck, UserCheck,
  ArrowLeft, ShoppingCart, Calendar, Phone, DollarSign,
  CheckCircle2, AlertTriangle, AlertCircle, Network, Info,
  TrendingUp, Store as StoreIcon, Truck, RotateCcw, Upload, UserPlus, MapPin,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { listCustomers, getCustomer, getCustomerTrustStats, getNetworkStats } from "@/services/customerApi";
import { CustomerJourneyTimeline } from "@/components/customers/CustomerJourneyTimeline";
import { AddCustomerDialog } from "@/components/customers/AddCustomerDialog";
import type { Customer } from "@/services/customerApi";
import { listOrders } from "@/services/orderApi";
import type { OrderListItem } from "@/services/orderApi";
import { CustomersSkeleton } from "@/components/skeletons/CustomersSkeleton";

const PAGE_SIZE = 20;

// Phone-only customers store a synthetic `import-…@….placeholder` email
// (create dialog + CSV import). Never show it as if it were real.
const displayEmail = (email: string) =>
  email.endsWith(".placeholder") ? "—" : email;

export default function Customers() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";
  const navigate = useNavigate();
  // URL-driven detail view: /customers/:customerId opens the same in-page
  // detail screen below, so order-detail's "View customer" link works.
  const { customerId: routeCustomerId } = useParams<{ customerId?: string }>();

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

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

  // When the user lands on /customers/:customerId (e.g. from the order
  // detail page's "View customer" link), fetch that customer and slide
  // into the detail view automatically.
  useEffect(() => {
    if (!storeId || !routeCustomerId) return;
    if (selectedCustomer?.id === routeCustomerId) return; // already loaded
    let cancelled = false;
    (async () => {
      try {
        const c = await getCustomer(storeId, routeCustomerId);
        if (!cancelled) await openCustomerDetail(c);
      } catch {
        // Bad ID / not in this store — leave the list visible.
      }
    })();
    return () => {
      cancelled = true;
    };
    // openCustomerDetail is stable enough; including it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, routeCustomerId]);

  const closeDetail = () => {
    setSelectedCustomer(null);
    // Keep the URL in sync with the visible view.
    if (routeCustomerId) navigate("/customers", { replace: true });
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
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={closeDetail}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{c.full_name || `${c.first_name} ${c.last_name}`}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{displayEmail(c.email)}</p>
          </div>
          <Badge variant={c.is_verified ? "success" : "secondary"} className="text-xs py-0.5">
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
                  <p className="text-sm font-medium truncate">{displayEmail(c.email)}</p>
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
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">{isAr ? "الموقع" : "Location"}</p>
                  <p className="text-sm font-medium truncate">{c.location || "—"}</p>
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

          {/* Customer Journey */}
          {storeId && (
            <CustomerJourneyTimeline storeId={storeId} customerId={c.id} />
          )}
        </div>
      </div>
    );
  }

  // === Customer List View ===
  return (
    <div className="space-y-5">
      {/* Souq page head — display title + subtitle + actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{t("nav.customers")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr ? "اعرف عملاءك وقسّمهم" : "Know and segment your shoppers"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/customers/import">
              <Upload className="h-3.5 w-3.5" />
              {isAr ? "استيراد" : "Import"}
            </Link>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            {isAr ? "إضافة عميل" : "Add customer"}
          </Button>
        </div>
      </div>

      {storeId && (
        <AddCustomerDialog storeId={storeId} open={addOpen} onOpenChange={setAddOpen} />
      )}

      {/* Souq segment stat tiles — ichip + label + tabular number */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: isAr ? "إجمالي العملاء" : "Total Customers", value: total, Icon: Users, chip: "ichip ichip-navy" },
          { label: isAr ? "لديهم طلبات" : "With Orders", value: activeCount, Icon: ShoppingCart, chip: "ichip ichip-sage" },
          { label: isAr ? "يقبلون التسويق" : "Accepts Marketing", value: customers.filter((c) => c.accepts_marketing).length, Icon: Network, chip: "ichip ichip-saffron" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={stat.chip}>
                <stat.Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-ink-soft mb-1">{stat.label}</p>
                <p className="text-[22px] font-extrabold tracking-tight tabular-nums leading-none">{stat.value.toLocaleString(isAr ? "ar-EG" : undefined)}</p>
              </div>
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
                description={debouncedSearch ? undefined : (isAr ? "العملاء بيظهروا تلقائياً مع الطلبات — أو أضفهم يدوياً أو استوردهم من ملف CSV من الأزرار فوق" : "Customers appear automatically with orders — or add them manually / import a CSV using the buttons above")}
              />
            </div>
          ) : (
            <>
              <ResponsiveTable
                mobile={
                  <MobileCardList className="p-3">
                    {customers.map((c) => (
                      <MobileCard
                        key={c.id}
                        onClick={() => openCustomerDetail(c)}
                        leading={
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/8 text-[12px] font-bold text-primary">
                            {(c.full_name || c.first_name || "?").charAt(0).toUpperCase()}
                          </div>
                        }
                        title={c.full_name || `${c.first_name} ${c.last_name}`}
                        subtitle={
                          /* Phone before email: for an Egyptian merchant the
                             phone is the identifier they actually act on. */
                          c.phone ? <span dir="ltr">{c.phone}</span> : displayEmail(c.email)
                        }
                        trailing={<span dir="ltr">{formatCurrency(c.total_spent)}</span>}
                        trailingMeta={
                          <span className="tabular-nums">
                            {c.total_orders} {isAr ? "طلب" : c.total_orders === 1 ? "order" : "orders"}
                          </span>
                        }
                        badges={
                          <Badge
                            variant="outline"
                            className={`px-1.5 py-0 text-[10px] font-medium border ${c.is_verified ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" : "bg-muted text-muted-foreground border-border"}`}
                          >
                            {c.is_verified ? (
                              <>
                                <ShieldCheck className="me-0.5 inline h-2.5 w-2.5" />
                                {isAr ? "مُفعّل" : "Verified"}
                              </>
                            ) : isAr ? (
                              "غير مُفعّل"
                            ) : (
                              "Unverified"
                            )}
                          </Badge>
                        }
                      />
                    ))}
                  </MobileCardList>
                }
              >
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
                      <TableCell className="text-[13px] text-muted-foreground py-3">{displayEmail(c.email)}</TableCell>
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
              </ResponsiveTable>

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

// Format big numbers compactly for the social-proof tiles: 12347 → "12.3k".
// Returns the raw string for <1000 since "1k" is less readable than "873".
function compactNumber(n: number, isAr: boolean): string {
  if (n < 1000) return n.toLocaleString(isAr ? "ar-EG" : "en-US");
  if (n < 1_000_000) {
    const v = (n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "");
    return `${v}${isAr ? "ألف" : "k"}`;
  }
  const v = (n / 1_000_000).toFixed(1).replace(/\.0$/, "");
  return `${v}${isAr ? "م" : "M"}`;
}

function TrustStatsCard({ storeId, customerId, isAr }: TrustStatsCardProps) {
  const trustQuery = useQuery({
    queryKey: ["customer-trust", storeId, customerId],
    queryFn: () => getCustomerTrustStats(storeId, customerId),
    staleTime: 5 * 60 * 1000,
  });

  // Network-wide aggregates — only used to populate the empty-state social-proof
  // tiles. Failing silently is fine; the empty state degrades to text-only.
  const networkQuery = useQuery({
    queryKey: ["network-stats", storeId],
    queryFn: () => getNetworkStats(storeId),
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  const data = trustQuery.data;

  // Loading state
  if (trustQuery.isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Network className="h-3.5 w-3.5 text-muted-foreground" />
            {isAr ? "نسبة الثقة في شبكة نمو" : "NUMU Network Trust"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 animate-pulse bg-muted/40 rounded" />
        </CardContent>
      </Card>
    );
  }

  // Empty state — sell the feature, show the network's reach, preview the real card.
  if (!data || !data.has_data) {
    const net = networkQuery.data;
    const socialTiles = [
      {
        iconSrc: "/icons/network-orders.svg",
        value: net ? compactNumber(net.orders_analyzed, isAr) : "—",
        label: isAr ? "طلب تم تحليله" : "orders analyzed",
      },
      {
        iconSrc: "/icons/network-merchants.svg",
        value: net ? compactNumber(net.contributing_merchants, isAr) : "—",
        label: isAr ? "تاجر في الشبكة" : "merchants in network",
      },
      {
        iconSrc: "/icons/network-buyers.svg",
        value: net ? compactNumber(net.phones_analyzed, isAr) : "—",
        label: isAr ? "عميل لهم سجل" : "buyers tracked",
      },
    ];

    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent relative overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Network className="h-3.5 w-3.5 text-primary" />
              {isAr ? "نسبة الثقة في شبكة نمو" : "NUMU Network Trust"}
            </CardTitle>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
              {isAr ? "في انتظار البيانات" : "Awaiting data"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hero illustration + value prop side-by-side on wide screens, stacked on mobile */}
          <div className="grid gap-4 md:grid-cols-[1fr_220px] items-center">
            <div className="flex items-start gap-3 rounded-lg bg-primary/[0.04] border border-primary/15 p-3">
              <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  {isAr ? "ليه ده مهم؟" : "Why this matters"}
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {isAr
                    ? "كل طلب COD بتقبله فيه مخاطرة. شبكة نمو بتجمع تصرف العميل ده مع كل التجار التانيين فيها، عشان تعرف قبل ما تأكد الطلب لو هياخده ولا لأ."
                    : "Every COD order you accept carries delivery risk. The NUMU network aggregates this buyer's behavior across every merchant on the platform, so you know upfront whether they'll actually receive the package."}
                </p>
              </div>
            </div>
            <img
              src="/illustrations/trust-network.svg"
              alt=""
              className="w-full h-auto max-h-32 mx-auto select-none pointer-events-none"
              draggable={false}
            />
          </div>

          {/* Social-proof tiles — live network numbers */}
          <div className="grid gap-2 sm:grid-cols-3">
            {socialTiles.map((tile) => (
              <div
                key={tile.label}
                className="rounded-lg border bg-background/60 p-3 flex items-center gap-3"
              >
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  <img src={tile.iconSrc} alt="" className="h-6 w-6" draggable={false} />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold tabular-nums leading-none">{tile.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{tile.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Preview of what a real card looks like once the customer has data */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {isAr ? "هتشوف هنا بعد أول طلب" : "What you'll see after the first order"}
            </p>
            <div className="rounded-lg border border-dashed bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {isAr ? "موثوق" : "Trustworthy"}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {isAr ? "مثال للعرض" : "example preview"}
                </span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <span><strong className="text-foreground tabular-nums">92%</strong> {isAr ? "استلام" : "delivery"}</span>
                <span className="text-border">•</span>
                <span><strong className="text-foreground tabular-nums">8</strong> {isAr ? "طلب" : "orders"}</span>
                <span className="text-border">•</span>
                <span><strong className="text-foreground tabular-nums">3</strong> {isAr ? "متاجر" : "stores"}</span>
                <span className="text-border">•</span>
                <span><strong className="text-foreground tabular-nums">22</strong> {isAr ? "خطر" : "risk"}</span>
              </div>
            </div>
          </div>

          {/* Footer hint: no setup, auto-updates */}
          <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            <p className="leading-relaxed">
              {isAr
                ? "البيانات بتتحدث تلقائيًا خلال ساعة من أول طلب COD. مفيش إعداد مطلوب."
                : "Stats refresh within an hour of the first COD order — no setup required."}
            </p>
          </div>
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
      action_en: "Safe to accept this COD order",
      action_ar: "آمن لقبول طلب COD",
    },
    caution: {
      icon: AlertTriangle,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      label_en: "Caution",
      label_ar: "تحذير",
      action_en: "Consider requiring a deposit",
      action_ar: "الأفضل تطلب عربون أو تأكيد إضافي",
    },
    risky: {
      icon: AlertCircle,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      label_en: "High Risk",
      label_ar: "خطر عالي",
      action_en: "Reject COD or require full prepayment",
      action_ar: "ارفض COD أو اطلب دفع كامل مقدمًا",
    },
  };

  const config = recommendationConfig[data.recommendation];
  const RecommendationIcon = config.icon;

  // Buckets derived from risk_score — gives the merchant a quick "where does
  // this buyer sit in the network" without needing a server-side percentile.
  // The numbers correspond to the same thresholds used for the recommendation
  // label in customers.py (40 / 70), so they always read consistently.
  const percentileLabel =
    data.risk_score < 20
      ? (isAr ? "أعلى ١٠٪ موثوقية في الشبكة" : "Top 10% trustworthy in network")
      : data.risk_score < 40
        ? (isAr ? "أعلى ٣٠٪ موثوقية" : "Top 30% trustworthy")
        : data.risk_score < 70
          ? (isAr ? "متوسط الشبكة" : "Average for network")
          : (isAr ? "أعلى ٢٠٪ خطورة" : "Bottom 20% — high risk");

  const deliveryScoreLabel =
    data.delivery_rate_pct >= 80
      ? (isAr ? "ممتاز" : "Excellent")
      : data.delivery_rate_pct >= 60
        ? (isAr ? "جيد" : "Good")
        : data.delivery_rate_pct >= 40
          ? (isAr ? "متوسط" : "Average")
          : (isAr ? "ضعيف" : "Poor");

  const confidenceLabel = data.confidence === "high"
    ? (isAr ? "عالية" : "high")
    : data.confidence === "medium"
      ? (isAr ? "متوسطة" : "medium")
      : (isAr ? "منخفضة" : "low");

  // Reasoning bullets — explain WHY this buyer got this recommendation, in
  // plain merchant language. Each bullet maps to a real data point so the
  // merchant can sanity-check the score instead of trusting a black box.
  const reasons: { tone: "good" | "bad" | "neutral"; text: string }[] = [];
  if (data.network_deliveries > 0) {
    reasons.push({
      tone: "good",
      text: isAr
        ? `${data.network_deliveries} طلب اتسلم بنجاح عبر ${data.contributing_store_count} ${data.contributing_store_count === 1 ? "متجر" : "متاجر"} في الشبكة`
        : `${data.network_deliveries} successful ${data.network_deliveries === 1 ? "delivery" : "deliveries"} across ${data.contributing_store_count} ${data.contributing_store_count === 1 ? "store" : "stores"} in the network`,
    });
  }
  if (data.network_rtos === 0 && data.network_orders > 0) {
    reasons.push({
      tone: "good",
      text: isAr ? "ولا مرتجع واحد في سجله" : "Zero rejections on record",
    });
  } else if (data.network_rtos > 0) {
    reasons.push({
      tone: "bad",
      text: isAr
        ? `${data.network_rtos} مرتجع (${data.rto_rate_pct}٪ من إجمالي طلباته)`
        : `${data.network_rtos} ${data.network_rtos === 1 ? "rejection" : "rejections"} (${data.rto_rate_pct}% of total)`,
    });
  }
  if (data.network_refunds > 0) {
    reasons.push({
      tone: "bad",
      text: isAr ? `${data.network_refunds} استرداد بعد التسليم` : `${data.network_refunds} post-delivery ${data.network_refunds === 1 ? "refund" : "refunds"}`,
    });
  }
  reasons.push({
    tone: "neutral",
    text: isAr
      ? `بناء على ${data.network_orders} طلب — ثقة ${confidenceLabel}${data.confidence === "low" ? " (الدقة بتزيد مع كل طلب جديد)" : ""}`
      : `Based on ${data.network_orders} ${data.network_orders === 1 ? "order" : "orders"} — ${confidenceLabel} confidence${data.confidence === "low" ? " (accuracy improves with more orders)" : ""}`,
  });

  return (
    <Card className={`border-2 ${config.border}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Network className="h-3.5 w-3.5 text-muted-foreground" />
            {isAr ? "نسبة الثقة في شبكة نمو" : "NUMU Network Trust"}
          </CardTitle>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>{percentileLabel}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recommendation banner — the headline. What the merchant should DO. */}
        <div className={`flex items-start gap-3 rounded-lg ${config.bg} ${config.border} border p-3`}>
          <RecommendationIcon className={`h-5 w-5 ${config.color} mt-0.5 shrink-0`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${config.color}`}>
                {isAr ? config.label_ar : config.label_en}
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-background/60 border text-muted-foreground">
                {isAr ? `درجة ${data.risk_score}/١٠٠` : `risk ${data.risk_score}/100`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAr ? config.action_ar : config.action_en}
            </p>
          </div>
        </div>

        {/* Stat tiles — the underlying numbers */}
        <div className="grid gap-3 sm:grid-cols-4">
          {/* Delivery Rate */}
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-1 mb-1">
              <Truck className="h-3 w-3 text-muted-foreground" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {isAr ? "نسبة الاستلام" : "Delivery Rate"}
              </p>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${data.delivery_rate_pct >= 70 ? "text-emerald-600 dark:text-emerald-400" : data.delivery_rate_pct >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
              {data.delivery_rate_pct}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{deliveryScoreLabel}</p>
          </div>

          {/* Network Orders */}
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-1 mb-1">
              <ShoppingCart className="h-3 w-3 text-muted-foreground" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {isAr ? "طلبات الشبكة" : "Network Orders"}
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums">{data.network_orders}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isAr
                ? `من ${data.contributing_store_count} ${data.contributing_store_count === 1 ? "متجر" : "متاجر"}`
                : `from ${data.contributing_store_count} ${data.contributing_store_count === 1 ? "store" : "stores"}`}
            </p>
          </div>

          {/* Rejections / RTOs */}
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-1 mb-1">
              <RotateCcw className="h-3 w-3 text-muted-foreground" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {isAr ? "مرتجعات" : "Rejections"}
              </p>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${data.network_rtos === 0 ? "text-emerald-600 dark:text-emerald-400" : data.rto_rate_pct < 20 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
              {data.network_rtos}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {data.network_rtos === 0
                ? (isAr ? "سجل نظيف" : "clean record")
                : `${data.rto_rate_pct}% ${isAr ? "من الكل" : "of total"}`}
            </p>
          </div>

          {/* Refunds */}
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-1 mb-1">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {isAr ? "مستردات" : "Refunds"}
              </p>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${data.network_refunds === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
              {data.network_refunds}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isAr ? "بعد التسليم" : "post-delivery"}
            </p>
          </div>
        </div>

        {/* "Why we recommend this" — reasoning breakdown */}
        <div className="rounded-lg border bg-muted/10 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold text-foreground">
              {isAr ? "ليه ده التقييم؟" : "Why this rating?"}
            </p>
          </div>
          <ul className="space-y-1">
            {reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] leading-relaxed">
                <span
                  className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${
                    r.tone === "good"
                      ? "bg-emerald-500"
                      : r.tone === "bad"
                        ? "bg-red-500"
                        : "bg-muted-foreground/40"
                  }`}
                />
                <span className={r.tone === "neutral" ? "text-muted-foreground" : "text-foreground"}>{r.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer with last activity */}
        {(data.last_order_at || data.last_rto_at) && (
          <div className="pt-3 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
            {data.last_order_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {isAr ? "آخر طلب: " : "Last order: "}
                {new Date(data.last_order_at).toLocaleDateString(isAr ? "ar-EG" : "en-US")}
              </span>
            )}
            {data.last_rto_at && (
              <span className="text-red-500/70 flex items-center gap-1">
                <RotateCcw className="h-3 w-3" />
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
