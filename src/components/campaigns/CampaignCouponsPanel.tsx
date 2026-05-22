/**
 * CampaignCouponsPanel — issue + list discount codes attached to a campaign.
 *
 * Code is auto-generated server-side as
 * ``<CAMPAIGN-SLUG>-<6-char Crockford>`` (e.g. ``EID-SALE-AB7K9X``) —
 * the merchant only picks the discount mechanics. Issued codes appear
 * in the table below the form, newest first, with their redemption
 * count so the merchant can spot which code is pulling.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Copy, Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  issueCampaignCoupon,
  listCampaignCoupons,
  type CampaignCouponResponse,
} from "@/services/campaignApi";
import { showError } from "@/lib/show-error";

interface CampaignCouponsPanelProps {
  storeId: string;
  campaignId: string;
}

export function CampaignCouponsPanel({
  storeId,
  campaignId,
}: CampaignCouponsPanelProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [coupons, setCoupons] = useState<CampaignCouponResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [couponType, setCouponType] = useState<"percentage" | "fixed">(
    "percentage",
  );
  const [value, setValue] = useState("10");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [validUntil, setValidUntil] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listCampaignCoupons(storeId, campaignId);
      setCoupons(rows);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [storeId, campaignId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleIssue = async () => {
    const numericValue = parseFloat(value);
    if (!isFinite(numericValue) || numericValue <= 0) {
      toast.error(isAr ? "أدخل قيمة صحيحة" : "Enter a valid value");
      return;
    }
    if (couponType === "percentage" && numericValue > 100) {
      toast.error(
        isAr ? "النسبة لا تتجاوز 100" : "Percentage cannot exceed 100",
      );
      return;
    }

    setIssuing(true);
    try {
      const created = await issueCampaignCoupon(storeId, campaignId, {
        coupon_type: couponType,
        value: numericValue,
        min_order_amount: minOrderAmount ? parseFloat(minOrderAmount) : null,
        max_discount_amount: maxDiscountAmount
          ? parseFloat(maxDiscountAmount)
          : null,
        usage_limit: usageLimit ? parseInt(usageLimit, 10) : null,
        valid_until: validUntil
          ? new Date(validUntil).toISOString()
          : null,
      });
      setCoupons((prev) => [created, ...prev]);
      toast.success(
        isAr
          ? `تم إصدار الكود ${created.code}`
          : `Issued code ${created.code}`,
      );
      // Reset form to sensible defaults but keep the type selection.
      setValue("10");
      setMinOrderAmount("");
      setMaxDiscountAmount("");
      setUsageLimit("");
      setValidUntil("");
    } catch (err) {
      showError(err);
    } finally {
      setIssuing(false);
    }
  };

  const handleCopy = async (coupon: CampaignCouponResponse) => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopiedId(coupon.id);
      toast.success(isAr ? "تم نسخ الكود" : "Code copied");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error(isAr ? "فشل النسخ" : "Failed to copy");
    }
  };

  const formatDiscount = (c: CampaignCouponResponse): string => {
    if (c.coupon_type === "percentage") return `${c.value}%`;
    if (c.coupon_type === "fixed") return `EGP ${c.value}`;
    return c.coupon_type;
  };

  return (
    <div className="space-y-4">
      {/* Issuance form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            {isAr ? "إصدار كود خصم" : "Issue a discount code"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-type">
                {isAr ? "نوع الخصم" : "Discount type"}
              </Label>
              <Select
                value={couponType}
                onValueChange={(v) =>
                  setCouponType(v as "percentage" | "fixed")
                }
              >
                <SelectTrigger id="coupon-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">
                    {isAr ? "نسبة مئوية" : "Percentage"}
                  </SelectItem>
                  <SelectItem value="fixed">
                    {isAr ? "مبلغ ثابت" : "Fixed amount"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-value">
                {couponType === "percentage"
                  ? isAr ? "النسبة (٪)" : "Percentage (%)"
                  : isAr ? "المبلغ (ج.م)" : "Amount (EGP)"}
              </Label>
              <Input
                id="coupon-value"
                type="number"
                step="0.01"
                dir="ltr"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={couponType === "percentage" ? "10" : "50"}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="min-order">
                {isAr ? "الحد الأدنى للطلب" : "Min order amount"}
              </Label>
              <Input
                id="min-order"
                type="number"
                step="0.01"
                dir="ltr"
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                placeholder={isAr ? "اختياري" : "Optional"}
              />
            </div>
            {couponType === "percentage" && (
              <div className="space-y-1.5">
                <Label htmlFor="max-discount">
                  {isAr ? "أقصى خصم" : "Max discount cap"}
                </Label>
                <Input
                  id="max-discount"
                  type="number"
                  step="0.01"
                  dir="ltr"
                  value={maxDiscountAmount}
                  onChange={(e) => setMaxDiscountAmount(e.target.value)}
                  placeholder={isAr ? "اختياري" : "Optional"}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="usage-limit">
                {isAr ? "عدد الاستخدامات" : "Usage limit"}
              </Label>
              <Input
                id="usage-limit"
                type="number"
                step="1"
                dir="ltr"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder={isAr ? "بلا حد" : "Unlimited"}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="valid-until">
              {isAr ? "ينتهي في" : "Expires at"}
            </Label>
            <Input
              id="valid-until"
              type="datetime-local"
              dir="ltr"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>

          <Button
            type="button"
            onClick={handleIssue}
            disabled={issuing}
            className="gap-2"
          >
            {issuing && <Loader2 className="h-4 w-4 animate-spin" />}
            {isAr ? "إصدار الكود" : "Issue code"}
          </Button>
        </CardContent>
      </Card>

      {/* Issued codes list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isAr ? "الأكواد المُصدرة" : "Issued codes"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isAr ? "جارٍ التحميل…" : "Loading…"}
            </div>
          ) : coupons.length === 0 ? (
            <EmptyState
              icon={Tag}
              title={isAr ? "لم تُصدر أكواد بعد" : "No codes issued yet"}
              description={
                isAr
                  ? "أصدر أول كود خصم مرتبط بهذه الحملة من النموذج بالأعلى"
                  : "Issue your first campaign-attached discount code from the form above"
              }
              className="py-6"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-start font-medium text-muted-foreground p-2">
                      {isAr ? "الكود" : "Code"}
                    </th>
                    <th className="text-start font-medium text-muted-foreground p-2">
                      {isAr ? "الخصم" : "Discount"}
                    </th>
                    <th className="text-end font-medium text-muted-foreground p-2">
                      {isAr ? "الاستخدامات" : "Used"}
                    </th>
                    <th className="text-start font-medium text-muted-foreground p-2">
                      {isAr ? "ينتهي في" : "Expires"}
                    </th>
                    <th className="text-end font-medium text-muted-foreground p-2">
                      {isAr ? "نسخ" : "Copy"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-2 font-mono">{c.code}</td>
                      <td className="p-2">{formatDiscount(c)}</td>
                      <td className="text-end p-2 tabular-nums">
                        {c.usage_count}
                        {c.usage_limit !== null && (
                          <span className="text-muted-foreground"> / {c.usage_limit}</span>
                        )}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {c.valid_until
                          ? new Date(c.valid_until).toLocaleDateString(
                              isAr ? "ar-EG" : undefined,
                            )
                          : "—"}
                      </td>
                      <td className="text-end p-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(c)}
                          className="gap-1.5"
                        >
                          {copiedId === c.id ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
