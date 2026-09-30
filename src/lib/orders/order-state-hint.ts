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
  /** null = COD cash still with the courier; undefined = API predates it. */
  cash_received_at?: string | null;
  deposit_paid_at?: string | null;
}

export type OrderStateHint = {
  key:
    | "orders.hint.refundDue"
    | "orders.hint.codCollect"
    | "orders.hint.awaitingCod"
    | "orders.hint.cashWithCourier"
    | "orders.hint.depositPaid";
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

  // Paid at the door, but the courier still holds the cash.
  if (isCod && pay === "paid" && o.cash_received_at === null) {
    return { key: "orders.hint.cashWithCourier", tone: "warning" };
  }

  if (isCod && pay !== "paid") {
    // Shipped COD: the customer pays the courier on delivery.
    if (status === "shipped") return { key: "orders.hint.awaitingCod", tone: "info" };
    // Confirmed / in preparation COD: nothing is wrong, it's paid on delivery.
    if (status === "confirmed" || status === "processing" || status === "pending") {
      return o.deposit_paid_at
        ? { key: "orders.hint.depositPaid", tone: "info" }
        : { key: "orders.hint.codCollect", tone: "info" };
    }
  }

  return null;
}
