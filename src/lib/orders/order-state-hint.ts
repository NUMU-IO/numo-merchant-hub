/**
 * Explain an unusual order-status × payment-status combination.
 *
 * The orders list shows the two axes as independent pills, which is correct
 * — but a "Paid · Cancelled" row or a "COD · Pending · Confirmed" row reads
 * as a data error unless the screen says what it means and what to do. This
 * returns an i18n key (under `orders.hint.*`) plus a tone, or `null` when the
 * combination is ordinary and needs no hint.
 */

export interface OrderStateInput {
  status: string | null | undefined;
  payment_status: string | null | undefined;
  payment_method?: string | null;
}

export type OrderStateHint = {
  key: "orders.hint.refundDue" | "orders.hint.codCollect" | "orders.hint.awaitingCod";
  tone: "warning" | "info";
};

const REFUNDED = new Set(["refunded", "partially_refunded"]);

export function orderStateHint(o: OrderStateInput): OrderStateHint | null {
  const status = (o.status ?? "").toLowerCase();
  const pay = (o.payment_status ?? "").toLowerCase();
  const isCod = (o.payment_method ?? "").toLowerCase() === "cod" || pay === "cod";

  // Money was taken and the order died — the merchant owes a refund.
  if (pay === "paid" && (status === "cancelled" || status === "returned") && !REFUNDED.has(pay)) {
    return { key: "orders.hint.refundDue", tone: "warning" };
  }

  if (isCod && pay !== "paid") {
    // Shipped COD: cash is with the courier until delivery + remittance.
    if (status === "shipped") return { key: "orders.hint.awaitingCod", tone: "info" };
    // Confirmed / in preparation COD: nothing is wrong, it's paid on delivery.
    if (status === "confirmed" || status === "processing" || status === "pending") {
      return { key: "orders.hint.codCollect", tone: "info" };
    }
  }

  return null;
}
