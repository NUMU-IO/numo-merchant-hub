import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Receipt } from "lucide-react";
import {
  fetchInvoiceSettings,
  updateInvoiceSettings,
} from "@/services/storeApi";

const TaxInvoicing = () => {
  const { language } = useLanguage();
  const { currentStore, refetchStores } = useDashboardStore();

  const [taxState, setTaxState] = useState({
    tax_id: "", name_ar: "", branch_id: "0", activity_code: "4649",
    governorate: "", city: "", street: "", building_number: "",
  });
  const [isSavingTax, setIsSavingTax] = useState(false);

  useEffect(() => {
    if (!currentStore?.id) return;
    fetchInvoiceSettings(currentStore.id)
      .then((inv) => {
        setTaxState({
          tax_id: inv.tax_id || "",
          name_ar: inv.name_ar || "",
          branch_id: inv.branch_id || "0",
          activity_code: inv.activity_code || "4649",
          governorate: inv.governorate || "",
          city: inv.city || "",
          street: inv.street || "",
          building_number: inv.building_number || "",
        });
      })
      .catch(() => {
        const storeData = currentStore as unknown as Record<string, Record<string, string> | undefined>;
        const s = storeData.settings ?? {};
        const a = storeData.address ?? {};
        setTaxState({
          tax_id: s.tax_id || "",
          name_ar: s.name_ar || "",
          branch_id: s.branch_id || "0",
          activity_code: s.activity_code || "4649",
          governorate: a.governorate || "",
          city: a.city || "",
          street: a.street || "",
          building_number: a.building_number || "",
        });
      });
  }, [currentStore?.id]);

  const saveTaxSettings = useCallback(async () => {
    if (!currentStore?.id) return;
    setIsSavingTax(true);
    try {
      await updateInvoiceSettings(currentStore.id, taxState);
      await refetchStores();
      toast.success(language === "ar" ? "تم حفظ إعدادات الضرائب" : "Tax settings saved");
    } catch {
      toast.error(language === "ar" ? "فشل حفظ إعدادات الضرائب" : "Failed to save tax settings");
    } finally {
      setIsSavingTax(false);
    }
  }, [currentStore?.id, taxState, refetchStores, language]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Receipt className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">
          {language === "ar" ? "الضرائب والفواتير" : "Tax & Invoicing"}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === "ar" ? "إعدادات الضرائب والفواتير" : "Tax & Invoice Settings"}</CardTitle>
          <CardDescription>
            {language === "ar"
              ? "بيانات البائع التي تظهر في الفاتورة الإلكترونية (ETA)"
              : "Seller information that appears on ETA electronic invoices"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tax Registration */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {language === "ar" ? "التسجيل الضريبي" : "Tax Registration"}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>{language === "ar" ? "الرقم الضريبي" : "Tax ID (Registration Number)"}</Label>
                <Input
                  value={taxState.tax_id}
                  onChange={(e) => setTaxState((p) => ({ ...p, tax_id: e.target.value }))}
                  placeholder={language === "ar" ? "مثل: 123456789" : "e.g. 123456789"}
                  dir="ltr"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{language === "ar" ? "اسم المتجر بالعربية" : "Store Name (Arabic)"}</Label>
                <Input
                  value={taxState.name_ar}
                  onChange={(e) => setTaxState((p) => ({ ...p, name_ar: e.target.value }))}
                  placeholder={language === "ar" ? "اسم المتجر كما يظهر بالفاتورة" : "Store name as shown on invoice"}
                  dir="rtl"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{language === "ar" ? "رقم الفرع" : "Branch ID"}</Label>
                <Input
                  value={taxState.branch_id}
                  onChange={(e) => setTaxState((p) => ({ ...p, branch_id: e.target.value }))}
                  placeholder="0"
                  dir="ltr"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{language === "ar" ? "كود النشاط" : "Activity Code"}</Label>
                <Input
                  value={taxState.activity_code}
                  onChange={(e) => setTaxState((p) => ({ ...p, activity_code: e.target.value }))}
                  placeholder="4649"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Business Address */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {language === "ar" ? "عنوان النشاط التجاري" : "Business Address"}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>{language === "ar" ? "المحافظة" : "Governorate"}</Label>
                <Input
                  value={taxState.governorate}
                  onChange={(e) => setTaxState((p) => ({ ...p, governorate: e.target.value }))}
                  placeholder={language === "ar" ? "مثل: القاهرة" : "e.g. Cairo"}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{language === "ar" ? "المدينة" : "City"}</Label>
                <Input
                  value={taxState.city}
                  onChange={(e) => setTaxState((p) => ({ ...p, city: e.target.value }))}
                  placeholder={language === "ar" ? "مثل: مدينة نصر" : "e.g. Nasr City"}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{language === "ar" ? "الشارع" : "Street"}</Label>
                <Input
                  value={taxState.street}
                  onChange={(e) => setTaxState((p) => ({ ...p, street: e.target.value }))}
                  placeholder={language === "ar" ? "مثل: شارع التحرير" : "e.g. Tahrir St."}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{language === "ar" ? "رقم المبنى" : "Building Number"}</Label>
                <Input
                  value={taxState.building_number}
                  onChange={(e) => setTaxState((p) => ({ ...p, building_number: e.target.value }))}
                  placeholder={language === "ar" ? "مثل: 15" : "e.g. 15"}
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={saveTaxSettings} disabled={isSavingTax} className="gap-2">
              {isSavingTax && <Loader2 className="h-4 w-4 animate-spin" />}
              {language === "ar" ? "حفظ إعدادات الضرائب" : "Save Tax Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaxInvoicing;
