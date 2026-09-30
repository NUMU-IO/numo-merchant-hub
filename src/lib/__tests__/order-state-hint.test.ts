import { describe, expect, it } from "vitest";

import { orderStateHint } from "@/lib/orders/order-state-hint";

describe("orderStateHint", () => {
  it("paid + cancelled → refund due", () => {
    expect(orderStateHint({ status: "cancelled", payment_status: "paid", payment_method: "vodafone_cash" }))
      .toEqual({ key: "orders.hint.refundDue", tone: "warning" });
    expect(orderStateHint({ status: "returned", payment_status: "paid" })?.key).toBe("orders.hint.refundDue");
  });

  it("already-refunded cancelled orders need no hint", () => {
    expect(orderStateHint({ status: "cancelled", payment_status: "refunded" })).toBeNull();
  });

  it("COD confirmed/processing → collect on delivery", () => {
    expect(orderStateHint({ status: "confirmed", payment_status: "pending", payment_method: "cod" }))
      .toEqual({ key: "orders.hint.codCollect", tone: "info" });
    expect(orderStateHint({ status: "processing", payment_status: "cod" })?.key).toBe("orders.hint.codCollect");
  });

  it("paid COD with cash still at the courier → cash with courier", () => {
    expect(orderStateHint({ status: "delivered", payment_status: "paid", payment_method: "cod", cash_received_at: null })?.key)
      .toBe("orders.hint.cashWithCourier");
    expect(orderStateHint({ status: "delivered", payment_status: "paid", payment_method: "cod", cash_received_at: "2026-10-05" }))
      .toBeNull();
  });

  it("COD with a paid deposit → deposit paid, rest on delivery", () => {
    expect(orderStateHint({ status: "confirmed", payment_status: "pending", payment_method: "cod", deposit_paid_at: "2026-09-29" })?.key)
      .toBe("orders.hint.depositPaid");
  });

  it("COD shipped but unpaid → customer pays on delivery", () => {
    expect(orderStateHint({ status: "shipped", payment_status: "pending", payment_method: "cod" })?.key)
      .toBe("orders.hint.awaitingCod");
  });

  it("ordinary combinations return null", () => {
    expect(orderStateHint({ status: "delivered", payment_status: "paid", payment_method: "cod" })).toBeNull();
    expect(orderStateHint({ status: "pending", payment_status: "pending", payment_method: "instapay" })).toBeNull();
    expect(orderStateHint({ status: "shipped", payment_status: "paid" })).toBeNull();
    expect(orderStateHint({ status: null, payment_status: undefined })).toBeNull();
  });
});
