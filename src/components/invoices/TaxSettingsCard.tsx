/**
 * Seller tax / VAT settings — captures the merchant's tax registration
 * number (TRN) and legal Arabic name used on every invoice.
 *
 * For Saudi stores the TRN is the 15-digit ZATCA number that gets encoded
 * into the e-invoice QR; without it the QR is incomplete and won't clear.
 * We validate the Saudi format client-side (the backend re-validates) and
 * surface a Saudi-specific label/hint.
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  getInvoiceSettings,
  updateInvoiceSettings,
} from "@/services/invoiceApi";

interface Props {
  storeId: string;
  isAr: boolean;
  country: string;
}

/** Saudi ZATCA TRN: 15 digits, starts and ends with "3". */
function isValidSaudiTrn(v: string): boolean {
  const c = v.replace(/[\s-]/g, "");
  return /^\d{15}$/.test(c) && c.startsWith("3") && c.endsWith("3");
}

export default function TaxSettingsCard({ storeId, isAr, country }: Props) {
  const isSaudi = (country || "EG").toUpperCase() === "SA";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [taxId, setTaxId] = useState("");
  const [nameAr, setNameAr] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getInvoiceSettings(storeId)
      .then((s) => {
        if (cancelled) return;
        setTaxId(s.tax_id || "");
        setNameAr(s.name_ar || "");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const trnInvalid = isSaudi && taxId.trim().length > 0 && !isValidSaudiTrn(taxId);

  const handleSave = async () => {
    if (trnInvalid) return;
    setSaving(true);
    try {
      const updated = await updateInvoiceSettings(storeId, {
        tax_id: taxId.trim(),
        name_ar: nameAr.trim(),
      });
      setTaxId(updated.tax_id || "");
      setNameAr(updated.name_ar || "");
      toast.success(isAr ? "تم حفظ البيانات الضريبية" : "Tax settings saved");
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          {isAr ? "البيانات الضريبية للفاتورة" : "Invoice tax settings"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {isAr ? "تحميل…" : "Loading…"}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[12px] font-medium">
                  {isSaudi
                    ? isAr
                      ? "الرقم الضريبي (TRN)"
                      : "VAT Number (TRN)"
                    : isAr
                      ? "الرقم الضريبي"
                      : "Tax ID"}
                </Label>
                <Input
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder={isSaudi ? "3XXXXXXXXXXXX3" : isAr ? "٩ أرقام" : "9 digits"}
                  className="h-9 text-sm font-mono"
                  inputMode="numeric"
                  aria-invalid={trnInvalid}
                />
                {isSaudi && (
                  <p className={`text-[11px] ${trnInvalid ? "text-destructive" : "text-muted-foreground"}`}>
                    {isAr
                      ? "١٥ رقماً، يبدأ وينتهي بـ 3 — يظهر في رمز ZATCA على كل فاتورة."
                      : "15 digits, starts and ends with 3 — encoded into the ZATCA QR on every invoice."}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] font-medium">
                  {isAr ? "اسم النشاط (عربي)" : "Business name (Arabic)"}
                </Label>
                <Input
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  dir="rtl"
                  className="h-9 text-sm"
                  placeholder={isAr ? "الاسم القانوني للمتجر" : "Legal store name"}
                />
              </div>
            </div>
            <Button size="sm" className="h-8 text-xs gap-1.5" disabled={saving || trnInvalid} onClick={handleSave}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              {isAr ? "حفظ" : "Save"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
