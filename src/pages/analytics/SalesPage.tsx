import { SalesTab } from "@/components/analytics/SalesTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function SalesContent() {
  const { period, formatCurrency } = useAnalyticsContext();
  return <SalesTab period={period} formatCurrency={formatCurrency} />;
}

export default function SalesPage() {
  return (
    <AnalyticsLayout>
      <SalesContent />
    </AnalyticsLayout>
  );
}
