import { describe, expect, it } from "vitest";

import { stockState, LOW_STOCK_THRESHOLD } from "@/lib/products/stock-state";

describe("stockState", () => {
  it("flags negative quantities as oversold (the case every old branch missed)", () => {
    expect(stockState(-3)).toBe("oversold");
    expect(stockState(-1)).toBe("oversold");
  });

  it("distinguishes out / low / ok around one shared threshold", () => {
    expect(stockState(0)).toBe("out");
    expect(stockState(1)).toBe("low");
    expect(stockState(LOW_STOCK_THRESHOLD)).toBe("low");
    expect(stockState(LOW_STOCK_THRESHOLD + 1)).toBe("ok");
    expect(stockState(500)).toBe("ok");
  });

  it("accepts a custom threshold", () => {
    expect(stockState(15, 20)).toBe("low");
    expect(stockState(21, 20)).toBe("ok");
  });

  it("treats missing / NaN stock as out of stock rather than crashing", () => {
    expect(stockState(null)).toBe("out");
    expect(stockState(undefined)).toBe("out");
    expect(stockState(Number.NaN)).toBe("out");
  });
});
