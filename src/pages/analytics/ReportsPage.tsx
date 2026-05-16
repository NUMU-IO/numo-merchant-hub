import { ReportsTab } from "@/components/analytics/ReportsTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function ReportsContent() {
  const { range, formatCurrency } = useAnalyticsContext();
  return <ReportsTab range={range} formatCurrency={formatCurrency} />;
}

export default function ReportsPage() {
  return (
    <AnalyticsLayout
      title={{ en: "Reports", ar: "التقارير" }}
      subtitle={{ en: "Detailed reports across sales, inventory and more", ar: "تقارير تفصيلية للمبيعات والمخزون وغيرها" }}
    >
      <ReportsContent />
    </AnalyticsLayout>
  );
}
