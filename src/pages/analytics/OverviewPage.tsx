import { useDashboardStore } from "@/contexts/StoreContext";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  getSalesOverview, getSalesChart, getAnalyticsTopProducts,
  getSalesByLocation, getCustomerAnalytics, getConversionStats,
  getCodRejectionStats,
} from "@/services/analyticsApi";
import { AnalyticsSkeleton } from "@/components/skeletons/AnalyticsSkeleton";
import { OverviewTab } from "@/components/analytics/OverviewTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function OverviewContent() {
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const { period, formatCurrency } = useAnalyticsContext();

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
    <AnalyticsLayout>
      <OverviewContent />
    </AnalyticsLayout>
  );
}
