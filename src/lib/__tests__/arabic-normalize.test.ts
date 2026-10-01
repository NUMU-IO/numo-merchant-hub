import { describe, expect, it } from "vitest";

import { arabicIncludes, normalizeArabic, toLatinDigits, toNumericInput } from "@/lib/arabic-normalize";

describe("normalizeArabic", () => {
  it("folds hamza-alef variants onto bare alef", () => {
    expect(normalizeArabic("إعدادات")).toBe(normalizeArabic("اعدادات"));
    expect(normalizeArabic("أمان")).toBe("امان");
    expect(normalizeArabic("آخر")).toBe("اخر");
  });

  it("folds ta-marbuta → ha and alef-maqsura → ya", () => {
    expect(normalizeArabic("المحفظة")).toBe(normalizeArabic("المحفظه"));
    expect(normalizeArabic("مصرى")).toBe(normalizeArabic("مصري"));
  });

  it("strips tashkeel and tatweel", () => {
    expect(normalizeArabic("مُنْتَجَات")).toBe("منتجات");
    expect(normalizeArabic("مـنـتـجـات")).toBe("منتجات");
  });

  it("converts Arabic-Indic digits to ASCII", () => {
    expect(normalizeArabic("٢٠٢٦")).toBe("2026");
    expect(normalizeArabic("۲۰۲۶")).toBe("2026");
  });

  it("lower-cases Latin and trims", () => {
    expect(normalizeArabic("  Payment Methods ")).toBe("payment methods");
  });

  it("handles empty input", () => {
    expect(normalizeArabic("")).toBe("");
    expect(normalizeArabic(null)).toBe("");
    expect(normalizeArabic(undefined)).toBe("");
  });
});

describe("arabicIncludes", () => {
  it("matches the way a merchant types", () => {
    expect(arabicIncludes("إعدادات المتجر", "اعدادات")).toBe(true);
    expect(arabicIncludes("طرق الدفع", "الدفع")).toBe(true);
    expect(arabicIncludes("Payment methods", "PAYMENT")).toBe(true);
  });

  it("empty needle matches everything", () => {
    expect(arabicIncludes("anything", "")).toBe(true);
  });

  it("does not over-match", () => {
    expect(arabicIncludes("الفواتير", "الشحن")).toBe(false);
  });
});

describe("toLatinDigits / toNumericInput", () => {
  it("turns Arabic and Persian digits and marks into Latin", () => {
    expect(toLatinDigits("٣٦٢٣٤٥")).toBe("362345");
    expect(toLatinDigits("۱۵۰۰")).toBe("1500");
    expect(toLatinDigits("١٢٠٫٥")).toBe("120.5");
    expect(toLatinDigits("١٬٥٠٠")).toBe("1500");
  });

  it("keeps a number field to digits (and a decimal point for money)", () => {
    expect(toNumericInput("١٥٠٠")).toBe("1500");
    expect(toNumericInput("1,500")).toBe("1500");
    expect(toNumericInput("12.50 EGP")).toBe("12.50");
    expect(toNumericInput("٥٫٥", false)).toBe("55");
  });
});
