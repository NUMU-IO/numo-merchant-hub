import { ProductsTab } from "@/components/analytics/ProductsTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function ProductsContent() {
  const { period, formatCurrency } = useAnalyticsContext();
  return <ProductsTab period={period} formatCurrency={formatCurrency} />;
}

export default function ProductsPage() {
  return (
    <AnalyticsLayout>
      <ProductsContent />
    </AnalyticsLayout>
  );
}
