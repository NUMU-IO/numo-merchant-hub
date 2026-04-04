import { FunnelTab } from "@/components/analytics/FunnelTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function FunnelContent() {
  const { period, formatCurrency } = useAnalyticsContext();
  return <FunnelTab period={period} formatCurrency={formatCurrency} />;
}

export default function FunnelPage() {
  return (
    <AnalyticsLayout>
      <FunnelContent />
    </AnalyticsLayout>
  );
}
