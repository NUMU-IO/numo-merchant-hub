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

  it("COD shipped but unpaid → awaiting courier remittance", () => {
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
