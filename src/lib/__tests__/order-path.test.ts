/**
 * Order URLs carry the order NUMBER; the detail page tells a number from a
 * UUID to decide whether to resolve it. Getting that decision wrong either
 * sends a UUID through the number lookup or a number straight to the by-id
 * fetch — both 404 a real order.
 */

import { describe, expect, it } from "vitest";

import { isUuid, orderPath } from "@/lib/order-path";

describe("orderPath", () => {
  it("uses the order number when there is one", () => {
    expect(orderPath({ id: "7906f9f4-95b3-44b5-9f8b-c2c3bf8db776", order_number: "ORD-767567" }))
      .toBe("/orders/ORD-767567");
  });

  it("falls back to the id when the number is unknown", () => {
    expect(orderPath({ id: "7906f9f4-95b3-44b5-9f8b-c2c3bf8db776" }))
      .toBe("/orders/7906f9f4-95b3-44b5-9f8b-c2c3bf8db776");
  });

  it("escapes a number that isn't URL-safe", () => {
    expect(orderPath({ id: "x", order_number: "ORD #12/3" })).toBe(
      "/orders/ORD%20%2312%2F3",
    );
  });
});

describe("isUuid", () => {
  it("recognises a UUID in either case", () => {
    expect(isUuid("7906f9f4-95b3-44b5-9f8b-c2c3bf8db776")).toBe(true);
    expect(isUuid("7906F9F4-95B3-44B5-9F8B-C2C3BF8DB776")).toBe(true);
  });

  it("does not mistake an order number for one", () => {
    expect(isUuid("ORD-767567")).toBe(false);
    expect(isUuid("767567")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
