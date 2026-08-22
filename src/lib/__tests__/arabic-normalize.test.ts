import { describe, expect, it } from "vitest";

import { arabicIncludes, normalizeArabic } from "@/lib/arabic-normalize";

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
