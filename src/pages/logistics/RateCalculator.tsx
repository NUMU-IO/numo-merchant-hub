import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useReferenceGovernorates } from "@/hooks/useShippingZones";
import {
  calculateShippingPreview,
  type ShippingOption,
  type FreeShippingProgress as FreeShippingProgressData,
} from "@/services/shippingApi";
import { Calculator, Truck } from "lucide-react";

const RateCalculator = () => {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";

  const { data: governorates = [] } = useReferenceGovernorates(
    isAr ? "ar" : "en",
  );

  const [code, setCode] = useState("");
  const [weight, setWeight] = useState("1");
  const [subtotal, setSubtotal] = useState("500");
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [progress, setProgress] = useState<FreeShippingProgressData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async () => {
    if (!currentStore?.id || !code) return;
    setLoading(true);
    setError(null);
    try {
      const result = await calculateShippingPreview(currentStore.id, {
        governorate_code: code,
        cart_subtotal_cents: Math.round(parseFloat(subtotal || "0") * 100),
        cart_weight_g: Math.round(parseFloat(weight || "0") * 1000),
      });
      setOptions(result.options);
      setProgress(result.free_shipping_progress);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setOptions([]);
      setProgress(null);
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
          {isAr
            ? "معاينة أسعار الشحن التي يراها العميل فعلًا عند الدفع."
            : "Preview the shipping rates customers actually see at checkout."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {isAr ? "بيانات الشحنة" : "Shipment details"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1 block text-xs">
              {isAr ? "المحافظة" : "Governorate"}
            </Label>
            <Select value={code} onValueChange={setCode}>
              <SelectTrigger>
                <SelectValue
                  placeholder={isAr ? "اختر المحافظة" : "Select governorate"}
                />
              </SelectTrigger>
              <SelectContent>
                {governorates.map((g) => (
                  <SelectItem key={g.code} value={g.code}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">
                {isAr ? "إجمالي العربة (ج.م)" : "Cart subtotal (EGP)"}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={subtotal}
                onChange={(e) => setSubtotal(e.target.value)}
                dir="ltr"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">
                {isAr ? "الوزن (كجم)" : "Weight (kg)"}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          <Button onClick={handleCalculate} disabled={loading || !code}>
            <Truck className="h-4 w-4 me-2" />
            {loading
              ? isAr
                ? "جارٍ الحساب…"
                : "Calculating…"
              : isAr
              ? "احسب التكلفة"
              : "Calculate"}
          </Button>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      {!loading && options.length === 0 && code && !error && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {isAr
              ? "لا تشمل مناطق الشحن لديك هذه المحافظة."
              : "Your shipping zones don't cover this governorate."}
          </CardContent>
        </Card>
      )}

      {options.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isAr ? "الخيارات المتاحة" : "Available options"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {options.map((o) => (
              <div
                key={o.rate_id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {isAr && o.label_ar ? o.label_ar : o.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.estimated_days_min === o.estimated_days_max
                      ? isAr
                        ? `${o.estimated_days_min} يوم`
                        : `${o.estimated_days_min} day`
                      : isAr
                      ? `${o.estimated_days_min}–${o.estimated_days_max} يوم`
                      : `${o.estimated_days_min}–${o.estimated_days_max} days`}
                    {o.cod_supported && (
                      <span className="ms-2">
                        {isAr ? "· يقبل الدفع عند الاستلام" : "· COD available"}
                      </span>
                    )}
                  </p>
                </div>
                <p className="text-sm font-bold">
                  {o.amount_cents === 0
                    ? isAr
                      ? "مجاني"
                      : "Free"
                    : `${(o.amount_cents / 100).toFixed(2)} ${o.currency}`}
                </p>
              </div>
            ))}

            {progress && !progress.qualified && progress.remaining_cents > 0 && (
              <p className="pt-2 text-xs text-muted-foreground">
                {isAr
                  ? `أضف ${(progress.remaining_cents / 100).toFixed(0)} ج.م للحصول على شحن مجاني.`
                  : `Add ${(progress.remaining_cents / 100).toFixed(0)} EGP for free shipping.`}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RateCalculator;
