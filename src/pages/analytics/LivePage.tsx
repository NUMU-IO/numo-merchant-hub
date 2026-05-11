import { LiveTab } from "@/components/analytics/LiveTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function LiveContent() {
  const { formatCurrency } = useAnalyticsContext();
  return <LiveTab formatCurrency={formatCurrency} />;
}

export default function LivePage() {
  return (
    <AnalyticsLayout
      title={{ en: "Live Dashboard", ar: "لوحة مباشرة" }}
      subtitle={{ en: "Real-time visitors, orders, and revenue", ar: "الزوار والطلبات والإيرادات لحظة بلحظة" }}
      showPeriod={false}
    >
      <LiveContent />
    </AnalyticsLayout>
  );
}
