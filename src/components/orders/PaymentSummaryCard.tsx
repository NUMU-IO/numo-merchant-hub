import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  fetchPaymentProofs,
  isManualPaymentMethod,
  paymentMethodLabel,
  recordOrderPayment,
  voidRecordedPayment,
  type PaymentProof,
  type RecordPaymentInput,
} from "@/services/storeApi";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Plus, Printer, Truck, Undo2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { printOrderInvoice } from "@/services/invoiceApi";
import { showError } from "@/lib/show-error";
import { ApiError } from "@/lib/api-error";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { markCashReceived, type Order } from "@/services/orderApi";
import type { RefundListItem } from "@/services/refundApi";
import InstapayProofReview, {
  paymentProofsQueryKey,
} from "@/components/payments/InstapayProofReview";
import { RecordPaymentDialog } from "@/components/orders/RecordPaymentDialog";
import { RecordedPaymentsList } from "@/components/orders/RecordedPaymentsList";
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

  const [recordOpen, setRecordOpen] = useState(false);
  // Set when the API says the receipt looks like one already counted on this
  // order; holds the submission so "record anyway" can resend it.
  const [lookAlike, setLookAlike] = useState<RecordPaymentInput | null>(null);

  // Same query key InstapayProofReview uses, so React Query serves this from
  // cache rather than issuing a second request. The proofs table is where
  // merchant-recorded part payments live.
  const proofsQuery = useQuery<PaymentProof[]>({
    queryKey: paymentProofsQueryKey(currentStore?.id ?? "", order.id),
    queryFn: () => fetchPaymentProofs(currentStore!.id, order.id),
    enabled: !!currentStore?.id,
    staleTime: 30_000,
  });
  const proofs = proofsQuery.data ?? [];

  const refunded = refunds
    .filter((r) => r.status === "completed")
    .reduce((sum, r) => sum + r.amount, 0);
  // After a partial acceptance the collectible amount is what was kept.
  const collectible = order.collected_total ?? order.total;
  // Money actually collected against this order: settled proofs, which covers
  // both merchant-recorded part payments and an approved customer upload. A
  // fully-paid order still short-circuits to the collectible total, so every
  // order that predates this feature renders exactly as it did before.
  const recorded = proofs
    .filter((p) => p.status === "approved" || p.status === "auto_approved")
    .reduce((sum, p) => sum + (p.declared_amount_cents ?? 0), 0);
  const paid = order.is_paid ? collectible : recorded;
  const balance = collectible - paid - refunded;
  const overpaid = paid > collectible;
  const returnedValue = order.partial_acceptance?.returned_value_cents ?? 0;

  const orderClosed =
    order.status === "cancelled" || order.status === "refunded";
  const canRecordPayment = !order.is_paid && !orderClosed && !!currentStore?.id;

  const invalidatePayments = () => {
    queryClient.invalidateQueries({
      queryKey: paymentProofsQueryKey(currentStore?.id ?? "", order.id),
    });
    queryClient.invalidateQueries({ queryKey: ["order", order.id] });
    // Recording or voiding writes a `payment_recorded` / `payment_voided`
    // system event, so the timeline has to refetch too — otherwise the entry
    // only shows up after a page reload.
    queryClient.invalidateQueries({
      queryKey: ["order-timeline", currentStore?.id, order.id],
    });
    queryClient.invalidateQueries({
      queryKey: ["order-activities", currentStore?.id, order.id],
    });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const recordPayment = useMutation({
    mutationFn: (input: RecordPaymentInput) =>
      recordOrderPayment(currentStore!.id, order.id, input),
    onSuccess: () => {
      toast.success(language === "ar" ? "تم تسجيل الدفعة" : "Payment recorded");
      setRecordOpen(false);
      invalidatePayments();
    },
    onError: (err, input) => {
      if (err instanceof ApiError && err.code === "POSSIBLE_DUPLICATE_RECEIPT") {
        setLookAlike(input);
        return;
      }
      showError(err, language);
    },
  });

  // COD: the customer paid the courier, but the cash reaches the merchant
  // only when the courier remits it. Tracked separately from "paid".
  const cashReceived = useMutation({
    mutationFn: (received: boolean) =>
      markCashReceived(currentStore!.id, [order.id], received),
    onSuccess: invalidatePayments,
    onError: (err) => showError(err, language),
  });
  // `=== undefined` means the API predates cash tracking: show nothing.
  const cashPending =
    order.is_paid && order.payment_method === "cod" && order.cash_received_at !== undefined;

  const voidPayment = useMutation({
    mutationFn: (args: { proofId: string; reason: string }) =>
      voidRecordedPayment(currentStore!.id, args.proofId, args.reason),
    onSuccess: () => {
      toast.success(language === "ar" ? "تم إلغاء الدفعة" : "Payment voided");
      invalidatePayments();
    },
    onError: (err) => showError(err, language),
  });

  const [printingInvoice, setPrintingInvoice] = useState(false);
  // Any order, paid or not: a cash-on-delivery merchant prints the invoice
  // at dispatch to pack with the parcel, before any money has moved. This
  // used to be paid-only, which hid it at exactly that moment.
  const handlePrintInvoice = async () => {
    if (!currentStore?.id || printingInvoice) return;
    setPrintingInvoice(true);
    try {
      await printOrderInvoice(currentStore.id, order.id);
    } catch {
      toast.error(
        language === "ar" ? "تعذّر فتح الفاتورة" : "Couldn't open the invoice",
      );
    } finally {
      setPrintingInvoice(false);
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
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t("orders.paid")}
              {overpaid && (
                <Badge
                  variant="secondary"
                  className="ms-2 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                >
                  {language === "ar" ? "دفع زيادة" : "Overpaid"}
                </Badge>
              )}
            </span>
            <span className="text-primary">{fmt(paid)}</span>
          </div>
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
          {!!order.deposit_amount_cents && (
            <p className="text-sm text-muted-foreground">
              {language === "ar" ? "العربون: " : "Deposit: "}
              <span className={order.deposit_paid_at ? "text-sky-700 dark:text-sky-400" : ""}>
                {fmt(order.deposit_amount_cents)}
                {" · "}
                {order.deposit_paid_at
                  ? language === "ar" ? "اتدفع" : "paid"
                  : language === "ar" ? "لسه ما اتدفعش" : "not paid yet"}
              </span>
              {!!order.deposit_paid_at &&
                !!order.deposit_required_cents &&
                order.deposit_required_cents !== order.deposit_amount_cents && (
                  <span className="text-amber-700 dark:text-amber-400">
                    {language === "ar"
                      ? ` (المطلوب ${fmt(order.deposit_required_cents)})`
                      : ` (of ${fmt(order.deposit_required_cents)} asked)`}
                  </span>
                )}
            </p>
          )}
          {cashPending && currentStore?.id && (
            order.cash_received_at ? (
              <div className="flex items-center justify-between gap-2 rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5" />
                  {language === "ar" ? "الفلوس وصلتك" : "Cash collected"}
                  {" · "}
                  {new Date(order.cash_received_at).toLocaleDateString(
                    language === "ar" ? "ar-EG" : "en-GB",
                    { day: "numeric", month: "short" },
                  )}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  disabled={cashReceived.isPending}
                  onClick={() => cashReceived.mutate(false)}
                >
                  {language === "ar" ? "تراجع" : "Undo"}
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-sm text-amber-700 dark:text-amber-400">
                  <Truck className="h-3.5 w-3.5" />
                  {language === "ar"
                    ? "اتدفع للمندوب، والفلوس لسه مع شركة الشحن"
                    : "Paid to the courier, cash not collected yet"}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5"
                  disabled={cashReceived.isPending}
                  onClick={() => cashReceived.mutate(true)}
                >
                  {cashReceived.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wallet className="h-3.5 w-3.5" />
                  )}
                  {language === "ar" ? "استلمت الفلوس" : "Mark cash collected"}
                </Button>
              </>
            )
          )}
          {canRecordPayment && (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              onClick={() => setRecordOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              {language === "ar" ? "سجّل دفعة" : "Record a payment"}
            </Button>
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
          {currentStore?.id && (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              onClick={handlePrintInvoice}
              disabled={printingInvoice}
            >
              {printingInvoice ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Printer className="h-3.5 w-3.5" />
              )}
              {language === "ar" ? "طباعة الفاتورة" : "Print invoice"}
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

        {/* Payments the merchant recorded by hand, newest last. */}
        {currentStore?.id && (
          <RecordedPaymentsList
            proofs={proofs}
            isAr={language === "ar"}
            language={language}
            canVoid={!order.is_paid}
            voidingId={
              voidPayment.isPending ? voidPayment.variables?.proofId : undefined
            }
            onVoid={(proofId, reason) =>
              voidPayment.mutate({ proofId, reason })
            }
          />
        )}

        {/* Customer-submitted proofs keep their own review pane with the
            approve / reject CTA. The gate used to be the order's payment
            method alone, which hid this entirely on a COD order that took a
            Vodafone Cash prepayment — exactly the case the recorder exists
            for. */}
        {currentStore?.id &&
          (isManualPaymentMethod(order.payment_method) ||
            proofs.some((p) => !p.recorded_method)) && (
            <div className="border-t pt-3">
              <InstapayProofReview
                storeId={currentStore.id}
                orderId={order.id}
                isAr={language === "ar"}
                onPaid={invalidatePayments}
              />
            </div>
          )}

        <AlertDialog open={lookAlike !== null} onOpenChange={(o) => !o && setLookAlike(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {language === "ar"
                  ? "الإيصال ده شكله متسجّل قبل كده"
                  : "This receipt looks already recorded"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {language === "ar"
                  ? "فيه إيصال شبهه بالظبط متحسب على الطلب ده. غالباً ده نفس التحويل اللي العميل رفعه. سجّله بس لو دي تحويلة تانية فعلاً."
                  : "A receipt that looks the same is already counted on this order, most likely the transfer the customer uploaded. Record it only if this is really a second transfer."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {language === "ar" ? "ما تسجلش" : "Don't record"}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (lookAlike) recordPayment.mutate({ ...lookAlike, confirmDuplicate: true });
                  setLookAlike(null);
                }}
              >
                {language === "ar" ? "دي تحويلة تانية، سجّلها" : "It's a different transfer, record it"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {currentStore?.id && (
          <RecordPaymentDialog
            open={recordOpen}
            onOpenChange={setRecordOpen}
            balanceDueCents={Math.max(0, balance)}
            currencyLanguage={language}
            submitting={recordPayment.isPending}
            onSubmit={(input) => recordPayment.mutate(input)}
          />
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
