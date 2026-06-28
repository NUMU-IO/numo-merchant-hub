import { FunnelTab } from "@/components/analytics/FunnelTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function FunnelContent() {
  const { range, formatCurrency } = useAnalyticsContext();
  return <FunnelTab range={range} formatCurrency={formatCurrency} />;
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
