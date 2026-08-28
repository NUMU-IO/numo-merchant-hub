import { describe, it, expect } from "vitest";

import {
  pluralAr,
  countAr,
  agoAr,
  AR_CUSTOMERS,
  AR_TIMES_USED,
  AR_MINUTES,
} from "../arabic-plural";

describe("pluralAr", () => {
  it("picks the CLDR form for each category", () => {
    expect(pluralAr(1, AR_CUSTOMERS)).toBe("عميل");
    expect(pluralAr(2, AR_CUSTOMERS)).toBe("عميلين");
    expect(pluralAr(3, AR_CUSTOMERS)).toBe("عملاء");
    expect(pluralAr(10, AR_CUSTOMERS)).toBe("عملاء");
    expect(pluralAr(11, AR_CUSTOMERS)).toBe("عميل");
    expect(pluralAr(99, AR_CUSTOMERS)).toBe("عميل");
  });

  it("reads 0 as a plural, not a singular", () => {
    expect(pluralAr(0, AR_CUSTOMERS)).toBe("عملاء");
  });

  it("applies the categories modulo 100", () => {
    // 103 behaves like 3, 111 like 11 — the rule keys on the last two digits.
    expect(pluralAr(103, AR_CUSTOMERS)).toBe("عملاء");
    expect(pluralAr(111, AR_CUSTOMERS)).toBe("عميل");
    expect(pluralAr(101, AR_CUSTOMERS)).toBe("عميل");
  });

  it("is not fooled by negatives or fractions", () => {
    expect(pluralAr(-2, AR_CUSTOMERS)).toBe("عميلين");
    expect(pluralAr(3.7, AR_CUSTOMERS)).toBe("عملاء");
  });
});

describe("countAr", () => {
  it("renders Arabic-Indic digits with an agreeing noun", () => {
    // The regression this whole module exists for: the hub shipped "٣ عميل".
    expect(countAr(3, AR_CUSTOMERS)).toBe("٣ عملاء");
    expect(countAr(4, AR_TIMES_USED)).toBe("٤ مرات");
    expect(countAr(1, AR_TIMES_USED)).toBe("١ مرة");
  });
});

describe("agoAr", () => {
  it("drops the numeral for one and two, which the noun already carries", () => {
    expect(agoAr(1, AR_MINUTES)).toBe("منذ دقيقة");
    expect(agoAr(2, AR_MINUTES)).toBe("منذ دقيقتين");
  });

  it("keeps the numeral from three up", () => {
    expect(agoAr(5, AR_MINUTES)).toBe("منذ ٥ دقائق");
    expect(agoAr(15, AR_MINUTES)).toBe("منذ ١٥ دقيقة");
  });
});
