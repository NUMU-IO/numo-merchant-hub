import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, Search, ChevronLeft, ChevronRight, Mail, ShieldCheck, UserCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { listCustomers } from "@/services/customerApi";
import type { Customer } from "@/services/customerApi";
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

  const activeCount = customers.filter((c) => c.total_orders > 0).length;

  if (customersQuery.isLoading && customers.length === 0) {
    return <CustomersSkeleton />;
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("nav.customers")}</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {isAr ? "إدارة عملاء متجرك" : "Manage your store customers"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: isAr ? "إجمالي العملاء" : "Total Customers", value: total, icon: Users, bg: "bg-blue-500/8 dark:bg-blue-500/15", iconColor: "text-blue-600 dark:text-blue-400" },
          { label: isAr ? "لديهم طلبات" : "With Orders", value: activeCount, icon: UserCheck, bg: "bg-emerald-500/8 dark:bg-emerald-500/15", iconColor: "text-emerald-600 dark:text-emerald-400" },
          { label: isAr ? "يقبلون التسويق" : "Accepts Marketing", value: customers.filter((c) => c.accepts_marketing).length, icon: Mail, bg: "bg-violet-500/8 dark:bg-violet-500/15", iconColor: "text-violet-600 dark:text-violet-400" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-3.5 w-3.5 ${stat.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">{stat.value.toLocaleString(isAr ? "ar-EG" : undefined)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Customer Table */}
      <Card className="border-border/60">
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
                title={debouncedSearch ? (isAr ? "مفيش نتائج للبحث" : "No results found") : (isAr ? "مفيش عملاء لسه" : "No customers yet")}
                description={debouncedSearch ? undefined : (isAr ? "سيظهر العملاء هنا مع أول طلب" : "Customers will appear here with your first order")}
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
                    <TableRow key={c.id} className="table-row-interactive border-border/30">
                      <TableCell className="font-medium text-[13px] py-3 ps-5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/8 text-[10px] font-bold text-primary shrink-0">
                            {(c.full_name || c.first_name || "?").charAt(0).toUpperCase()}
                          </div>
                          {c.full_name || `${c.first_name} ${c.last_name}`}
                        </div>
                      </TableCell>
                      <TableCell className="text-[13px] text-muted-foreground py-3">{c.email}</TableCell>
                      <TableCell className="text-[13px] text-muted-foreground py-3" dir="ltr">{c.phone || "—"}</TableCell>
                      <TableCell className="text-[13px] py-3 text-center tabular-nums font-medium">{c.total_orders}</TableCell>
                      <TableCell className="text-[13px] tabular-nums font-medium py-3">{formatCurrency(c.total_spent)}</TableCell>
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
