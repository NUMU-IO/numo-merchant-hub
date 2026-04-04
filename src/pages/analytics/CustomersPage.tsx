import { CustomersTab } from "@/components/analytics/CustomersTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function CustomersContent() {
  const { period, formatCurrency } = useAnalyticsContext();
  return <CustomersTab period={period} formatCurrency={formatCurrency} />;
}

export default function CustomersPage() {
  return (
    <AnalyticsLayout>
      <CustomersContent />
    </AnalyticsLayout>
  );
}
