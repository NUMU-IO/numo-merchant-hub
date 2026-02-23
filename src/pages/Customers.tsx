import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, Search, ChevronLeft, ChevronRight, Mail, Phone } from "lucide-react";
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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on search change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  // React Query hook
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.customers")}</h1>
          <p className="text-sm text-muted-foreground">
            {isAr ? "إدارة عملاء متجرك" : "Manage your store customers"}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{isAr ? "إجمالي العملاء" : "Total Customers"}</p>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold mt-1">{total.toLocaleString(isAr ? "ar-EG" : undefined)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{isAr ? "لديهم طلبات" : "With Orders"}</p>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold mt-1">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{isAr ? "يقبلون التسويق" : "Accepts Marketing"}</p>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold mt-1">
              {customers.filter((c) => c.accepts_marketing).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{isAr ? "قائمة العملاء" : "Customer List"}</CardTitle>
            <div className="relative w-64">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isAr ? "بحث بالاسم أو الإيميل..." : "Search by name or email..."}
                className="ps-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {customers.length === 0 && !customersQuery.isFetching ? (
            <div className="text-center py-16 text-muted-foreground">
              {debouncedSearch
                ? (isAr ? "مفيش نتائج للبحث" : "No results found")
                : (isAr ? "مفيش عملاء لسه" : "No customers yet")}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isAr ? "الاسم" : "Name"}</TableHead>
                    <TableHead>{isAr ? "الإيميل" : "Email"}</TableHead>
                    <TableHead>{isAr ? "الموبايل" : "Phone"}</TableHead>
                    <TableHead>{isAr ? "الطلبات" : "Orders"}</TableHead>
                    <TableHead>{isAr ? "إجمالي الإنفاق" : "Total Spent"}</TableHead>
                    <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40">
                      <TableCell className="font-medium">{c.full_name || `${c.first_name} ${c.last_name}`}</TableCell>
                      <TableCell className="text-muted-foreground">{c.email}</TableCell>
                      <TableCell className="text-muted-foreground" dir="ltr">{c.phone || "—"}</TableCell>
                      <TableCell>{c.total_orders}</TableCell>
                      <TableCell className="tabular-nums">{formatCurrency(c.total_spent)}</TableCell>
                      <TableCell>
                        <Badge variant={c.is_verified ? "default" : "secondary"} className="text-xs">
                          {c.is_verified ? (isAr ? "مُفعّل" : "Verified") : (isAr ? "غير مُفعّل" : "Unverified")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    {isAr
                      ? `صفحة ${currentPage} من ${totalPages} (${total} عميل)`
                      : `Page ${currentPage} of ${totalPages} (${total} customers)`}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
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
