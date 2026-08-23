import { useTranslation } from "react-i18next";
import { isManualPaymentMethod, paymentMethodLabel } from "@/services/storeApi";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, FileText, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { downloadInvoicePdf, getInvoiceForOrder } from "@/services/invoiceApi";
import type { Order } from "@/services/orderApi";
import type { RefundListItem } from "@/services/refundApi";
import InstapayProofReview from "@/components/payments/InstapayProofReview";
import { SendPaymentLinkButton } from "@/components/orders/SendPaymentLinkPicker";
import { formatOrderCurrency, PAYMENT_STATUS_COLORS } from "./_shared";

interface Props {
  order: Order;
  refunds: RefundListItem[];
  onMarkPaid: () => void;
  onUnmarkPaid?: () => void;
}

/**
 * Shopify-style consolidated payment summary.
 *
 * Replaces the previous split between the line-items totals block (Subtotal /
 * Shipping / Discount / Total) and the sidebar payment block (status pill /
 * mark-paid / invoice download / InstaPay proof review). One card, four
 * sections: line totals → paid/refunded/balance → status pill → actions.
 */
export function PaymentSummaryCard({ order, refunds, onMarkPaid, onUnmarkPaid }: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const queryClient = useQueryClient();
  const fmt = (cents: number) => formatOrderCurrency(cents, language);

  const refunded = refunds
    .filter((r) => r.status === "completed")
    .reduce((sum, r) => sum + r.amount, 0);
  // After a partial acceptance the collectible amount is what was kept.
  const collectible = order.collected_total ?? order.total;
  const paid = order.is_paid ? collectible : 0;
  const balance = collectible - paid - refunded;
  const returnedValue = order.partial_acceptance?.returned_value_cents ?? 0;

  const handleDownloadInvoice = async () => {
    if (!currentStore?.id) return;
    try {
      // Get-or-create — backend lazily generates the invoice when the
      // order is paid but the on-paid handler hasn't landed it yet.
      const invoice = await getInvoiceForOrder(currentStore.id, order.id);
      await downloadInvoicePdf(currentStore.id, invoice.id);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e?.status === 409) {
        toast.error(
          language === "ar"
            ? "ضع علامة على الطلب كمدفوع أولاً لإنشاء الفاتورة"
            : "Mark the order as paid first to generate the invoice",
        );
      } else {
        toast.error(
          language === "ar"
            ? "فشل تحميل الفاتورة"
            : "Failed to download invoice",
        );
      }
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {t("orders.paymentSummary")}
          </CardTitle>
          <Badge
            variant="secondary"
            className={PAYMENT_STATUS_COLORS[order.payment_status] || ""}
          >
            {t(`orders.${order.payment_status}`)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Totals — VAT-INCLUSIVE pricing. Listed product prices already
           contain the 14% VAT; the VAT line is shown as informational
           accounting only and is NOT added to the total. Total =
           subtotal + shipping − discount. */}
        <div className="space-y-1 text-sm">
          <Row label={t("orders.subtotal")} value={fmt(order.subtotal)} />
          {order.tax_amount > 0 && (
            <Row label={t("orders.includedVat")} value={fmt(order.tax_amount)} />
          )}
          <Row label={t("orders.shipping")} value={fmt(order.shipping_cost)} />
          {order.discount_amount > 0 && (
            <Row
              label={language === "ar" ? "الخصم" : "Discount"}
              value={`-${fmt(order.discount_amount)}`}
              valueClassName="text-primary"
            />
          )}
          <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
            <span>{t("orders.total")}</span>
            <span>{fmt(order.total)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground italic pt-1">
            {t("orders.pricesIncludeVat")}
          </p>
        </div>

        {/* Paid / Refunded / Balance */}
        <div className="space-y-1 text-sm border-t pt-3">
          <Row
            label={t("orders.paid")}
            value={fmt(paid)}
            valueClassName="text-primary"
          />
          {returnedValue > 0 && (
            <Row
              label={t("orders.partial.returnedValue")}
              value={`-${fmt(returnedValue)}`}
              valueClassName="text-terracotta"
            />
          )}
          {order.collected_total != null && order.collected_total !== order.total && (
            <Row label={t("orders.partial.collected")} value={fmt(order.collected_total)} />
          )}
          {refunded > 0 && (
            <Row
              label={t("orders.refunded")}
              value={`-${fmt(refunded)}`}
              valueClassName="text-blue-600 dark:text-blue-400"
            />
          )}
          {balance !== 0 && (
            <div className="flex justify-between font-semibold border-t pt-2 mt-1">
              <span>{t("orders.balance")}</span>
              <span
                className={
                  balance > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground"
                }
              >
                {fmt(Math.abs(balance))}
              </span>
            </div>
          )}
        </div>

        {/* Method + actions */}
        <div className="space-y-2 border-t pt-3">
          {order.payment_method && (
            <p className="text-sm text-muted-foreground">
              {language === "ar" ? "طريقة الدفع: " : "Method: "}
              {paymentMethodLabel(order.payment_method, language === "ar")}
            </p>
          )}
          {order.payment_status !== "paid" && (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              onClick={onMarkPaid}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {language === "ar" ? "تأكيد الدفع" : "Mark as Paid"}
            </Button>
          )}
          {order.payment_status !== "paid" && currentStore?.id && (
            <SendPaymentLinkButton
              storeId={currentStore.id}
              orderId={order.id}
              customerId={order.customer_id}
              isAr={language === "ar"}
            />
          )}
          {order.payment_status === "paid" && currentStore?.id && (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              onClick={handleDownloadInvoice}
            >
              <FileText className="h-3.5 w-3.5" />
              {language === "ar" ? "تحميل الفاتورة" : "Download Invoice"}
            </Button>
          )}
          {order.payment_status === "paid" && onUnmarkPaid && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full gap-1.5 text-muted-foreground hover:text-terracotta"
              onClick={onUnmarkPaid}
            >
              <Undo2 className="h-3.5 w-3.5" />
              {t("orders.unmark.action")}
            </Button>
          )}
        </div>

        {isManualPaymentMethod(order.payment_method) && currentStore?.id && (
          <div className="border-t pt-3">
            <InstapayProofReview
              storeId={currentStore.id}
              orderId={order.id}
              isAr={language === "ar"}
              onPaid={() => {
                queryClient.invalidateQueries({ queryKey: ["orders"] });
                queryClient.invalidateQueries({ queryKey: ["order", order.id] });
                queryClient.invalidateQueries({ queryKey: ["analytics"] });
                queryClient.invalidateQueries({ queryKey: ["dashboard"] });
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={valueClassName}>{value}</span>
    </div>
  );
}
