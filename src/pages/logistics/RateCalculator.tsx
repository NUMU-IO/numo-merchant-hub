import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { apiClient } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, Calculator } from "lucide-react";

interface ShippingQuote {
  carrier: string;
  service: string;
  amount_cents: number;
  currency: string;
  estimated_days: number | null;
}

const GOVERNORATES = [
  "القاهرة", "الجيزة", "الإسكندرية", "المنصورة", "طنطا",
  "أسيوط", "الزقازيق", "بورسعيد", "السويس", "الفيوم",
  "المنيا", "سوهاج", "قنا", "الأقصر", "أسوان",
  "دمياط", "كفر الشيخ", "الغربية", "البحيرة", "شمال سيناء",
];

const RateCalculator = () => {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";

  const [city, setCity] = useState("");
  const [weight, setWeight] = useState("1");
  const [rates, setRates] = useState<ShippingQuote[]>([]);
  const [loading, setLoading] = useState(false);

  const handleCalculate = async () => {
    if (!currentStore?.id || !city) return;
    setLoading(true);
    try {
      const result = await apiClient<ShippingQuote[]>(
        `/storefront/store/${currentStore.id}/shipping/quote`,
        {
          method: "POST",
          body: JSON.stringify({
            destination_city: city,
            destination_country: "EG",
            weight_kg: parseFloat(weight) || 1,
          }),
        }
      );
      setRates(result);
    } catch {
      setRates([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="h-6 w-6" />
          {isAr ? "حاسبة تكاليف الشحن" : "Shipping Rate Calculator"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isAr ? "احسب تكلفة الشحن لأي محافظة" : "Calculate shipping costs to any governorate"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isAr ? "بيانات الشحنة" : "Shipment Details"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{isAr ? "المحافظة / المدينة" : "Governorate / City"}</Label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">{isAr ? "اختر المحافظة" : "Select governorate"}</option>
              {GOVERNORATES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <Label>{isAr ? "الوزن (كجم)" : "Weight (kg)"}</Label>
            <Input
              type="number"
              min="0.1"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              dir="ltr"
            />
          </div>

          <Button onClick={handleCalculate} disabled={loading || !city}>
            <Truck className="h-4 w-4 me-2" />
            {loading ? (isAr ? "جاري الحساب..." : "Calculating...") : (isAr ? "احسب التكلفة" : "Calculate")}
          </Button>
        </CardContent>
      </Card>

      {rates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{isAr ? "الأسعار المتاحة" : "Available Rates"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rates.map((rate, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{rate.carrier} — {rate.service}</p>
                    {rate.estimated_days && (
                      <p className="text-xs text-muted-foreground">
                        {isAr ? `${rate.estimated_days} يوم تقريباً` : `~${rate.estimated_days} days`}
                      </p>
                    )}
                  </div>
                  <p className="font-bold text-sm">
                    {(rate.amount_cents / 100).toFixed(2)} {rate.currency}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RateCalculator;
