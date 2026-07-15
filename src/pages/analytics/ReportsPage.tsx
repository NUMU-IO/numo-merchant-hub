import { ReportsTab } from "@/components/analytics/ReportsTab";
import { ReportBuilder } from "@/components/analytics/ReportBuilder";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function ReportsContent() {
  const { range, formatCurrency } = useAnalyticsContext();
  return (
    <div className="space-y-4">
      {/* Custom report builder (item 10) — pick a metric × dimension.
          Sits above the fixed report catalog below. */}
      <ReportBuilder range={range} formatCurrency={formatCurrency} />
      <ReportsTab range={range} formatCurrency={formatCurrency} />
    </div>
  );
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
