import { LiveTab } from "@/components/analytics/LiveTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function LiveContent() {
  const { formatCurrency } = useAnalyticsContext();
  return <LiveTab formatCurrency={formatCurrency} />;
}

export default function LivePage() {
  return (
    <AnalyticsLayout>
      <LiveContent />
    </AnalyticsLayout>
  );
}
