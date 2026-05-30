import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart3, DollarSign, ShoppingCart, RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  getSalesOverview, getSalesChart, getAnalyticsTopProducts,
  getSalesByLocation, getCustomerAnalytics, getConversionStats,
  getCodRejectionStats,
} from "@/services/analyticsApi";
import { AnalyticsSkeleton } from "@/components/skeletons/AnalyticsSkeleton";
import { OverviewTab } from "@/components/analytics/OverviewTab";
import { SalesTab } from "@/components/analytics/SalesTab";
import { OrdersTab } from "@/components/analytics/OrdersTab";

type Period = 7 | 30 | 90;

export default function Analytics() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";
  const queryClient = useQueryClient();

  const [period, setPeriod] = useState<Period>(30);
  const [activeTab, setActiveTab] = useState("overview");

  // Overview tab queries (always loaded for KPI cards visible across tabs)
  const overviewQuery = useQuery({
    queryKey: ["analytics", "overview", storeId, period],
    queryFn: () => getSalesOverview(storeId!, period),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const chartQuery = useQuery({
    queryKey: ["analytics", "chart", storeId, period],
    queryFn: () => getSalesChart(storeId!, period),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const topProductsQuery = useQuery({
    queryKey: ["analytics", "topProducts", storeId, period],
    queryFn: () => getAnalyticsTopProducts(storeId!, period, 5),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const locationsQuery = useQuery({
    queryKey: ["analytics", "locations", storeId, period],
    queryFn: () => getSalesByLocation(storeId!, period),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const customerStatsQuery = useQuery({
    queryKey: ["analytics", "customers", storeId, period],
    queryFn: () => getCustomerAnalytics(storeId!, period),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const conversionQuery = useQuery({
    queryKey: ["analytics", "conversion", storeId, period],
    queryFn: () => getConversionStats(storeId!, period),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const codRejectionQuery = useQuery({
    queryKey: ["analytics", "codRejections", storeId, period],
    queryFn: () => getCodRejectionStats(storeId!, period),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const overview = overviewQuery.data ?? null;
  const chartData = chartQuery.data ?? [];
  const topProducts = topProductsQuery.data ?? [];
  const locations = locationsQuery.data ?? [];
  const customerStats = customerStatsQuery.data ?? null;
  const conversion = conversionQuery.data ?? null;
  const codRejection = codRejectionQuery.data ?? null;

  const isLoading = overviewQuery.isLoading;
  const isRefetching = overviewQuery.isFetching;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
  };

  const formatCurrency = (cents: number) => {
    const val = cents / 100;
    return isAr ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;
  };

  const periodLabels: Record<Period, string> = {
    7: isAr ? "٧ أيام" : "7 days",
    30: isAr ? "٣٠ يوم" : "30 days",
    90: isAr ? "٩٠ يوم" : "90 days",
  };

  const tabs = [
    { value: "overview", label: isAr ? "نظرة عامة" : "Overview", icon: BarChart3 },
    { value: "sales", label: isAr ? "المبيعات" : "Sales", icon: DollarSign },
    { value: "orders", label: isAr ? "الطلبات" : "Orders", icon: ShoppingCart },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{t("nav.analytics")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr ? "تقارير وإحصائيات متجرك" : "Your store reports and statistics"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5 rounded-lg bg-muted/60 p-0.5">
            {([7, 30, 90] as Period[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? "default" : "ghost"}
                size="sm"
                className={`h-7 text-[11px] px-2.5 rounded-md ${period === p ? "" : "text-muted-foreground"}`}
                onClick={() => setPeriod(p)}
              >
                {periodLabels[p]}
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={handleRefresh} disabled={isRefetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isLoading && !overview ? (
        <AnalyticsSkeleton />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/60 h-9">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-[12px] gap-1.5 data-[state=active]:bg-background"
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <OverviewTab
              overview={overview}
              chartData={chartData}
              topProducts={topProducts}
              locations={locations}
              customerStats={customerStats}
              conversion={conversion}
              codRejection={codRejection}
              formatCurrency={formatCurrency}
            />
          </TabsContent>

          <TabsContent value="sales" className="mt-4">
            <SalesTab period={period} formatCurrency={formatCurrency} />
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <OrdersTab period={period} formatCurrency={formatCurrency} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
