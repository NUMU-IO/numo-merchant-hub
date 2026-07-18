/**
 * COD Autopilot "Needs attention" queue (004-cod-autopilot, FR-021).
 *
 * The orders Autopilot could not close on its own: the customer tapped
 * Refused on the delivery check, every delivery-check attempt went
 * unanswered, or a late tap contradicted an already-recorded closure.
 * The merchant resolves each with the existing order actions — mark
 * returned / mark delivered — or dismisses the flag. Everything else in
 * the store is flowing hands-free, which is exactly what the empty
 * state celebrates.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, PackageCheck, RotateCcw, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  listAutopilotExceptions,
  resolveAutopilotException,
  updateOrderStatus,
  type AutopilotException,
} from "@/services/orderApi";
import { showError } from "@/lib/show-error";
import { Button } from "@/components/ui/button";

const REASON_STYLE: Record<string, string> = {
  refused: "bg-red-500/10 text-red-700",
  response_exhausted: "bg-amber-500/10 text-amber-700",
  late_contradiction: "bg-violet-500/10 text-violet-700",
};

function reasonLabel(reason: string, isAr: boolean): string {
  switch (reason) {
    case "refused":
      return isAr ? "العميل رفض الاستلام" : "Customer refused";
    case "response_exhausted":
      return isAr ? "لا يوجد رد من العميل" : "No customer response";
    case "late_contradiction":
      return isAr ? "رد متأخر يناقض الحالة" : "Late contradicting reply";
    default:
      return reason;
  }
}

function ageLabel(hours: number, isAr: boolean): string {
  if (hours < 24) return isAr ? `${hours} س` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return isAr ? `${days} يوم` : `${days}d`;
}

export default function AutopilotExceptions({
  storeId,
  isAr,
  language,
}: {
  storeId: string;
  isAr: boolean;
  language: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [actingOn, setActingOn] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["autopilot-exceptions", storeId],
    queryFn: () => listAutopilotExceptions(storeId, { limit: 50 }),
  });

  const items = query.data?.items ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["autopilot-exceptions", storeId] });
    queryClient.invalidateQueries({ queryKey: ["autopilot-exceptions-count", storeId] });
    queryClient.invalidateQueries({ queryKey: ["orders", storeId] });
  };

  const act = async (
    row: AutopilotException,
    action: "returned" | "delivered" | "dismiss",
  ) => {
    setActingOn(row.order_id);
    try {
      if (action === "dismiss") {
        await resolveAutopilotException(storeId, row.order_id);
        toast.success(isAr ? "تم تجاهل التنبيه" : "Flag dismissed");
      } else {
        // Status change through the normal endpoint — the backend clears
        // the Autopilot flag as a side effect (FR-018/FR-021).
        await updateOrderStatus(storeId, row.order_id, action);
        toast.success(
          action === "returned"
            ? isAr
              ? "تم تحديد الطلب كمرتجع"
              : "Order marked returned"
            : isAr
              ? "تم تحديد الطلب كمُسلَّم"
              : "Order marked delivered",
        );
      }
      invalidate();
    } catch (err) {
      showError(err, language);
    } finally {
      setActingOn(null);
    }
  };

  const formatCurrency = (cents: number, currency: string) => {
    const val = cents / 100;
    return isAr
      ? `${val.toLocaleString("ar-EG")} ${currency}`
      : `${currency} ${val.toLocaleString()}`;
  };

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <p className="text-base font-semibold mb-1">
          {isAr ? "كل حاجة ماشية لوحدها" : "Everything is flowing on its own"}
        </p>
        <p className="text-xs text-muted-foreground max-w-sm">
          {isAr
            ? "مفيش طلبات محتاجة تدخلك — الأوتوبايلوت بيقفل الطلبات أول بأول."
            : "No orders need your attention — Autopilot is closing orders as they complete."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="text-start font-medium px-5 py-2.5">
              {isAr ? "الطلب" : "Order"}
            </th>
            <th className="text-start font-medium px-3 py-2.5">
              {isAr ? "العميل" : "Customer"}
            </th>
            <th className="text-start font-medium px-3 py-2.5">
              {isAr ? "الإجمالي" : "Total"}
            </th>
            <th className="text-start font-medium px-3 py-2.5">
              {isAr ? "السبب" : "Reason"}
            </th>
            <th className="text-start font-medium px-3 py-2.5">
              {isAr ? "منذ" : "Age"}
            </th>
            <th className="text-start font-medium px-3 py-2.5">
              {isAr ? "محاولات" : "Pings"}
            </th>
            <th className="text-end font-medium px-5 py-2.5">
              {isAr ? "إجراء" : "Actions"}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const busy = actingOn === row.order_id;
            return (
              <tr key={row.order_id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-5 py-3">
                  <button
                    type="button"
                    className="font-semibold text-primary hover:underline"
                    onClick={() => navigate(`/orders/${row.order_id}`)}
                  >
                    {row.order_number}
                  </button>
                </td>
                <td className="px-3 py-3">{row.customer_name || "—"}</td>
                <td className="px-3 py-3 tabular-nums">
                  {formatCurrency(row.total_cents, row.currency)}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      REASON_STYLE[row.exception_reason] ?? "bg-muted text-foreground"
                    }`}
                  >
                    {reasonLabel(row.exception_reason, isAr)}
                  </span>
                </td>
                <td className="px-3 py-3 tabular-nums text-muted-foreground">
                  {ageLabel(row.age_hours, isAr)}
                </td>
                <td className="px-3 py-3 tabular-nums text-muted-foreground">
                  {row.attempts}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {row.order_status === "shipped" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] gap-1"
                          disabled={busy}
                          onClick={() => act(row, "returned")}
                        >
                          <RotateCcw className="h-3 w-3" />
                          {isAr ? "مرتجع" : "Returned"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] gap-1"
                          disabled={busy}
                          onClick={() => act(row, "delivered")}
                        >
                          <PackageCheck className="h-3 w-3" />
                          {isAr ? "مُسلَّم" : "Delivered"}
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] gap-1 text-muted-foreground"
                      disabled={busy}
                      onClick={() => act(row, "dismiss")}
                    >
                      {busy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                      {isAr ? "تجاهل" : "Dismiss"}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
