import { OrdersTab } from "@/components/analytics/OrdersTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function OrdersContent() {
  const { period, formatCurrency } = useAnalyticsContext();
  return <OrdersTab period={period} formatCurrency={formatCurrency} />;
}

export default function OrdersPage() {
  return (
    <AnalyticsLayout>
      <OrdersContent />
    </AnalyticsLayout>
  );
}
