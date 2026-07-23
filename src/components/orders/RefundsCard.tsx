import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  approveRefund,
  createRefund,
  processRefund,
  rejectRefund,
  type CreateRefundRequest,
  type RefundListItem,
  type RefundReason,
} from "@/services/refundApi";
import type { Order } from "@/services/orderApi";
import { showError } from "@/lib/show-error";
import { formatOrderCurrency, REFUND_STATUS_COLORS } from "./_shared";

interface Props {
  storeId: string;
  order: Order;
  refunds: RefundListItem[];
}

export function RefundsCard({ storeId, order, refunds }: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const fmt = (cents: number) => formatOrderCurrency(cents, language);

  const [showForm, setShowForm] = useState(false);
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [refundReason, setRefundReason] = useState<RefundReason>("customer_request");
  const [refundNote, setRefundNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  // Shopify-style "restock items" — merchant opt-in per refund. Restocks
  // ALL of the order's debited lines exactly once (idempotent server-side).
  const [restockOnProcess, setRestockOnProcess] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["order-refunds", storeId, order.id],
    });
    queryClient.invalidateQueries({ queryKey: ["order", order.id] });
  };

  const create = useMutation({
    mutationFn: (data: CreateRefundRequest) =>
      createRefund(storeId, order.id, data),
    onSuccess: () => {
      toast.success(
        language === "ar"
          ? "تم إنشاء طلب الاسترداد"
          : "Refund request created",
      );
      setShowForm(false);
      setRefundNote("");
      setRefundAmount("");
      invalidate();
    },
    onError: (err) => showError(err, language),
  });

  const approve = useMutation({
    mutationFn: (refundId: string) => approveRefund(storeId, order.id, refundId),
    onSuccess: () => {
      toast.success(
        language === "ar" ? "تمت الموافقة على الاسترداد" : "Refund approved",
      );
      invalidate();
    },
    onError: (err) => showError(err, language),
  });

  const reject = useMutation({
    mutationFn: (refundId: string) => rejectRefund(storeId, order.id, refundId),
    onSuccess: () => {
      toast.success(
        language === "ar" ? "تم رفض الاسترداد" : "Refund rejected",
      );
      invalidate();
    },
    onError: (err) => showError(err, language),
  });

  const process = useMutation({
    mutationFn: (refundId: string) =>
      processRefund(storeId, order.id, refundId, restockOnProcess),
    onSuccess: (result) => {
      if (result.status === "completed") {
        toast.success(
          language === "ar"
            ? "تم معالجة الاسترداد بنجاح"
            : "Refund processed successfully",
        );
      } else if (result.status === "failed") {
        toast.error(
          language === "ar"
            ? "فشلت معالجة الاسترداد"
            : `Refund failed: ${result.failure_reason || "Unknown error"}`,
        );
      }
      invalidate();
    },
    onError: (err) => showError(err, language),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            {t("refunds.title")}
          </CardTitle>
          {order.is_paid && !showForm && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setShowForm(true)}
            >
              {t("refunds.requestRefund")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
            <div className="space-y-2">
              <label className="text-xs font-medium">{t("refunds.type")}</label>
              <Select
                value={refundType}
                onValueChange={(v) => setRefundType(v as "full" | "partial")}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">{t("refunds.full")}</SelectItem>
                  <SelectItem value="partial">{t("refunds.partial")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {refundType === "partial" && (
              <div className="space-y-2">
                <label className="text-xs font-medium">
                  {t("refunds.amount")}
                </label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder={language === "ar" ? "المبلغ" : "Amount"}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-medium">
                {t("refunds.reason")}
              </label>
              <Select
                value={refundReason}
                onValueChange={(v) => setRefundReason(v as RefundReason)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer_request">
                    {t("refunds.reasons.customer_request")}
                  </SelectItem>
                  <SelectItem value="defective">
                    {t("refunds.reasons.defective")}
                  </SelectItem>
                  <SelectItem value="wrong_item">
                    {t("refunds.reasons.wrong_item")}
                  </SelectItem>
                  <SelectItem value="not_as_described">
                    {t("refunds.reasons.not_as_described")}
                  </SelectItem>
                  <SelectItem value="duplicate_order">
                    {t("refunds.reasons.duplicate_order")}
                  </SelectItem>
                  <SelectItem value="other">
                    {t("refunds.reasons.other")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">{t("refunds.note")}</label>
              <Textarea
                placeholder={
                  language === "ar"
                    ? "ملاحظات إضافية..."
                    : "Additional notes..."
                }
                value={refundNote}
                onChange={(e) => setRefundNote(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-7 text-xs"
                disabled={create.isPending}
                onClick={() =>
                  create.mutate({
                    refund_type: refundType,
                    reason: refundReason,
                    reason_note: refundNote || undefined,
                    amount:
                      refundType === "partial"
                        ? Math.round(Number(refundAmount) * 100)
                        : undefined,
                  })
                }
              >
                {create.isPending && (
                  <Loader2 className="h-3 w-3 animate-spin me-1" />
                )}
                {t("refunds.submit")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setShowForm(false)}
              >
                {language === "ar" ? "إلغاء" : "Cancel"}
              </Button>
            </div>
          </div>
        )}

        {refunds.length > 0 ? (
          <div className="space-y-2">
            {refunds.map((r) => (
              <div
                key={r.id}
                className="p-2.5 rounded-lg border text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.refund_number}</span>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 ${REFUND_STATUS_COLORS[r.status] || ""}`}
                  >
                    {t(`refunds.statuses.${r.status}`)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>
                    {r.refund_type === "full"
                      ? t("refunds.full")
                      : t("refunds.partial")}
                  </span>
                  <span className="font-medium text-foreground">
                    {fmt(r.amount)}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  {t(`refunds.reasons.${r.reason}`)}
                </div>
                {r.status === "requested" && (
                  <div className="flex gap-1.5 pt-1">
                    <Button
                      size="sm"
                      className="h-6 text-[10px] flex-1"
                      onClick={() => approve.mutate(r.id)}
                    >
                      {t("refunds.approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 text-[10px] flex-1"
                      onClick={() => reject.mutate(r.id)}
                    >
                      {t("refunds.reject")}
                    </Button>
                  </div>
                )}
                {r.status === "approved" && (
                  <div className="space-y-1.5 pt-1">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restockOnProcess}
                        onChange={(e) => setRestockOnProcess(e.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 rounded accent-primary"
                      />
                      <span className="text-[10px] text-muted-foreground leading-snug">
                        {language === "ar"
                          ? "إرجاع كل كميات الطلب للمخزون (مرة واحدة فقط)"
                          : "Restock all order items (applies once)"}
                      </span>
                    </label>
                    <Button
                      size="sm"
                      className="h-6 text-[10px] w-full"
                      onClick={() => process.mutate(r.id)}
                    >
                      <RotateCcw className="h-3 w-3 me-1" />
                      {t("refunds.process")}
                    </Button>
                  </div>
                )}
                {r.status === "failed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] w-full"
                    onClick={() => process.mutate(r.id)}
                  >
                    <AlertCircle className="h-3 w-3 me-1" />
                    {t("refunds.retry")}
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          !showForm && (
            <p className="text-xs text-muted-foreground">
              {t("refunds.noRefunds")}
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}
