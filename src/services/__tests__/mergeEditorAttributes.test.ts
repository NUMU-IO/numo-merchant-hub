import { describe, expect, it } from "vitest";
import { mergeEditorAttributes } from "../productApi";

const fresh = () => ({
  nameAr: "قديم",
  label: { key: "new", en: "New", ar: "جديد" },
  size_chart: { rows: [] },
  seoTitleAr: "عنوان السيو",
  seoDescriptionAr: "وصف السيو",
  faq_x: { items: [{ q: "سؤال؟", a: "إجابة" }] },
});

describe("mergeEditorAttributes", () => {
  it("keeps keys the editor does not own byte-identical", () => {
    const stored = fresh();
    const merged = mergeEditorAttributes(stored, { nameAr: "جديد", categoryName: "Bags" });
    expect(merged.seoTitleAr).toBe(stored.seoTitleAr);
    expect(merged.seoDescriptionAr).toBe(stored.seoDescriptionAr);
    expect(JSON.stringify(merged.faq_x)).toBe(JSON.stringify(stored.faq_x));
  });

  it("sets the editor's keys, including a false toggle", () => {
    const merged = mergeEditorAttributes(fresh(), {
      nameAr: "جديد",
      categoryName: "Bags",
      categoryNameAr: "Bags",
      variant_meta: { axes: [] },
      continue_selling_when_out_of_stock: false,
    });
    expect(merged).toMatchObject({
      nameAr: "جديد",
      categoryName: "Bags",
      categoryNameAr: "Bags",
      variant_meta: { axes: [] },
      continue_selling_when_out_of_stock: false,
    });
  });

  it("deletes an editor key the form cleared", () => {
    const merged = mergeEditorAttributes(fresh(), { nameAr: "", label: null, categoryName: "" });
    expect(merged).not.toHaveProperty("nameAr");
    expect(merged).not.toHaveProperty("label");
    expect(merged).not.toHaveProperty("size_chart");
    expect(merged).not.toHaveProperty("categoryName");
  });

  it("does not mutate the fresh object", () => {
    const stored = fresh();
    const before = JSON.stringify(stored);
    mergeEditorAttributes(stored, { nameAr: "جديد" });
    expect(JSON.stringify(stored)).toBe(before);
  });
});
