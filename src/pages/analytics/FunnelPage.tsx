import { FunnelTab } from "@/components/analytics/FunnelTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function FunnelContent() {
  const { period, formatCurrency } = useAnalyticsContext();
  return <FunnelTab period={period} formatCurrency={formatCurrency} />;
}

export default function FunnelPage() {
  return (
    <AnalyticsLayout
      title={{ en: "Conversion Funnel", ar: "قمع التحويل" }}
      subtitle={{ en: "Cart abandonment, drop-offs, and conversion rates", ar: "ترك السلة ومعدلات الانسحاب والتحويل" }}
    >
      <FunnelContent />
    </AnalyticsLayout>
  );
}
