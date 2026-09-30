import { describe, it, expect, beforeEach } from "vitest";
import { clearPrefill, readPrefill, savePrefill } from "@/lib/onboardingPrefill";

const allowed = {
  niche: ["fashion", "other"],
  sellsWhere: ["instagram", "nowhere"],
  ordersBand: ["0", "1-50"],
  payments: ["cod", "paymob_card"],
  shipping: ["bosta", "manual"],
};

describe("onboarding prefill", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the answers the wizard offers", () => {
    savePrefill(
      JSON.stringify({ niche: "fashion", sellsWhere: "instagram", ordersBand: "1-50", payments: ["cod", "paymob_card"], shipping: "bosta" }),
    );
    expect(readPrefill(allowed)).toEqual({
      niche: "fashion",
      sellsWhere: "instagram",
      ordersBand: "1-50",
      payments: ["cod", "paymob_card"],
      shipping: "bosta",
    });
  });

  it("drops values the wizard does not offer", () => {
    savePrefill(JSON.stringify({ niche: "weapons", sellsWhere: "<script>", payments: ["cod", "bitcoin", 7], shipping: "bosta" }));
    expect(readPrefill(allowed)).toEqual({ payments: ["cod"], shipping: "bosta" });
  });

  it("ignores junk, oversized and expired input", () => {
    savePrefill("not json");
    expect(readPrefill(allowed)).toBeNull();
    savePrefill(JSON.stringify({ niche: "fashion", pad: "x".repeat(600) }));
    expect(readPrefill(allowed)).toBeNull(); // the oversized one was never stored
    savePrefill(JSON.stringify({ niche: "fashion" }), 0);
    expect(readPrefill(allowed, 8 * 24 * 60 * 60 * 1000)).toBeNull();
    savePrefill(JSON.stringify({ niche: "chairs" }));
    expect(readPrefill(allowed)).toBeNull();
  });

  it("clears", () => {
    savePrefill(JSON.stringify({ niche: "other" }));
    clearPrefill();
    expect(readPrefill(allowed)).toBeNull();
  });
});
