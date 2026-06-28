import { ProductsTab } from "@/components/analytics/ProductsTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function ProductsContent() {
  const { range, formatCurrency } = useAnalyticsContext();
  return <ProductsTab range={range} formatCurrency={formatCurrency} />;
}

export default function ProductsPage() {
  return (
    <AnalyticsLayout
      title={{ en: "Product Performance", ar: "أداء المنتجات" }}
      subtitle={{ en: "Bestsellers, inventory health, and category breakdown", ar: "الأكثر مبيعاً وصحة المخزون وتوزيع الفئات" }}
    >
      <ProductsContent />
    </AnalyticsLayout>
  );
}
