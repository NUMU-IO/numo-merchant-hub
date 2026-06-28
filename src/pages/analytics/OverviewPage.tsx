import { useDashboardStore } from "@/contexts/StoreContext";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  getSalesOverview, getSalesChart, getAnalyticsTopProducts,
  getSalesByLocation, getCustomerAnalytics, getConversionStats,
  getCodRejectionStats,
} from "@/services/analyticsApi";
import { dateRangeKey } from "@/services/dateRangeParams";
import { AnalyticsSkeleton } from "@/components/skeletons/AnalyticsSkeleton";
import { OverviewTab } from "@/components/analytics/OverviewTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function OverviewContent() {
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const { range, formatCurrency } = useAnalyticsContext();
  const rangeKey = dateRangeKey(range);

  const overviewQuery = useQuery({
    queryKey: ["analytics", "overview", storeId, ...rangeKey],
    queryFn: () => getSalesOverview(storeId!, range),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const chartQuery = useQuery({
    queryKey: ["analytics", "chart", storeId, ...rangeKey],
    queryFn: () => getSalesChart(storeId!, range),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const topProductsQuery = useQuery({
    queryKey: ["analytics", "topProducts", storeId, ...rangeKey],
    queryFn: () => getAnalyticsTopProducts(storeId!, range, 5),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const locationsQuery = useQuery({
    queryKey: ["analytics", "locations", storeId, ...rangeKey],
    queryFn: () => getSalesByLocation(storeId!, range),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const customerStatsQuery = useQuery({
    queryKey: ["analytics", "customers", storeId, ...rangeKey],
    queryFn: () => getCustomerAnalytics(storeId!, range),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const conversionQuery = useQuery({
    queryKey: ["analytics", "conversion", storeId, ...rangeKey],
    queryFn: () => getConversionStats(storeId!, range),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const codRejectionQuery = useQuery({
    queryKey: ["analytics", "codRejections", storeId, ...rangeKey],
    queryFn: () => getCodRejectionStats(storeId!, range),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const overview = overviewQuery.data ?? null;
  const isLoading = overviewQuery.isLoading;

  if (isLoading && !overview) return <AnalyticsSkeleton />;

  return (
    <OverviewTab
      overview={overview}
      chartData={chartQuery.data ?? []}
      topProducts={topProductsQuery.data ?? []}
      locations={locationsQuery.data ?? []}
      customerStats={customerStatsQuery.data ?? null}
      conversion={conversionQuery.data ?? null}
      codRejection={codRejectionQuery.data ?? null}
      formatCurrency={formatCurrency}
    />
  );
}

export default function OverviewPage() {
  return (
    <AnalyticsLayout
      title={{ en: "Overview", ar: "نظرة عامة" }}
      subtitle={{ en: "Key metrics and performance summary", ar: "ملخص الأداء والمقاييس الأساسية" }}
    >
      <OverviewContent />
    </AnalyticsLayout>
  );
}
